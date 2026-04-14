"""Shared Gemini-image helpers: seed-phrase diversity + retry/backoff + timeout.

Extracted from the poster workflow's private machinery so My Studio's
workflow can reuse the same resilient generation primitive (doc 04
§Single-variation generator). Kept separate from `ai_service.generate_image_gemini`
because this layer is opinionated about:

- **Seed-phrase diversity** — Gemini-flash-image has no temperature knob, so
  we append a short lighting/composition phrase per slot to produce visual
  variety without hitting rate limits from identical prompts.
- **Exponential backoff** — quota / transient 429s recover cleanly after a
  wait. We stay well under the 45s per-slot budget (doc 04 §Timeouts).
- **Hard timeout** — if Gemini never responds, the slot fails cleanly instead
  of hanging the whole run.

The poster workflow still has its own inline variant of this in
`poster_image_service._single_variant`. Unifying the two is a follow-up
refactor; doing it here first gives My Studio the polish without risking the
Phase D poster flow.
"""
from __future__ import annotations

import asyncio
import logging

from app.services.ai_service import GeminiImageError, generate_image_gemini

logger = logging.getLogger(__name__)


# ── Tunables ──────────────────────────────────────────────────────────────────

# Per-slot seed phrases (4 presets cycled modulo). See doc 04 §Single-variation
# generator — these add visual diversity across variations without needing a
# temperature knob on the image model.
SEED_PHRASES: tuple[str, ...] = (
    "soft natural lighting, understated composition",
    "bold directional lighting, confident composition",
    "warm golden-hour lighting, cinematic framing",
    "cool editorial lighting, minimal composition",
)

# Exponential-backoff waits (seconds) between retry attempts. Each entry is
# the sleep BEFORE the Nth retry; the attempt itself uses the remaining budget.
# Longer gaps on retry 2+ give 429-quota recovery room.
BACKOFF_DELAYS: tuple[float, ...] = (2.0, 5.0, 10.0)

# Hard timeout per Gemini image call (seconds). Doc 04 §Timeouts.
DEFAULT_TIMEOUT_SECONDS = 45

# Max retries on recoverable failures. We keep this conservative (2) because
# Gemini-flash-image tends to fail deterministically on the same prompt — a
# retry loop just burns quota. Policy/safety failures are non-retryable.
DEFAULT_MAX_RETRIES = 2


# ── Public entry ──────────────────────────────────────────────────────────────


async def generate_one_variation(
    *,
    prompt: str,
    input_images: list[bytes] | None,
    slot: int,
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
    max_retries: int = DEFAULT_MAX_RETRIES,
    seed_phrases: tuple[str, ...] = SEED_PHRASES,
) -> bytes:
    """Call Gemini image generation once, with seed diversity and retries.

    Args:
        prompt: The base merged prompt from the prompt builder. A seed phrase
            is appended per slot to create visual diversity.
        input_images: Optional source images for Image→Image mode. None →
            Text→Image.
        slot: 0-based slot index. Picks a deterministic seed phrase.
        timeout_seconds: Per-attempt hard timeout.
        max_retries: Additional attempts after the first on retriable errors.
        seed_phrases: Override the default cycle (tests / alternative modes).

    Returns:
        Raw PNG bytes from Gemini on success.

    Raises:
        GeminiImageError: Policy rejection (not retried) or exhausted retries
            on upstream failure. Caller marks the slot as failed.
        asyncio.TimeoutError: Per-attempt timeout on the final attempt; caller
            treats as a slot failure.
    """
    seed = seed_phrases[slot % len(seed_phrases)]
    seeded_prompt = f"{prompt}\n\n{seed}"
    last_exc: Exception | None = None

    for attempt in range(max_retries + 1):
        try:
            return await asyncio.wait_for(
                generate_image_gemini(prompt=seeded_prompt, input_images=input_images),
                timeout=timeout_seconds,
            )
        except GeminiImageError as exc:
            # Content-policy rejections are terminal — retrying the same prompt
            # will fail the same way and wastes quota.
            if exc.error_code == "AI_CONTENT_POLICY":
                logger.warning(
                    "gemini_slot_policy_rejected",
                    extra={"slot": slot, "error_code": exc.error_code, "attempt": attempt},
                )
                raise
            last_exc = exc
            logger.warning(
                "gemini_slot_upstream_error",
                extra={"slot": slot, "error_code": exc.error_code, "attempt": attempt},
            )
        except asyncio.TimeoutError as exc:
            last_exc = exc
            logger.warning(
                "gemini_slot_timeout",
                extra={"slot": slot, "attempt": attempt, "timeout_s": timeout_seconds},
            )
        except Exception as exc:  # noqa: BLE001 — retry anything transient
            last_exc = exc
            logger.warning(
                "gemini_slot_unexpected_error",
                extra={"slot": slot, "attempt": attempt, "error": str(exc)},
            )

        # Decide whether to retry or give up.
        if attempt >= max_retries:
            break
        delay_idx = min(attempt, len(BACKOFF_DELAYS) - 1)
        await asyncio.sleep(BACKOFF_DELAYS[delay_idx])

    # Exhausted retries — surface as a generic upstream error.
    raise GeminiImageError(
        f"Exhausted {max_retries + 1} attempts: {last_exc!r}",
        error_code="AI_UPSTREAM_ERROR",
    )
