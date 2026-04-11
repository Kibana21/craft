import uuid
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.artifact import Artifact
from app.models.compliance_rule import ComplianceRule
from app.models.compliance_check import ComplianceCheck
from app.models.enums import ComplianceSeverity
from app.services.disclaimer_service import check_disclaimers


async def score_artifact(db: AsyncSession, artifact_id: uuid.UUID) -> dict:
    """Score an artifact against all active compliance rules.
    Returns full breakdown and updates the artifact's compliance_score.
    """
    # Load artifact
    artifact = (
        await db.execute(select(Artifact).where(Artifact.id == artifact_id))
    ).scalar_one_or_none()

    if artifact is None or artifact.content is None:
        return {"score": 100, "breakdown": [], "suggestions": []}

    content = artifact.content
    text = _extract_all_text(content)
    product = str(content.get("product", ""))

    # 1. Run compliance rules
    rules = (
        await db.execute(
            select(ComplianceRule).where(ComplianceRule.is_active.is_(True))
        )
    ).scalars().all()

    rule_results = []
    for rule in rules:
        passed = _check_rule(text, rule.rule_text, rule.category)
        rule_results.append({
            "rule_id": str(rule.id),
            "rule_text": rule.rule_text,
            "category": rule.category,
            "severity": rule.severity.value,
            "passed": passed,
            "details": None if passed else f"Content may violate: {rule.rule_text[:80]}...",
        })

    # 2. Check disclaimers
    disclaimer_results = check_disclaimers(content, product)
    missing_disclaimers = [d for d in disclaimer_results if not d["present"]]

    # 3. Compute score
    score = 100.0

    for result in rule_results:
        if not result["passed"]:
            if result["severity"] == "error":
                score -= 15
            else:
                score -= 5

    for _ in missing_disclaimers:
        score -= 20

    score = max(score, 0)

    # 4. Generate suggestions
    suggestions = []
    for result in rule_results:
        if not result["passed"]:
            suggestions.append(f"Review content for: {result['category'].replace('_', ' ')}")

    for d in missing_disclaimers:
        suggestions.append(f"Add required disclaimer: \"{d['disclaimer'][:60]}...\"")

    # 5. Build breakdown
    breakdown = {
        "rules": rule_results,
        "disclaimers": disclaimer_results,
        "suggestions": suggestions,
    }

    # 6. Update artifact score
    artifact.compliance_score = score
    await db.flush()

    # 7. Store audit trail
    check = ComplianceCheck(
        artifact_id=artifact_id,
        score=score,
        breakdown=breakdown,
    )
    db.add(check)
    await db.flush()

    return {
        "score": score,
        "breakdown": breakdown,
        "suggestions": suggestions,
    }


def _extract_all_text(content: dict) -> str:
    """Extract all text fields from artifact content."""
    texts = []
    for key, value in content.items():
        if key in ("locks", "remixed_from", "formats", "frames", "type", "format"):
            continue
        if isinstance(value, str):
            texts.append(value)
    return " ".join(texts).lower()


def _check_rule(text: str, rule_text: str, category: str) -> bool:
    """Check if content complies with a rule.
    Returns True if the rule passes (content is compliant).
    """
    text_lower = text.lower()

    if category == "prohibited_claim":
        # Check for prohibited words/phrases mentioned in the rule
        prohibited_words = _extract_prohibited_words(rule_text)
        for word in prohibited_words:
            if word.lower() in text_lower:
                return False
        return True

    elif category == "competitor_reference":
        # Check for competitor brand names
        competitors = ["prudential", "manulife", "great eastern", "ntuc income",
                       "tokio marine", "aviva", "zurich", "axa"]
        for comp in competitors:
            if comp in text_lower:
                return False
        return True

    elif category == "disclaimer_required":
        # Disclaimer checks are handled separately
        return True

    elif category == "benefit_illustration":
        # Check for phrases implying guaranteed returns without disclaimer
        risky_phrases = ["guaranteed return", "guaranteed benefit", "sure return",
                        "definitely get", "100% certain"]
        for phrase in risky_phrases:
            if phrase in text_lower:
                return False
        return True

    elif category == "testimonial":
        # Check for testimonial without disclaimer
        testimonial_indicators = ["my experience", "i received", "i got",
                                  "personally benefited", "my claim"]
        for indicator in testimonial_indicators:
            if indicator in text_lower:
                return False
        return True

    return True


def _extract_prohibited_words(rule_text: str) -> list[str]:
    """Extract key prohibited words/phrases from a rule's text."""
    # Look for words in quotes
    quoted = re.findall(r"['\"]([^'\"]+)['\"]", rule_text)
    if quoted:
        return quoted

    # Fallback: extract key nouns after "not" or "do not"
    prohibited = []
    words = rule_text.lower().split()
    for i, word in enumerate(words):
        if word in ("not", "never", "avoid") and i + 1 < len(words):
            prohibited.append(words[i + 1])

    return prohibited or ["guaranteed"]
