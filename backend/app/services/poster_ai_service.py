"""AI service functions for the Poster Wizard.

Phase B: generate-brief, generate-appearance-paragraph,
         generate-scene-description, copy-draft-all,
         copy-draft-field, tone-rewrite,
         classify-structural-change (keyword + LLM fallback).

Phase B/C: generate-composition-prompt (deterministic + LLM style-sentence).

All prompts come from PosterPromptBuilder (prompt_builder.py).
Temperatures per doc 03:
  0.3 → brief, appearance, scene, copy-draft-all, copy-draft-field, classifier
  0.5 → tone-rewrite
"""
import json
import logging
import re

from app.services.ai_service import _gemini_model
from app.services.prompt_builder import PosterPromptBuilder

logger = logging.getLogger(__name__)

# ── JSON helper ────────────────────────────────────────────────────────────────


def _strip_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return text


# ── Phase B service functions ──────────────────────────────────────────────────


async def generate_poster_brief(
    campaign_objective: str,
    target_audience: str,
    tone: str,
    call_to_action: str,
    existing_brief: str | None = None,
) -> str:
    """Generate a 60–120 word narrative brief paragraph (temperature 0.3)."""
    prompt = PosterPromptBuilder.brief_synthesis(
        campaign_objective=campaign_objective,
        target_audience=target_audience,
        tone=tone,
        call_to_action=call_to_action,
        existing_brief=existing_brief,
    )
    model = _gemini_model()
    response = await model.generate_content(prompt, temperature=0.3)
    text = response.text.strip()
    if not text:
        raise ValueError("Empty response from Gemini")
    return text


async def generate_appearance_paragraph(
    appearance_keywords: str,
    expression_mood: str,
    posture_framing: str,
    brief_context: str | None = None,
) -> tuple[str, int]:
    """Expand appearance keywords into a 40–80 word image-prompt paragraph.

    Returns (paragraph, word_count).
    """
    prompt = PosterPromptBuilder.appearance_paragraph(
        appearance_keywords=appearance_keywords,
        expression_mood=expression_mood,
        posture_framing=posture_framing,
        brief_context=brief_context,
    )
    model = _gemini_model()
    response = await model.generate_content(prompt, temperature=0.3)
    paragraph = response.text.strip()
    if not paragraph:
        raise ValueError("Empty response from Gemini")
    word_count = len(paragraph.split())
    return paragraph, word_count


async def generate_scene_description(
    visual_style: str,
    brief_context: str | None = None,
    seed_hint: str | None = None,
) -> str:
    """Generate a 40–90 word non-human scene description for image generation."""
    prompt = PosterPromptBuilder.scene_description(
        visual_style=visual_style,
        seed_hint=seed_hint,
        brief_context=brief_context,
    )
    model = _gemini_model()
    response = await model.generate_content(prompt, temperature=0.3)
    text = response.text.strip()
    if not text:
        raise ValueError("Empty response from Gemini")
    return text


async def copy_draft_all(
    brief: str,
    tone: str,
    campaign_objective: str,
    audience: str | None = None,
) -> dict[str, str]:
    """Draft all four copy fields via Gemini structured output (temperature 0.3).

    Uses response_mime_type='application/json' + response_schema to eliminate
    parse failures as specified in doc 03.
    Returns dict: {headline, subheadline, body, cta_text}.
    """
    prompt = PosterPromptBuilder.copy_draft_all(
        brief=brief,
        tone=tone,
        campaign_objective=campaign_objective,
        audience=audience,
    )
    model = _gemini_model()
    try:
        response = await model.generate_content(
            prompt,
            temperature=0.3,
            response_mime_type="application/json",
            response_schema=PosterPromptBuilder.COPY_JSON_SCHEMA,
        )
        data = json.loads(response.text)
    except Exception:
        # Fallback: plain text response, strip JSON manually
        response = await model.generate_content(prompt, temperature=0.3)
        data = json.loads(_strip_json(response.text))

    return {
        "headline":    str(data.get("headline", "")),
        "subheadline": str(data.get("subheadline", "")),
        "body":        str(data.get("body", "")),
        "cta_text":    str(data.get("cta_text", "")),
    }


async def copy_draft_field(
    field: str,
    brief: str,
    tone: str,
    current_values: dict[str, str],
) -> str:
    """Regenerate a single copy field given sibling context (temperature 0.3)."""
    prompt = PosterPromptBuilder.copy_draft_field(
        field=field,
        brief=brief,
        tone=tone,
        current_values=current_values,
    )
    model = _gemini_model()
    response = await model.generate_content(prompt, temperature=0.3)
    return response.text.strip()


async def improve_brief_field(
    field: str,
    *,
    title: str = "",
    campaign_objective: str | None = None,
    target_audience: str = "",
    tone: str | None = None,
    call_to_action: str = "",
    narrative: str = "",
) -> str:
    """Single-field AI improvement for Step 1 brief fields (temperature 0.4)."""
    prompt = PosterPromptBuilder.improve_brief_field(
        field=field,
        title=title,
        campaign_objective=campaign_objective,
        target_audience=target_audience,
        tone=tone,
        call_to_action=call_to_action,
        narrative=narrative,
    )
    model = _gemini_model()
    response = await model.generate_content(prompt, temperature=0.4)
    value = response.text.strip()
    if not value:
        raise ValueError("Empty response from Gemini")
    return value


async def improve_subject_field(
    field: str,
    *,
    appearance_keywords: str = "",
    expression_mood: str = "",
    posture_framing: str | None = None,
    brief_context: str | None = None,
) -> str:
    """Single-field AI improvement for Step 2 human-model fields (temperature 0.4)."""
    prompt = PosterPromptBuilder.improve_subject_field(
        field=field,
        appearance_keywords=appearance_keywords,
        expression_mood=expression_mood,
        posture_framing=posture_framing,
        brief_context=brief_context,
    )
    model = _gemini_model()
    response = await model.generate_content(prompt, temperature=0.4)
    value = response.text.strip()
    if not value:
        raise ValueError("Empty response from Gemini")
    return value


async def tone_rewrite(
    rewrite_tone: str,
    copy_values: dict[str, str],
) -> dict[str, str]:
    """Rewrite all copy fields with a new tone direction (temperature 0.5).

    Uses response_mime_type='application/json' + response_schema.
    Returns dict with same keys as copy_values.
    """
    prompt = PosterPromptBuilder.tone_rewrite(
        headline=copy_values.get("headline", ""),
        subheadline=copy_values.get("subheadline", ""),
        body=copy_values.get("body", ""),
        cta_text=copy_values.get("cta_text", ""),
        rewrite_tone=rewrite_tone,
    )
    model = _gemini_model()
    try:
        response = await model.generate_content(
            prompt,
            temperature=0.5,
            response_mime_type="application/json",
            response_schema=PosterPromptBuilder.COPY_JSON_SCHEMA,
        )
        data = json.loads(response.text)
    except Exception:
        response = await model.generate_content(prompt, temperature=0.5)
        data = json.loads(_strip_json(response.text))

    return {
        "headline":    str(data.get("headline", copy_values.get("headline", ""))),
        "subheadline": str(data.get("subheadline", copy_values.get("subheadline", ""))),
        "body":        str(data.get("body", copy_values.get("body", ""))),
        "cta_text":    str(data.get("cta_text", copy_values.get("cta_text", ""))),
    }


# ── Phase B/C — Composition prompt assembler ──────────────────────────────────


async def build_style_sentence(
    visual_style: str,
    palette: list[str],
    tone: str,
) -> str:
    """LLM sub-call: generate a ≤ 30-word style sentence (temperature 0.3).

    Returns a fallback deterministic sentence if Gemini is unavailable.
    """
    # Describe the palette in natural language
    if palette:
        palette_descriptor = f"{', '.join(palette[:3])} colour scheme"
    else:
        palette_descriptor = "AIA red (#D0103A) and dark charcoal colour scheme"

    prompt = PosterPromptBuilder.style_sentence(
        visual_style=visual_style,
        palette_descriptor=palette_descriptor,
        tone=tone,
    )
    try:
        model = _gemini_model()
        response = await model.generate_content(prompt, temperature=0.3)
        sentence = response.text.strip().rstrip(".")
        if sentence:
            return sentence + "."
    except Exception as exc:
        logger.warning("style-sentence Gemini call failed: %s", exc)

    # Deterministic fallback
    style_adjectives = {
        "CLEAN_CORPORATE": "clean, corporate",
        "WARM_HUMAN": "warm, human-centred",
        "BOLD_HIGH_CONTRAST": "bold, high-contrast",
        "EDITORIAL": "editorial, magazine-quality",
        "MINIMALIST": "minimal, spacious",
        "PHOTOREALISTIC": "photorealistic",
        "EDITORIAL_GRAPHIC": "editorial graphic",
        "ILLUSTRATED": "illustrated",
        "ABSTRACT": "abstract",
    }
    tone_adjectives = {
        "PROFESSIONAL": "authoritative",
        "INSPIRATIONAL": "uplifting",
        "WARM": "approachable",
        "URGENT": "urgent",
        "EMPATHETIC": "empathetic",
    }
    style_adj = style_adjectives.get(visual_style, visual_style.lower().replace("_", " "))
    tone_adj = tone_adjectives.get(tone, "professional")
    return f"A {style_adj} composition that feels {tone_adj}."


def build_composition_prompt(
    brief_narrative: str,
    subject_type: str,
    subject_description: str,
    copy_headline: str,
    copy_cta: str,
    format_name: str,
    layout_template: str,
    visual_style: str,
    palette: list[str],
    style_sentence: str = "",
    tone: str = "",
    brand_tagline: str = "",
    # Additional wizard context — injected so the merged prompt reflects
    # everything the user set in Steps 1–3, not just narrative + headline.
    campaign_title: str = "",
    campaign_objective: str = "",
    target_audience: str = "",
    brief_cta: str = "",
    copy_subheadline: str = "",
    copy_body: str = "",
) -> tuple[str, str]:
    """Deterministic composition prompt assembly (doc 03 §Composition Assembler).

    Returns (merged_prompt, style_sentence).
    Call build_style_sentence() first and pass the result as style_sentence.
    """
    palette_hex_list = ", ".join(palette) if palette else "#D0103A, #1A1A18, #FFFFFF"
    primary_accent = palette[0] if palette else "#D0103A"

    format_descriptions = {
        "PORTRAIT":  "4:5 portrait (1080 × 1350 px)",
        "SQUARE":    "1:1 square (1080 × 1080 px)",
        "LANDSCAPE": "16:9 landscape (1920 × 1080 px)",
        "STORY":     "9:16 story / reel (1080 × 1920 px)",
        "CUSTOM":    "custom dimensions",
    }
    format_description = format_descriptions.get(format_name, format_name.lower())

    layout_descriptions = {
        "HERO_DOMINANT": "hero image dominant, text in lower third",
        "SPLIT":         "left–right split, image on one side and text on the other",
        "FRAME_BORDER":  "framed with decorative border, centred content",
        "TYPOGRAPHIC":   "typography-led, bold text foreground",
        "FULL_BLEED":    "full-bleed image, copy overlaid with contrast treatment",
    }
    layout_description = layout_descriptions.get(
        layout_template, layout_template.lower().replace("_", " ")
    )

    # Subject block from Step 2 content
    if subject_type == "HUMAN_MODEL":
        subject_block = (
            f"{subject_description}." if subject_description else "Professional human model."
        )
    elif subject_type == "PRODUCT_ASSET":
        subject_block = (
            "Use uploaded reference image as the primary product element. "
            + (f"Details: {subject_description}." if subject_description else "")
        )
    else:  # SCENE_ABSTRACT
        subject_block = (
            f"Scene: {subject_description}. No people. Visual style: {visual_style}."
            if subject_description
            else f"Abstract scene. Visual style: {visual_style}."
        )

    # Headline word count for copy-placement block
    headline_words = len(copy_headline.split()) if copy_headline else 0
    headline_note = f"{headline_words} words" if headline_words else "TBD"

    tagline_block = (
        f'\nBrand tagline (if provided): "{brand_tagline}".' if brand_tagline else ""
    )
    tone_block = (
        f"\nOverall mood aligns with the {tone} tone." if tone else ""
    )

    merged_prompt = (
        f"{style_sentence}\n\n"
        f"Format: {format_description}. Layout: {layout_description}.\n\n"
        f"Subject: {subject_block}\n\n"
        "Copy placement:\n"
        f"  - Headline ({headline_note}) as dominant text.\n"
        "  - Subheadline supporting it below.\n"
        "  - CTA treated as a button.\n"
        "  - Body as supporting sentence(s).\n\n"
        f"Colour palette: {palette_hex_list}. Primary accent: {primary_accent}."
        f"\n\nBrand: AIA Singapore.{tagline_block}{tone_block}\n\n"
        "No competitor branding. Professional photography or illustration quality. "
        "No embedded text — copy will be overlaid separately."
    )
    # Campaign context block — assembled from Step 1 + Step 3 so the image
    # generator sees the full picture (goal, audience, tone, copy body), not
    # just the headline + narrative.
    context_lines: list[str] = []
    if campaign_title:
        context_lines.append(f'Campaign title: "{campaign_title.strip()}"')
    if campaign_objective:
        context_lines.append(
            f"Objective: {campaign_objective.lower().replace('_', ' ')}"
        )
    if target_audience:
        context_lines.append(f"Target audience: {target_audience.strip()}")
    if brief_cta:
        context_lines.append(f'Primary call to action: "{brief_cta.strip()}"')
    if brief_narrative:
        # Pass the narrative in full — it's already length-bounded by the brief
        # form (60–120 words, per PRD). Trimming here drops useful context and
        # tends to end the prompt mid-sentence, which reads as a bug to users.
        context_lines.append(f"Narrative: {brief_narrative.strip()}")
    if copy_subheadline:
        context_lines.append(f'Subheadline: "{copy_subheadline.strip()}"')
    if copy_body:
        context_lines.append(f"Body copy: {copy_body.strip()}")

    if context_lines:
        merged_prompt += "\n\nCampaign context:\n  - " + "\n  - ".join(context_lines)

    return merged_prompt, style_sentence


# ── Structural-change classifier ───────────────────────────────────────────────

# Keyword patterns from doc 03 §9 (compiled once at import time)
_COPY_PATTERNS = [
    re.compile(r"\bchange (the )?(headline|subhead|body|cta|copy)\b", re.IGNORECASE),
    re.compile(r"\brewrite (the )?copy\b", re.IGNORECASE),
    re.compile(r"\bchange (the )?text\b", re.IGNORECASE),
]
_LAYOUT_PATTERNS = [
    re.compile(r"\bdifferent layout\b", re.IGNORECASE),
    re.compile(r"\bchange (the )?layout\b", re.IGNORECASE),
    re.compile(r"\bswap (image|text) (side|position)\b", re.IGNORECASE),
]
_SUBJECT_PATTERNS = [
    re.compile(r"\bchange (the )?(person|model|subject|product)\b", re.IGNORECASE),
    re.compile(r"\buse (a )?different (photo|image|model)\b", re.IGNORECASE),
]
_FORMAT_PATTERNS = [
    re.compile(r"\bdifferent format\b", re.IGNORECASE),
    re.compile(r"\b(portrait|landscape|square|story) format\b", re.IGNORECASE),
]

_IMPERATIVE_VERBS = re.compile(
    r"\b(change|make|add|remove|replace|update|rewrite|adjust|move|flip|rotate|"
    r"crop|resize|zoom|shift|brighten|darken|lighten|saturate|desaturate)\b",
    re.IGNORECASE,
)

_PATTERN_TO_TARGET: list[tuple[list[re.Pattern], str]] = [
    (_COPY_PATTERNS,    "STEP_3_COPY"),
    (_LAYOUT_PATTERNS,  "STEP_4_COMPOSITION"),
    (_FORMAT_PATTERNS,  "STEP_4_COMPOSITION"),
    (_SUBJECT_PATTERNS, "STEP_2_SUBJECT"),
]


async def classify_structural_change(message: str) -> dict:
    """Keyword short-circuit → LLM fallback structural-change classifier.

    Returns dict: {is_structural, target, confidence}.

    Fast path: any keyword match → immediate result (confidence 0.9).
    LLM fallback: only when no keyword matches AND the message is > 10 words
    with an imperative verb (likely ambiguous intent).
    """
    # ── Fast path: keyword matching ───────────────────────────────────────────
    for patterns, target in _PATTERN_TO_TARGET:
        for pattern in patterns:
            if pattern.search(message):
                return {"is_structural": True, "target": target, "confidence": 0.9}

    # ── LLM fallback: ambiguous cases ─────────────────────────────────────────
    word_count = len(message.split())
    has_imperative = bool(_IMPERATIVE_VERBS.search(message))
    if word_count > 10 and has_imperative:
        try:
            prompt = PosterPromptBuilder.structural_change_classifier(message)
            model = _gemini_model()
            response = await model.generate_content(
                prompt,
                temperature=0.3,
                response_mime_type="application/json",
                response_schema={
                    "type": "object",
                    "properties": {
                        "intent":     {"type": "string"},
                        "confidence": {"type": "number"},
                    },
                    "required": ["intent", "confidence"],
                },
            )
            data = json.loads(response.text)
            intent = data.get("intent", "VISUAL_ADJUSTMENT")
            confidence = float(data.get("confidence", 0.5))

            if intent != "VISUAL_ADJUSTMENT" and confidence >= 0.7:
                target_map = {
                    "COPY_CHANGE":    "STEP_3_COPY",
                    "LAYOUT_CHANGE":  "STEP_4_COMPOSITION",
                    "FORMAT_CHANGE":  "STEP_4_COMPOSITION",
                    "SUBJECT_CHANGE": "STEP_2_SUBJECT",
                }
                target = target_map.get(intent)
                return {"is_structural": True, "target": target, "confidence": confidence}
        except Exception as exc:
            logger.warning("structural-change LLM fallback failed: %s", exc)

    return {"is_structural": False, "target": None, "confidence": 0.9}
