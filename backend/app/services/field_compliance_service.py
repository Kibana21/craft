"""Per-field inline compliance checking for the Poster Wizard (Phase E).

Flow:
  text + tone → normalise → hash → Redis cache lookup
    hit  → return cached flags
    miss → Layer 1 static patterns
         → Layer 2 active custom DB rules
         → Layer 3 LLM semantic check (MISSING_PRODUCT_QUALIFIER, optional)
         → cache result → return

Cache key: sha256(normalised_text + ":" + tone), TTL 24 h.
Cache namespace: "compliance:check-field:{hash}".
Invalidation: delete entire namespace on any ComplianceRule mutation.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re

import redis.asyncio as redis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.compliance_rule import ComplianceRule
from app.services.compliance_patterns import PATTERNS, PATTERN_SEVERITY
from app.services.ai_service import _gemini_model

logger = logging.getLogger(__name__)

# ── Constants ──────────────────────────────────────────────────────────────────

CACHE_TTL_SECONDS = 86_400          # 24 hours
CACHE_NS = "compliance:check-field"
LLM_MIN_WORD_COUNT = 3              # skip LLM for very short fields


# ── Public entry point ─────────────────────────────────────────────────────────

async def check_field(
    db: AsyncSession,
    redis_client: redis.Redis,
    field: str,
    text: str,
    tone: str,
    content_hash: str | None = None,
) -> dict:
    """Return compliance flags for a single copy field.

    Returns:
        {"flags": [...], "cached": bool}
    """
    if not text or len(text.strip()) < 3:
        return {"flags": [], "cached": False}

    normalised = _normalise(text)
    cache_key = _make_cache_key(normalised, tone)
    redis_key = f"{CACHE_NS}:{cache_key}"

    # ── Cache hit ──────────────────────────────────────────────────────────────
    try:
        cached = await redis_client.get(redis_key)
        if cached:
            return {"flags": json.loads(cached), "cached": True}
    except Exception as exc:
        logger.warning("Redis read error in check_field: %s", exc)

    # ── Layer 1: static pattern library ───────────────────────────────────────
    flags: list[dict] = []
    text_lower = text.lower()

    for pattern_type, entries in PATTERNS.items():
        for entry in entries:
            if re.search(entry.pattern, text_lower, re.IGNORECASE):
                matched = _extract_match(entry.pattern, text_lower)
                flags.append({
                    "pattern_type": pattern_type,
                    "matched_phrase": matched,
                    "severity": PATTERN_SEVERITY.get(pattern_type, "WARNING"),
                    "mas_basis": entry.mas_basis,
                    "suggestion": entry.suggestion,
                    "rule_id": None,
                })

    # ── Layer 2: active custom DB rules ───────────────────────────────────────
    try:
        rules = (
            await db.execute(
                select(ComplianceRule).where(ComplianceRule.is_active.is_(True))
            )
        ).scalars().all()

        for rule in rules:
            rule_text_lower = rule.rule_text.lower()
            # Substring match by default; regex if rule_text starts with "regex:"
            if rule_text_lower.startswith("regex:"):
                pattern = rule.rule_text[6:].strip()
                matched_here = bool(re.search(pattern, text_lower, re.IGNORECASE))
                matched_phrase = _extract_match(pattern, text_lower) if matched_here else ""
            else:
                # Extract quoted phrases or keywords from rule text
                quoted = re.findall(r'["\']([^"\']+)["\']', rule.rule_text)
                phrases = quoted or [rule.rule_text[:50]]
                matched_here = any(p.lower() in text_lower for p in phrases)
                matched_phrase = next((p for p in phrases if p.lower() in text_lower), "")

            if matched_here:
                flags.append({
                    "pattern_type": "CUSTOM_RULE",
                    "matched_phrase": matched_phrase,
                    "severity": rule.severity.value if hasattr(rule.severity, "value") else str(rule.severity),
                    "mas_basis": f"Custom rule: {rule.category}",
                    "suggestion": None,
                    "rule_id": str(rule.id),
                })
    except Exception as exc:
        logger.warning("DB error in check_field Layer 2: %s", exc)

    # ── Layer 3: LLM semantic check (MISSING_PRODUCT_QUALIFIER) ───────────────
    word_count = len(text.split())
    if word_count >= LLM_MIN_WORD_COUNT:
        try:
            llm_flag = await _llm_missing_qualifier_check(text, tone)
            if llm_flag:
                flags.append(llm_flag)
        except Exception as exc:
            logger.warning("LLM layer failed in check_field: %s", exc)

    # Deduplicate by (pattern_type, matched_phrase)
    seen: set[tuple[str, str]] = set()
    unique_flags: list[dict] = []
    for f in flags:
        key = (f["pattern_type"], f["matched_phrase"].lower())
        if key not in seen:
            seen.add(key)
            unique_flags.append(f)

    # ── Cache result ───────────────────────────────────────────────────────────
    try:
        await redis_client.setex(redis_key, CACHE_TTL_SECONDS, json.dumps(unique_flags))
    except Exception as exc:
        logger.warning("Redis write error in check_field: %s", exc)

    return {"flags": unique_flags, "cached": False}


# ── Cache invalidation ─────────────────────────────────────────────────────────

async def invalidate_field_compliance_cache(redis_client: redis.Redis) -> None:
    """Delete all cached field-compliance results.
    Called whenever a ComplianceRule is created, updated, or deactivated.
    """
    try:
        pattern = f"{CACHE_NS}:*"
        keys = []
        async for key in redis_client.scan_iter(pattern):
            keys.append(key)
        if keys:
            await redis_client.delete(*keys)
            logger.info("Invalidated %d field compliance cache entries", len(keys))
    except Exception as exc:
        logger.warning("Cache invalidation failed: %s", exc)


# ── Private helpers ────────────────────────────────────────────────────────────

def _normalise(text: str) -> str:
    """Normalise text for cache key generation."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _make_cache_key(normalised: str, tone: str) -> str:
    return hashlib.sha256(f"{normalised}:{tone}".encode()).hexdigest()


def _extract_match(pattern: str, text: str) -> str:
    """Extract the actual matched substring from text for display."""
    try:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(0).strip()
    except re.error:
        pass
    return ""


async def _llm_missing_qualifier_check(text: str, tone: str) -> dict | None:
    """Use Gemini to detect missing product qualifier (e.g., implies investment vs. insurance).
    Returns a flag dict or None if not flagged.
    """
    prompt = f"""Classify whether this marketing copy for an AIA Singapore insurance product has a "missing product qualifier" problem.
The text must NOT imply investment, deposit, savings account, or guaranteed financial return when the underlying product is insurance.

Text: "{text}"
Campaign tone: {tone}

Respond with ONLY valid JSON (no markdown):
{{"missing_qualifier": true|false, "confidence": 0.0-1.0, "suggestion": "brief alternative wording or null"}}"""

    model = _gemini_model()
    try:
        response = await model.generate_content(prompt, temperature=0.2)
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        result = json.loads(raw)
    except Exception:
        return None

    if result.get("missing_qualifier") and float(result.get("confidence", 0)) >= 0.7:
        return {
            "pattern_type": "MISSING_PRODUCT_QUALIFIER",
            "matched_phrase": "",
            "severity": "WARNING",
            "mas_basis": "Insurance Act — product identification requirements",
            "suggestion": result.get("suggestion") or None,
            "rule_id": None,
        }
    return None
