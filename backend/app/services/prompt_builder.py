def build_image_prompt(
    product: str,
    audience: str,
    tone: str,
    artifact_type: str,
    aspect_ratio: str,
    brand_colors: dict | None = None,
) -> str:
    colors = brand_colors or {"primary": "#D0103A", "secondary": "#1A1A18"}
    aspect_map = {
        "1:1": "1:1 square",
        "4:5": "4:5 portrait",
        "9:16": "9:16 vertical story",
        "800x800": "800x800 square",
    }
    aspect_desc = aspect_map.get(aspect_ratio, aspect_ratio)

    prompt = f"""Create a professional insurance marketing {artifact_type} for AIA Singapore.
Product: {product}.
Target audience: {audience}.
Tone: {tone}. Style: Modern minimal.
Must use brand colors: red {colors['primary']} as accent, dark {colors['secondary']} for contrast.
Include space for logo placement top-right.
Do not include any text — text will be overlaid separately.
Aspect ratio: {aspect_desc}.
Do not include competitor logos or branding.
High quality, professional photography style, warm lighting."""

    return prompt.strip()


def build_tagline_prompt(
    product: str,
    audience: str,
    tone: str,
    count: int,
) -> str:
    return f"""Generate {count} compelling marketing taglines for an AIA Singapore insurance product.

Product: {product}
Target audience: {audience}
Tone: {tone}

Requirements:
- Each tagline should be 5-12 words
- Must be suitable for a marketing poster or social media
- Must comply with Singapore MAS regulations (no guaranteed returns claims)
- Should evoke trust, protection, and family values
- Vary the style: some emotional, some factual, some aspirational

Return ONLY a JSON array of strings, no other text. Example:
["Tagline one here", "Tagline two here"]"""


def build_presenter_appearance_prompt(keywords: str, speaking_style: str) -> str:
    return f"""You are helping create a video presenter description for a professional insurance marketing video for AIA Singapore.

Based on the appearance keywords and speaking style below, write a detailed, natural-language paragraph (2-4 sentences) describing the presenter.

The paragraph must cover:
1. Physical appearance (skin tone, hair colour and style, eye colour, build)
2. Clothing and professional attire (colour, style, formality level)
3. Setting or background context
4. Demeanour, manner, and expression consistent with the speaking style

Appearance keywords: {keywords}
Speaking style: {speaking_style}

Requirements:
- Write in prose, NOT bullet points
- Be specific and visual — this paragraph will be fed directly into an AI video model prompt
- The description should produce a consistent, professional presenter suitable for financial services
- Do not include names or references to specific real people
- Keep it under 100 words

Return ONLY the description paragraph, no preamble or explanation."""


def build_script_draft_prompt(brief: dict) -> str:
    target_words = round(brief["target_duration_seconds"] / 60 * 150)
    video_brief_line = f"\n- Video brief: {brief['video_brief']}" if brief.get("video_brief") else ""
    return f"""You are writing a professional video script for an AIA Singapore insurance marketing video.

Brief:
- Product: {brief.get("product", "AIA insurance")}
- Target audience: {brief.get("target_audience", "working adults in Singapore")}
- Key message: {brief.get("key_message", "protect your family's future")}
- Call to action: {brief.get("cta_text", "Learn more at aia.com.sg")}
- Tone: {brief.get("tone", "professional")}
- Target duration: {brief.get("target_duration_seconds", 60)} seconds (~{target_words} words at 150 wpm){video_brief_line}

Structure the script in three sections:
1. **Intro** (hook — grab attention in the first 5 seconds)
2. **Body** (key message and product benefit)
3. **CTA** (clear call to action)

Requirements:
- Write ONLY the spoken words — no stage directions, no [PAUSE] markers, no scene notes
- Aim for approximately {target_words} words
- Comply with MAS regulations: no guaranteed returns, no unsubstantiated claims
- Natural, conversational flow suitable for a teleprompter read
- Brand: {brief.get("brand_name", "AIA Singapore")}

Return ONLY the script text, no preamble, no section headers."""


def build_script_rewrite_prompt(content: str, tone: str) -> str:
    tone_instructions = {
        "warm": (
            "Rewrite in a warm, personal tone. Use first-person plural ('we', 'your family'). "
            "Soften corporate language. Make it feel like advice from a trusted friend."
        ),
        "professional": (
            "Rewrite in a formal, authoritative tone. Use precise language. "
            "Remove colloquialisms. Suitable for a senior financial advisor speaking to high-net-worth clients."
        ),
        "shorter": (
            "Condense the script to approximately 70% of its current length. "
            "Keep the core message and CTA intact. Remove filler sentences and redundant phrases."
        ),
        "stronger_cta": (
            "Rewrite only the final 20–30% of the script. Make the call-to-action more urgent and specific. "
            "Use action verbs. Keep the intro and body unchanged."
        ),
    }
    instruction = tone_instructions.get(tone, "Rewrite in a clear, professional tone.")

    return f"""You are rewriting a professional insurance marketing video script for AIA Singapore.

Instruction: {instruction}

Original script:
{content}

Requirements:
- Return ONLY the rewritten script text
- Do not add section headers or stage directions
- Comply with MAS regulations: no guaranteed returns, no unsubstantiated claims
- Maintain the overall structure unless the instruction says otherwise"""


def build_scene_split_prompt(script: str, target_duration_seconds: int, presenter: dict | None = None, brand_kit: dict | None = None) -> str:
    # Target: each scene < 7s, speaker talking for ~5-6s, ~1s visual tail.
    # At 150 wpm = 2.5 words/sec → each scene ~ 12-15 words of dialogue.
    scene_count_min = max(2, round(target_duration_seconds / 10))
    scene_count_max = max(3, round(target_duration_seconds / 6))
    scene_count = f"{scene_count_min}–{scene_count_max}"

    presenter_block = ""
    if presenter:
        speaking_style = presenter.get("speaking_style", "professional")
        appearance = presenter.get("full_appearance_description", "")
        presenter_block = f"""
Presenter context:
- Speaking style: {speaking_style}
- Appearance: {appearance}
The presenter is the constant visual anchor across all scenes. Settings and camera framings should complement the presenter's style and appearance. The presenter should appear to be speaking fluidly throughout — no scene should end mid-sentence or cut the presenter off abruptly.
"""

    brand_block = ""
    if brand_kit:
        primary = brand_kit.get("primary_color", "#D0103A")
        secondary = brand_kit.get("secondary_color", "#1A1A18")
        tone = brand_kit.get("tone", "professional")
        brand_block = f"""
Brand context:
- Primary color: {primary}
- Secondary color: {secondary}
- Brand tone: {tone}
Settings should reflect the brand's visual identity where possible (e.g. clean modern spaces, brand-consistent lighting).
"""

    return f"""You are splitting a professional insurance marketing video script into short scenes for an AI video generation model.

Target video duration: {target_duration_seconds} seconds
Target number of scenes: {scene_count}

CRITICAL DURATION RULE: Each scene must be short enough to fit within 7 seconds of video.
- Dialogue should take approximately 5–6 seconds to speak naturally (≈ 12–15 words at 150 wpm).
- Leave ~1 second of visual space at the end of each scene after the last word — the speaker finishes their line and the camera holds briefly. Do NOT end dialogue on the very last frame.
- If any scene's dialogue would take longer than 6 seconds, split it further.
- Dialogue must NOT be cut mid-sentence — each scene's dialogue must be a grammatically complete thought.

Script:
{script}
{presenter_block}{brand_block}
Scene continuity rules:
- Settings should form a coherent visual narrative — they can be in the same location seen from different angles, or flow naturally from one space to an adjacent one (e.g. lobby → corridor → meeting room). Avoid random unrelated locations.
- Camera framings must vary across consecutive scenes to maintain visual interest.
- Each scene should feel like it belongs to the same video — consistent lighting mood, tone, and production style.

For each scene, provide a JSON object with exactly these fields:
- "name": short scene title (3–6 words)
- "dialogue": the portion of the script spoken in this scene (verbatim from the script — do not add or remove words)
- "setting": vivid, specific visual setting (e.g. "Modern glass-walled office, city skyline behind, warm afternoon light") — be consistent with prior scenes' locations
- "camera_framing": one of WIDE_SHOT, MEDIUM_SHOT, CLOSE_UP, OVER_THE_SHOULDER, TWO_SHOT, AERIAL, POV
- "estimated_seconds": integer — your estimate of how long this scene will take to play (speaking time + ~1s visual tail). Must be ≤ 7.

Rules:
- Every word of the script must appear in exactly one scene's dialogue — no duplication, no omission
- Vary camera framings — never the same framing for two consecutive scenes
- Return ONLY a JSON object with a "scenes" array, no other text

Example format:
{{"scenes": [{{"name": "Opening hook", "dialogue": "...", "setting": "...", "camera_framing": "WIDE_SHOT", "estimated_seconds": 5}}]}}"""


def build_keyword_suggestion_prompt(name: str, age_range: str, speaking_style: str) -> str:
    """Return a prompt that asks Gemini to produce comma-separated appearance keywords."""
    return f"""You are helping a user create an AI video presenter for an AIA Singapore insurance marketing video.

Based on the presenter details below, generate a list of specific, visual appearance keywords that describe this presenter's physical features, clothing, and setting.

Presenter name: {name}
Age range: {age_range}
Speaking style: {speaking_style}

Requirements:
- Generate 6–10 comma-separated keywords/phrases
- Cover: ethnicity/skin tone, hair (colour and style), facial features, clothing (colour, style, formality), background setting
- The presenter should look professional and trustworthy, appropriate for a financial services marketing video in Singapore
- Be specific and visual — keywords like "medium-length black hair" rather than "nice hair"
- Do NOT include the presenter's name in the keywords

Return ONLY the comma-separated list, no preamble, no bullet points, no explanation."""


def build_dialogue_refinement_prompt(dialogue: str, scene_name: str) -> str:
    """Return a prompt that tightens and improves a scene's spoken dialogue."""
    return f"""You are editing a scene dialogue for a professional AIA Singapore insurance marketing video.

Scene name: {scene_name}

Current dialogue:
{dialogue}

Improve the dialogue by:
- Making it more natural and engaging to deliver on camera
- Tightening wordy or awkward phrasing
- Keeping the same core message and approximate length
- Maintaining MAS compliance (no guaranteed returns, no unsubstantiated claims)
- Suitable for the speaking style of a financial services presenter

Return ONLY the improved dialogue text, no preamble, no explanation, no stage directions."""


def build_setting_suggestion_prompt(dialogue: str, scene_name: str) -> str:
    """Return a prompt that suggests a vivid visual setting for a scene."""
    return f"""You are designing the visual setting for a scene in an AIA Singapore insurance marketing video.

Scene name: {scene_name}
Scene dialogue: {dialogue}

Generate a vivid, specific visual setting description for this scene. The setting should:
- Be visually distinct and professional (suitable for financial services)
- Match the emotional tone of the dialogue
- Be concise (one sentence, 10–20 words)
- Describe: location, lighting conditions, and any notable visual elements
- Examples: "Modern glass office with city skyline view, soft afternoon light", "Bright open kitchen, family gathered at table, warm sunlight"

Return ONLY the setting description, no preamble, no explanation."""


def build_brief_field_improve_prompt(field: str, context: dict) -> str:
    title = context.get("title", "")
    key_message = context.get("key_message", "")
    target_audience = context.get("target_audience", "")
    tone = context.get("tone", "professional")
    cta_text = context.get("cta_text", "")
    video_brief = context.get("video_brief", "")
    current_value = context.get(field, "")

    if field == "video_brief":
        existing = f"\nExisting brief to improve: {video_brief}" if video_brief else ""
        return f"""Write a concise, compelling video brief paragraph for an AIA Singapore marketing video.

Use the following context:
- Video title: {title}
- Key message: {key_message}
- Target audience: {target_audience}
- Tone: {tone}
- Call to action: {cta_text}{existing}

Requirements:
- 2–4 sentences
- Captures the purpose, audience, and direction of the video
- Suitable for briefing a creative team or AI video generation system
- {tone.capitalize()} tone, professional register

Return ONLY the brief paragraph. No preamble, no headings."""

    field_descriptions = {
        "key_message": "key message — the single most important takeaway for viewers",
        "target_audience": "target audience description — who this video is specifically for",
        "cta_text": "call to action — what viewers should do after watching",
    }
    field_desc = field_descriptions.get(field, field.replace("_", " "))
    other_context = "\n".join([
        f"- Video title: {title}",
        f"- Target audience: {target_audience}" if field != "target_audience" else "",
        f"- Tone: {tone}",
        f"- Key message: {key_message}" if field != "key_message" else "",
        f"- Call to action: {cta_text}" if field != "cta_text" else "",
        f"- Video brief: {video_brief}" if video_brief else "",
    ]).strip()

    return f"""Improve this {field_desc} for an AIA Singapore marketing video.

Current content:
"{current_value}"

Video context:
{other_context}

Make it more specific, compelling, and appropriate for a professional financial services video.
Keep it concise and natural. Do not change the meaning — refine the wording.

Return ONLY the improved content. No explanation, no preamble."""


# ── Poster Wizard prompt builder ───────────────────────────────────────────────


class PosterPromptBuilder:
    """All prompt templates for the Poster Wizard AI endpoints (doc 03).

    Every method returns a (system_prompt, user_prompt) tuple so callers can
    use Gemini's chat / system-instruction API when available. For now the
    implementation concatenates them into a single string for the text API.

    Temperature guidance (doc 03):
      - 0.3  → deterministic structured outputs (copy-draft-all, brief, etc.)
      - 0.5  → tone-rewrite (creative latitude)
    """

    # Shared compliance footer appended to every copy-generating prompt.
    COMPLIANCE_FOOTER = (
        "\n\nHard prohibitions (apply to every output):\n"
        '  - No "guaranteed", "guarantee", "no risk", "best in market", '
        '"the only", "number one".\n'
        "  - No specific financial returns or payout figures not present in input.\n"
        "  - British English.\n"
    )

    # Structured-output JSON schema for copy-draft-all and tone-rewrite.
    COPY_JSON_SCHEMA = {
        "type": "object",
        "properties": {
            "headline":    {"type": "string"},
            "subheadline": {"type": "string"},
            "body":        {"type": "string"},
            "cta_text":    {"type": "string"},
        },
        "required": ["headline", "subheadline", "body", "cta_text"],
    }

    # ── 1. Brief synthesis ────────────────────────────────────────────────────

    @staticmethod
    def brief_synthesis(
        campaign_objective: str,
        target_audience: str,
        tone: str,
        call_to_action: str,
        existing_brief: str | None = None,
    ) -> str:
        existing_block = (
            f"\n  Existing brief to revise: {existing_brief}" if existing_brief else ""
        )
        return (
            "System: You are an AIA Singapore marketing content strategist. "
            "Produce compliant, on-brand poster briefs for the CRAFT platform.\n\n"
            "Input context:\n"
            f"  Campaign objective: {campaign_objective}\n"
            f"  Target audience: {target_audience}\n"
            f"  Tone: {tone}\n"
            f"  Call to action: {call_to_action}"
            f"{existing_block}\n\n"
            "Task:\n"
            "Write a 60–120 word narrative poster brief that:\n"
            "  - States the poster's purpose in one sentence.\n"
            "  - Describes who it speaks to and what they care about.\n"
            "  - Sets the visual and emotional direction (no specific copy).\n"
            "  - Ends with the desired action outcome.\n\n"
            "Constraints:\n"
            '  - No MAS-flagged language (no "guaranteed", "no risk", "best in market", etc.).\n'
            "  - No specific product figures or returns unless stated in input.\n"
            "  - British English (AIA Singapore convention).\n\n"
            "Return only the paragraph. No preface, no bullet list."
        )

    # ── 2. Appearance paragraph (Human Model) ─────────────────────────────────

    @staticmethod
    def appearance_paragraph(
        appearance_keywords: str,
        expression_mood: str,
        posture_framing: str,
        brief_context: str | None = None,
    ) -> str:
        context_block = (
            f"\n  Brief context: {brief_context}" if brief_context else ""
        )
        return (
            "System: Generate detailed, photorealistic image-generation descriptions "
            "of people for AIA Singapore marketing posters. Descriptions feed directly "
            "into an image-generation model; precision matters.\n\n"
            "Input:\n"
            f"  Appearance keywords: {appearance_keywords}\n"
            f"  Expression / mood: {expression_mood}\n"
            f"  Posture / framing: {posture_framing}"
            f"{context_block}\n\n"
            "Task:\n"
            "Produce a 40–80 word paragraph that an image-generation model can render "
            "faithfully. Include: apparent age range, ethnicity (if specified), hair, "
            "wardrobe, posture, expression, lighting direction if implied by mood. "
            "Do NOT invent names or narratives.\n\n"
            "Constraints:\n"
            "  - Respect the keywords exactly; do not contradict them.\n"
            "  - Neutral, professional tone; no marketing language.\n"
            "  - No brand names other than AIA if present in input.\n\n"
            "Return only the paragraph."
        )

    # ── 3. Scene description (Scene / Abstract) ───────────────────────────────

    @staticmethod
    def scene_description(
        visual_style: str,
        seed_hint: str | None = None,
        brief_context: str | None = None,
    ) -> str:
        seed_block = (
            f"\n  Seed hint from user: {seed_hint}" if seed_hint else ""
        )
        context_block = (
            f"\n  Brief context: {brief_context}" if brief_context else ""
        )
        return (
            "System: Generate evocative scene descriptions for AI image generation "
            "targeting AIA Singapore marketing posters.\n\n"
            "Input:\n"
            f"  Visual style: {visual_style}"
            f"{seed_block}"
            f"{context_block}\n\n"
            "Task:\n"
            "Write a 40–90 word description of a non-human, non-product scene that "
            "conveys mood aligned with the visual style and brief. Include: location "
            "or setting, time of day, light quality, colour direction, atmosphere.\n\n"
            "Constraints:\n"
            "  - No people, no recognisable branded products.\n"
            "  - British English.\n\n"
            "Return only the description."
        )

    # ── 3b. Field-level brief improvement ─────────────────────────────────────

    @staticmethod
    def improve_brief_field(
        field: str,
        *,
        title: str = "",
        campaign_objective: str | None = None,
        target_audience: str = "",
        tone: str | None = None,
        call_to_action: str = "",
        narrative: str = "",
    ) -> str:
        """Single-field AI assist for Step 1 brief fields.

        `field` is one of title | target_audience | call_to_action. Other
        fields are supplied as context so the output coheres with what the
        user has already typed. Missing context fields are silently omitted.
        """
        context_lines = []
        if title and field != "title":
            context_lines.append(f"  Campaign title: {title}")
        if campaign_objective:
            context_lines.append(f"  Campaign objective: {campaign_objective}")
        if target_audience and field != "target_audience":
            context_lines.append(f"  Target audience: {target_audience}")
        if tone:
            context_lines.append(f"  Tone: {tone}")
        if call_to_action and field != "call_to_action":
            context_lines.append(f"  Call to action: {call_to_action}")
        if narrative:
            context_lines.append(f"  Narrative summary: {narrative}")
        context_block = "\n".join(context_lines) or "  (none provided yet)"

        field_specs = {
            "title": (
                "a concise internal campaign title (6–10 words) that reads "
                "like a working project name, e.g. 'Life Shield 2026 Q1 Push' "
                "or 'HealthShield Gold Family Launch'. Title case, no quotes, "
                "no trailing punctuation."
            ),
            "target_audience": (
                "a specific audience description (12–25 words) covering "
                "life stage, occupation or income band, and one relevant "
                "motivation. Example: 'Working parents aged 32–45 in "
                "Singapore planning for their children's education and "
                "long-term family security.' No second person."
            ),
            "call_to_action": (
                "a short call-to-action phrase (3–7 words) using an "
                "imperative verb. Example: 'Get your free coverage review.' "
                "No exclamation marks, no MAS-flagged language, no "
                "'guaranteed' claims."
            ),
        }
        spec = field_specs.get(field, "a suitable value for this field")
        current_value = {
            "title": title,
            "target_audience": target_audience,
            "call_to_action": call_to_action,
        }.get(field, "")
        current_block = (
            f"\n  Current value (rewrite / improve it): {current_value}"
            if current_value
            else ""
        )

        return (
            "System: You are an AIA Singapore marketing content strategist "
            "helping a user fill in a single field of a campaign brief.\n\n"
            "Context (other fields the user has already filled):\n"
            f"{context_block}"
            f"{current_block}\n\n"
            f"Task: Write {spec}\n\n"
            "Constraints:\n"
            '  - No MAS-flagged language (no "guaranteed", "no risk", '
            '"best in market", etc.).\n'
            "  - British English.\n"
            "  - Return ONLY the value — no preface, no quotes, no bullets."
        )

    # ── 3c. Field-level subject improvement ───────────────────────────────────

    @staticmethod
    def improve_subject_field(
        field: str,
        *,
        appearance_keywords: str = "",
        expression_mood: str = "",
        posture_framing: str | None = None,
        brief_context: str | None = None,
    ) -> str:
        """Single-field AI assist for Step 2 human-model sub-form fields."""
        context_lines = []
        if appearance_keywords and field != "appearance_keywords":
            context_lines.append(f"  Appearance keywords: {appearance_keywords}")
        if expression_mood and field != "expression_mood":
            context_lines.append(f"  Expression / mood: {expression_mood}")
        if posture_framing:
            context_lines.append(f"  Posture / framing: {posture_framing}")
        if brief_context:
            context_lines.append(f"  Brief context: {brief_context}")
        context_block = "\n".join(context_lines) or "  (none provided yet)"

        field_specs = {
            "appearance_keywords": (
                "a short comma-separated list (5–9 keywords) describing the "
                "person's apparent age, ethnicity, attire, and one defining "
                "visual trait. Example: 'South-East Asian woman, mid-30s, "
                "warm smile, business casual, soft wavy hair'. No full "
                "sentences."
            ),
            "expression_mood": (
                "a short phrase (4–10 words) describing the subject's facial "
                "expression and emotional mood. Example: 'Confident, hopeful, "
                "looking toward the future'. No sentences."
            ),
        }
        spec = field_specs.get(field, "a suitable value for this field")
        current_value = {
            "appearance_keywords": appearance_keywords,
            "expression_mood": expression_mood,
        }.get(field, "")
        current_block = (
            f"\n  Current value (rewrite / improve it): {current_value}"
            if current_value
            else ""
        )

        return (
            "System: You are a visual director writing image-generation "
            "cues for AIA Singapore marketing posters.\n\n"
            "Context (other subject fields):\n"
            f"{context_block}"
            f"{current_block}\n\n"
            f"Task: Write {spec}\n\n"
            "Constraints:\n"
            "  - Neutral, professional tone; no marketing language.\n"
            "  - British English.\n"
            "  - Return ONLY the value — no preface, no quotes."
        )

    # ── 4. Copy draft all ─────────────────────────────────────────────────────

    @staticmethod
    def copy_draft_all(
        brief: str,
        tone: str,
        campaign_objective: str,
        audience: str | None = None,
    ) -> str:
        audience_block = f"\n  Audience: {audience}" if audience else ""
        return (
            "System: Generate insurance-compliant poster copy for AIA Singapore. "
            "Output strict JSON.\n\n"
            "Input:\n"
            f"  Brief: {brief}\n"
            f"  Tone: {tone}\n"
            f"  Campaign objective: {campaign_objective}"
            f"{audience_block}\n\n"
            "Task:\n"
            "Produce a single JSON object with fields:\n"
            '  "headline": 5–8 words, strongest verb, no absolute claims\n'
            '  "subheadline": 10–15 words, supports the headline with context\n'
            '  "body": 20–35 words, 1–2 sentences that amplify the headline\n'
            '  "cta_text": 3–6 words, button-style imperative\n\n'
            "Compliance rules (hard):\n"
            '  - No "guaranteed", "guarantee", "no risk", "best in market", "the only", '
            '"number one", "you will receive", "definitely".\n'
            "  - Disclaimers are never placed in these fields.\n\n"
            "Tone handling:\n"
            "  - PROFESSIONAL → measured, confident\n"
            "  - INSPIRATIONAL → aspirational, future-facing\n"
            "  - ENERGETIC → short sentences, action verbs\n"
            "  - EMPATHETIC → \"you\"-centric, first-person warmth\n"
            "  - URGENCY_DRIVEN → time-framed but truthful\n\n"
            "Output: JSON only. No preamble."
        )

    # ── 5. Copy draft field (single-field regenerate) ─────────────────────────

    @staticmethod
    def copy_draft_field(
        field: str,
        brief: str,
        tone: str,
        current_values: dict[str, str],
    ) -> str:
        sibling_context = "\n".join(
            f"  {k}: {v}" for k, v in current_values.items() if k != field and v
        )
        field_guides = {
            "headline":    "5–8 words, strongest verb, no absolute claims",
            "subheadline": "10–15 words, supports the headline with context",
            "body":        "20–35 words, 1–2 sentences that amplify the headline",
            "cta_text":    "3–6 words, button-style imperative",
        }
        guide = field_guides.get(field, "concise, compliant marketing copy")

        return (
            "System: Generate insurance-compliant poster copy for AIA Singapore. "
            "Output strict JSON.\n\n"
            f"Regenerate only the {field!r} field ({guide}).\n\n"
            f"Brief: {brief}\n"
            f"Tone: {tone}\n\n"
            "Other fields already written (keep coherent — do not repeat verbatim):\n"
            f"{sibling_context}\n\n"
            "Compliance rules (hard):\n"
            '  - No "guaranteed", "guarantee", "no risk", "best in market", "the only", '
            '"number one", "you will receive", "definitely".\n\n'
            f"Return ONLY the text for the {field!r} field. No labels, no quotes."
        )

    # ── 6. Tone rewrite ───────────────────────────────────────────────────────

    @staticmethod
    def tone_rewrite(
        headline: str,
        subheadline: str,
        body: str,
        cta_text: str,
        rewrite_tone: str,
    ) -> str:
        return (
            "System: Rewrite AIA insurance poster copy to a new tone. "
            "Preserve structure (field count, approximate length). "
            "Output strict JSON matching input field set.\n\n"
            "Input (current):\n"
            f"  Headline: {headline}\n"
            f"  Subheadline: {subheadline}\n"
            f"  Body: {body}\n"
            f"  CTA text: {cta_text}\n\n"
            f"Rewrite tone: {rewrite_tone}\n"
            "  - SHARPER → shorter sentences, stronger verbs, more direct.\n"
            "  - WARMER → \"you\"-centric, first-person, empathetic, softer.\n"
            "  - MORE_URGENT → deadline framing, loss-aversion, stronger CTA. "
            "Keep truthful — no false urgency.\n"
            "  - SHORTER → minimum viable expression. Cut filler, keep the idea.\n\n"
            'Keep all compliance constraints: no "guaranteed", "no risk", '
            '"best in market", "the only", "number one".\n\n'
            'Output JSON: { "headline": "…", "subheadline": "…", "body": "…", "cta_text": "…" }'
        )

    # ── 7. Style sentence (LLM sub-slot for composition prompt) ───────────────

    @staticmethod
    def style_sentence(
        visual_style: str,
        palette_descriptor: str,
        tone: str,
    ) -> str:
        return (
            "System: Produce a single sentence (<= 30 words) that captures the "
            "overall visual character of an AIA Singapore poster given style + "
            "palette + tone.\n\n"
            "Input:\n"
            f"  Visual style: {visual_style}\n"
            f"  Palette description: {palette_descriptor}\n"
            f"  Tone: {tone}\n\n"
            "Output: one sentence only. "
            'Example shape: "A {style-adjective}, {palette-adjective} composition '
            'that feels {tone-adjective}."'
        )

    # ── 8. Structural-change classifier (LLM fallback) ────────────────────────

    @staticmethod
    def structural_change_classifier(user_message: str) -> str:
        return (
            "Classify the intent of this chat message about an AI-generated poster.\n\n"
            f'Message: "{user_message}"\n\n'
            "Possible intents:\n"
            "  - VISUAL_ADJUSTMENT (colour, lighting, scale, position, mood) → not structural\n"
            "  - COPY_CHANGE (wording, length, headline, CTA text)           → STEP_3_COPY\n"
            "  - LAYOUT_CHANGE (arrangement, template, composition structure)→ STEP_4_COMPOSITION\n"
            "  - SUBJECT_CHANGE (person, product, scene identity)            → STEP_2_SUBJECT\n"
            "  - FORMAT_CHANGE (dimensions, aspect ratio)           → STEP_4_COMPOSITION\n\n"
            'Output JSON: { "intent": "...", "confidence": 0.0 }'
        )


def build_scene_merged_prompt(scene: object, presenter: object | None, brand_kit: object | None) -> str:
    """
    Build the merged Veo prompt for a single scene.
    Pure function — no DB access. Critical: presenter.full_appearance_description
    is inserted verbatim; no AI rewriting.
    If presenter is None, presenter lines are omitted entirely.
    """
    from app.models.scene import Scene
    from app.models.presenter import Presenter
    from app.models.brand_kit import BrandKit

    s: Scene = scene  # type: ignore[assignment]
    p: Presenter | None = presenter  # type: ignore[assignment]
    bk: BrandKit | None = brand_kit  # type: ignore[assignment]

    lines: list[str] = [
        s.dialogue,
        "",
        f"Setting: {s.setting}",
        f"Camera: {s.camera_framing.value}",
    ]

    if p is not None:
        lines += [
            "",
            f"Presenter: {p.full_appearance_description}",
            "",
            f"Speaking style: {p.speaking_style.value}",
        ]

    if bk is not None:
        tone = (bk.fonts or {}).get("tone", "professional")
        brand_line = (
            f"Brand colors: {bk.primary_color} and {bk.secondary_color}; tone: {tone}"
        )
        lines += ["", f"Brand kit: {brand_line}"]

    return "\n".join(lines)


def build_storyboard_prompt(
    topic: str,
    key_message: str,
    product: str,
    tone: str,
) -> str:
    return f"""Create a storyboard for a 30-second social media reel for AIA Singapore.

Topic: {topic}
Key message: {key_message}
Product: {product}
Tone: {tone}

Create 5-6 frames. For each frame provide:
- frame_number: sequential integer
- duration_seconds: how long this frame shows (3-6 seconds, total ~30s)
- text_overlay: short text shown on screen (max 8 words)
- visual_description: what the viewer sees (1 sentence)
- transition: one of "fade", "slide_left", "slide_up", "zoom_in", "cut"

Return ONLY a JSON array of frame objects, no other text."""


def build_video_brief_prompt(project_brief: dict, video_name: str) -> str:
    product = project_brief.get("product", "AIA insurance product")
    audience = project_brief.get("target_audience", "")
    key_msg = project_brief.get("key_message", "")

    return f"""You are helping create a brief for an AIA Singapore marketing video.

Video name: {video_name}
Product: {product}
Project target audience: {audience}
Project key message: {key_msg}

Generate a concise video brief with exactly these fields:
- key_message: The single most important thing viewers should take away (1 sentence)
- target_audience: Who this video is specifically for (1-2 sentences)  
- tone: Exactly one of: professional, conversational, inspirational, energetic, empathetic
- cta_text: What viewers should do after watching (short phrase, e.g. "Visit aia.com.sg to learn more")

Return ONLY a valid JSON object with these four string fields. No markdown, no explanation.
Example: {{"key_message": "...", "target_audience": "...", "tone": "professional", "cta_text": "..."}}"""
