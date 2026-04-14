"""My Studio prompt builder (Phase B).

Companion to `.claude/plans/my_studio/03-ai-prompt-builder.md`.

Two public entry points:

  build_prompt(intent, style_inputs_typed, subject_description, variation_count)
      Deterministic per-intent skeleton + one Gemini-flash JSON call that
      rewrites the skeleton as a natural-language image-generation prompt and
      lists 3–5 plain-language labels for the "What the AI added" panel.

  analyze_source_subject(image_bytes) → str
      Single Gemini-flash vision call that returns a one-sentence subject
      description used to preserve identity language across Image→Image
      refinements. Best-effort — returns empty string on failure so the
      caller can fall back to a generic phrasing.

Image generation (Text→Image and Image→Image) is handled separately by
`studio_generation_worker.py`; this service only builds the prompt.
"""
from __future__ import annotations

import json
import logging

from pydantic import BaseModel

from app.schemas.studio import (
    ChangeBackgroundInputs,
    CustomInputs,
    EnhanceQualityInputs,
    MakeProfessionalInputs,
    VariationInputs,
)
from app.services.ai_service import _gemini_model

logger = logging.getLogger(__name__)


# Appended to every final prompt. Invisible to the user (per PRD §13.2) — this
# stays internal so the LLM can't paraphrase it away in the enrichment step.
_NEGATIVE_GUIDANCE = (
    "Negative guidance: blurry, low quality, distorted face, extra limbs, "
    "watermarks, text artifacts, logos, compression artifacts, duplicate subjects."
)

# Conservative default enrichment labels returned when the LLM step fails. The
# UI should still light up the "What the AI added" panel so the user has some
# signal of what enrichment tried to do.
_FALLBACK_ENRICHMENTS = [
    "Lighting description",
    "Composition framing",
    "Premium aesthetic cues",
]


# ── Skeleton builders (deterministic, one per intent) ─────────────────────────


def _subject_line(subject_description: str | None) -> str:
    """Returns the "Subject:" line for the skeleton, defaulting to a safe phrase
    when the caller didn't run subject analysis."""
    if subject_description:
        # Preserve the caller's phrasing verbatim — the enrichment LLM is told
        # to keep identity language intact.
        return f"Subject: {subject_description.strip().rstrip('.')}."
    return "Subject: the person in the source image."


def _skeleton_make_professional(
    s: MakeProfessionalInputs, subject_description: str | None
) -> str:
    settings = ", ".join(x.lower().replace("_", " ") for x in s.setting) or "neutral"
    return (
        "Intent: transform the input into a polished, professional portrait.\n"
        f"{_subject_line(subject_description)}\n"
        f"Setting: {settings}.\n"
        f"Attire: {'keep current' if s.attire == 'KEEP' else 'dress more formally'}.\n"
        f"Mood: {s.mood.lower()}.\n"
        f"User notes: {(s.notes or '-').strip()}."
    )


def _skeleton_change_background(
    s: ChangeBackgroundInputs, subject_description: str | None
) -> str:
    bg = s.new_background.lower().replace("_", " ")
    if s.new_background == "CUSTOM":
        bg = f"custom — {(s.description or '').strip()}"
    lighting = (
        "match original lighting" if s.lighting_match == "MATCH" else "relight for new background"
    )
    return (
        "Intent: replace the background while preserving the subject.\n"
        f"{_subject_line(subject_description)}\n"
        f"New background: {bg}.\n"
        f"Lighting: {lighting}."
    )


def _skeleton_enhance_quality(
    s: EnhanceQualityInputs, subject_description: str | None
) -> str:
    focus = ", ".join(x.lower().replace("_", " ") for x in s.focus_areas) or "general quality"
    res = {
        "SAME": "preserve original dimensions",
        "UPSCALE_2X": "double the linear resolution (2× upscale)",
        "UPSCALE_4X": "quadruple the linear resolution (4× upscale)",
    }[s.output_resolution]
    return (
        "Intent: improve image quality without changing subject or composition.\n"
        f"{_subject_line(subject_description)}\n"
        f"Focus areas: {focus}.\n"
        f"Resolution: {res}."
    )


def _skeleton_variation(s: VariationInputs, subject_description: str | None) -> str:
    keep = ", ".join(x.lower() for x in s.keep_consistent) or "nothing specific"
    direction = s.style_direction.lower().replace("_", " ")
    degree = "subtle" if s.difference_level < 33 else "moderate" if s.difference_level < 66 else "dramatic"
    return (
        "Intent: generate a creative variation inspired by the source image.\n"
        f"{_subject_line(subject_description)}\n"
        f"Degree of difference: {degree} (slider {s.difference_level}/90).\n"
        f"Keep consistent: {keep}.\n"
        f"Style direction: {direction}."
    )


def _skeleton_custom(s: CustomInputs, subject_description: str | None) -> str:
    ref_line = _subject_line(subject_description) if s.use_source_as_reference else "Subject: as described."
    return (
        "Intent: custom user request.\n"
        f"{ref_line}\n"
        f"User description: {s.description.strip()}\n"
        f"Use source image as reference: {'yes' if s.use_source_as_reference else 'no'}."
    )


_SKELETON_DISPATCH = {
    MakeProfessionalInputs: _skeleton_make_professional,
    ChangeBackgroundInputs: _skeleton_change_background,
    EnhanceQualityInputs: _skeleton_enhance_quality,
    VariationInputs: _skeleton_variation,
    CustomInputs: _skeleton_custom,
}


def _build_skeleton(style: BaseModel, subject_description: str | None) -> str:
    fn = _SKELETON_DISPATCH.get(type(style))
    if fn is None:
        raise TypeError(f"No skeleton builder for {type(style).__name__}")
    return fn(style, subject_description)  # type: ignore[arg-type]


# ── Enrichment LLM call ───────────────────────────────────────────────────────


_ENRICHMENT_INSTRUCTIONS = (
    "You are a professional image-prompt engineer. Given the structured brief "
    "below, rewrite it as a single natural-language prompt suitable for a "
    "diffusion-class image model.\n\n"
    "Constraints:\n"
    "- Under 120 words.\n"
    "- Include: subject language, lens / camera cues where relevant, lighting, "
    "composition framing, mood.\n"
    "- Preserve the 'Subject:' line's wording verbatim — do not paraphrase the "
    "subject description.\n"
    "- Do NOT include negative guidance in the output. (Server appends it.)\n"
    "- Do NOT echo the user's notes verbatim — integrate them naturally.\n\n"
    "Then, separately, list 3–5 SHORT (≤ 4 words each) labels describing what "
    "you added beyond the brief. These appear in a 'What the AI added' UI panel.\n\n"
    "Return JSON with keys `prompt` and `enrichments`.\n\n"
    "BRIEF:\n"
    "{skeleton}"
)


_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "prompt": {"type": "string"},
        "enrichments": {
            "type": "array",
            "items": {"type": "string"},
            "minItems": 1,
            "maxItems": 6,
        },
    },
    "required": ["prompt", "enrichments"],
}


async def _enrich_prompt(skeleton: str) -> tuple[str, list[str]]:
    """Single Gemini-flash call. Returns (prompt, enrichments) with fallback."""
    model = _gemini_model()
    try:
        response = await model.generate_content(
            _ENRICHMENT_INSTRUCTIONS.format(skeleton=skeleton),
            temperature=0.3,
            response_mime_type="application/json",
            response_schema=_RESPONSE_SCHEMA,
        )
        data = json.loads((response.text or "").strip())
        prompt = str(data.get("prompt", "")).strip()
        raw_enrichments = data.get("enrichments") or []
        enrichments = [str(x).strip() for x in raw_enrichments if str(x).strip()][:5]
        if not prompt:
            raise ValueError("empty prompt from enrichment model")
        if not enrichments:
            enrichments = _FALLBACK_ENRICHMENTS.copy()
        return prompt, enrichments
    except Exception as exc:  # noqa: BLE001 — prompt enrichment is best-effort
        logger.warning("studio prompt enrichment failed, using skeleton: %s", exc)
        return skeleton, _FALLBACK_ENRICHMENTS.copy()


# ── Public API ────────────────────────────────────────────────────────────────


async def build_prompt(
    *,
    style: BaseModel,
    subject_description: str | None = None,
    variation_count: int = 4,
) -> tuple[str, list[str]]:
    """Build the merged prompt + enrichment labels for a single workflow run.

    `style` is one of the typed MakeProfessionalInputs / ChangeBackgroundInputs /
    EnhanceQualityInputs / VariationInputs / CustomInputs models. `variation_count`
    is accepted for future use (e.g. to ask the LLM for richer language when 8
    variations are requested) but currently unused — kept in the signature to
    avoid a churn when we add that.
    """
    _ = variation_count  # reserved; see docstring
    skeleton = _build_skeleton(style, subject_description)
    prompt, enrichments = await _enrich_prompt(skeleton)
    return f"{prompt}\n\n{_NEGATIVE_GUIDANCE}", enrichments


_SUBJECT_PROMPT = (
    "You are a photo analyst. In one sentence (under 25 words), describe the "
    "primary visual subject of this image in neutral, factual language. "
    "Focus on visible attributes only — apparent age range (e.g. 'in her 30s'), "
    "broad ethnicity cues ONLY if visually obvious (e.g. 'South Asian'), "
    "gender presentation, clothing, expression or notable accessories.\n\n"
    "DO NOT include: names, identity guesses, emotional interpretation beyond "
    "expression, mood words, background description, lighting, or camera cues.\n\n"
    "If there is no clear human or product subject (e.g. abstract scene), return "
    "an empty string.\n\n"
    "Return ONLY the single sentence, no surrounding quotes or prefix."
)


async def analyze_source_subject(
    image_bytes: bytes, *, mime_type: str = "image/jpeg"
) -> str:
    """One-sentence subject description via Gemini-flash vision.

    Used by the prompt builder to preserve identity language across
    Image→Image refinements (doc 03 §Subject-identity preservation). Best
    effort — returns "" on any failure so the caller can fall back to the
    generic "Subject: the person in the source image." line.

    Constraints enforced client-side:
    - ≤ 25 words (≤ 200 chars hard trim).
    - No names / emotional interpretation (enforced via prompt).
    - "" when no clear subject present.

    `mime_type` should be one of the StudioImage mimes; HEIC support depends
    on Gemini accepting it — if it doesn't, the caller falls back to "" and
    the skeleton's generic subject line kicks in.
    """
    if not image_bytes:
        return ""
    try:
        model = _gemini_model()
        response = await model.generate_content(
            _SUBJECT_PROMPT,
            temperature=0.2,
            input_images=[image_bytes],
            image_mime_type=mime_type,
        )
        text = (response.text or "").strip().strip('"').strip("'")
        # Hard trim so a chatty response doesn't poison the merged prompt.
        if len(text) > 200:
            text = text[:197] + "…"
        return text
    except Exception as exc:  # noqa: BLE001 — best-effort
        logger.warning("studio subject analysis failed: %s", exc)
        return ""
