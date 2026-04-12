# 03 — AI Prompt Design

This doc specifies every prompt template used by the Poster Wizard's AI endpoints. All prompt construction lives under `backend/app/services/prompt_builder.py` (existing) — add a `PosterPromptBuilder` class rather than scattering string literals across the service layer.

## Model Choices

| Purpose | Model | Reason |
|---|---|---|
| Brief synthesis, copy drafting, tone rewrite, scene/appearance paragraphs, chat refinement NL response, structural-change classifier | **Gemini 2.5 Flash** (existing wiring) | Low latency, sufficient quality, already integrated via Vertex AI |
| Image generation (variants, region edits) | **Gemini 2.5 Flash Image** (`gemini-2.5-flash-image`, a.k.a. "Nano Banana") via `google-genai` SDK — see https://ai.google.dev/gemini-api/docs/image-generation | Single multimodal API for text-to-image, image editing, and multi-image composition. Same SDK/auth as Gemini text calls; one integration surface |
| Structural-change classifier fallback only | Gemini 2.5 Flash (single-token head) | Keyword short-circuit handles 80%+; LLM is fallback |

All Gemini text calls use low temperature (0.3) for deterministic structured outputs, except:
- **Tone rewrite** — temperature 0.5 for some creative latitude.

For the image model (`gemini-2.5-flash-image`), per-variant diversity comes from prompt-level variation (small stylistic seed phrases appended to each slot) plus the model's inherent stochasticity. The Gemini image API does not accept a temperature parameter in the same form as text models; see doc 04 §4-Variant Parallel Flow for the diversity strategy.

Output format: JSON when the response has multiple fields (copy-draft-all, tone-rewrite). Use Gemini's structured-output JSON schema feature to eliminate parse failures. Plain text for single-field outputs.

---

## 1. Brief Synthesis

**Endpoint:** `generate-brief`
**Output:** 60–120 word narrative paragraph.

```
System: You are an AIA Singapore marketing content strategist. Produce compliant, on-brand poster briefs for the CRAFT platform.

Input context:
  Campaign objective: {campaign_objective}
  Target audience: {target_audience}
  Tone: {tone}
  Call to action: {call_to_action}
  [Existing brief to revise, if provided: {existing_brief}]

Task:
Write a 60–120 word narrative poster brief that:
  - States the poster's purpose in one sentence.
  - Describes who it speaks to and what they care about.
  - Sets the visual and emotional direction (no specific copy).
  - Ends with the desired action outcome.

Constraints:
  - No MAS-flagged language (no "guaranteed", "no risk", "best in market", etc.).
  - No specific product figures or returns unless stated in input.
  - British English (AIA Singapore convention).

Return only the paragraph. No preface, no bullet list.
```

Acceptance target (PRD §2.2): > 50% of users accept unedited.

---

## 2. Appearance Paragraph (Human Model)

**Endpoint:** `generate-appearance-paragraph`
**Output:** 40–80 word detailed description of the human subject.

```
System: Generate detailed, photorealistic image-generation descriptions of people for AIA Singapore marketing posters. Descriptions feed directly into an image-generation model; precision matters.

Input:
  Appearance keywords: {appearance_keywords}
  Expression / mood: {expression_mood}
  Posture / framing: {posture_framing}
  [Brief context: {brief_context}]

Task:
Produce a 40–80 word paragraph that an image-generation model can render faithfully. Include: apparent age range, ethnicity (if specified), hair, wardrobe, posture, expression, lighting direction if implied by mood. Do NOT invent names or narratives.

Constraints:
  - Respect the keywords exactly; do not contradict them.
  - Neutral, professional tone; no marketing language.
  - No brand names other than AIA if present in input.

Return only the paragraph.
```

---

## 3. Scene Description (Scene / Abstract)

**Endpoint:** `generate-scene-description`

```
System: Generate evocative scene descriptions for AI image generation targeting AIA Singapore marketing posters.

Input:
  Visual style: {visual_style}
  [Seed hint from user: {seed_hint}]
  [Brief context: {brief_context}]

Task:
Write a 40–90 word description of a non-human, non-product scene that conveys mood aligned with the visual style and brief. Include: location or setting, time of day, light quality, colour direction, atmosphere.

Constraints:
  - No people, no recognisable branded products.
  - British English.

Return only the description.
```

---

## 4. Copy Draft All

**Endpoint:** `copy-draft-all`
**Output:** JSON via Gemini structured-output.

```
System: Generate insurance-compliant poster copy for AIA Singapore. Output strict JSON.

Input:
  Brief: {brief}
  Tone: {tone}
  Campaign objective: {campaign_objective}
  [Audience: {audience}]

Task:
Produce a single JSON object with fields:
  "headline": 5–8 words, strongest verb, no absolute claims
  "subheadline": 10–15 words, supports the headline with context
  "body": 20–35 words, 1–2 sentences that amplify the headline
  "cta_text": 3–6 words, button-style imperative

Compliance rules (hard):
  - No "guaranteed", "guarantee", "no risk", "best in market", "the only", "number one", "you will receive", "definitely".
  - Disclaimers are never placed in these fields.

Tone handling:
  - PROFESSIONAL → measured, confident
  - INSPIRATIONAL → aspirational, future-facing
  - ENERGETIC → short sentences, action verbs
  - EMPATHETIC → "you"-centric, first-person warmth
  - URGENCY_DRIVEN → time-framed but truthful

Output: JSON only. No preamble.
```

Structured-output schema:
```json
{ "headline": "string", "subheadline": "string", "body": "string", "cta_text": "string" }
```

---

## 5. Copy Draft Field (single-field regenerate)

**Endpoint:** `copy-draft-field`
Same system prompt as copy-draft-all, but task narrowed to the single field name + sibling context provided so the regenerated field stays coherent with others. Returns plain text.

---

## 6. Tone Rewrite

**Endpoint:** `tone-rewrite`
Takes all current copy + target rewrite tone. Returns JSON with all rewritten fields.

```
System: Rewrite AIA insurance poster copy to a new tone. Preserve structure (field count, approximate length). Output strict JSON matching input field set.

Input (current):
  Headline: {headline}
  Subheadline: {subheadline}
  Body: {body}
  CTA text: {cta_text}

Rewrite tone: {rewrite_tone}
  - SHARPER_PUNCHIER → shorter sentences, stronger verbs, more direct.
  - WARMER → "you"-centric, first-person, empathetic, softer.
  - MORE_URGENT → deadline framing, loss-aversion, stronger CTA. Keep truthful — no false urgency.
  - SHORTER → minimum viable expression. Cut filler, keep the idea.

Keep all compliance constraints from the copy-draft-all prompt.

Output JSON: { "headline": "…", "subheadline": "…", "body": "…", "cta_text": "…" }
```

---

## 7. Composition Prompt Assembler *(deterministic + LLM sub-slot)*

**Endpoint:** `generate-composition-prompt`

This is **not an LLM call** for the overall assembly — it is a deterministic string template. A small LLM call produces a "style sentence" that sits inside the template, capturing the joint flavour of `visual_style × palette × tone`.

### Deterministic template

```
{style_sentence}

Format: {format_description}. Layout: {layout_description}.

Subject: {subject_block}

Copy placement:
  - Headline ({copy.headline_words} words) as dominant text.
  - Subheadline supporting it below.
  - CTA treated as a button.
  - Body as supporting sentence{s}.

Colour palette: {palette_hex_list}. Primary accent: {primary_accent_hex}.

Brand: AIA Singapore. Brand tagline (if provided): "{brand_tagline}".
Overall mood aligns with the {tone} tone.
```

Where `subject_block` is built from Step 2 content:
- **Human Model:** `{full_appearance}. Posture: {posture_framing}.`
- **Product / Asset:** `Use uploaded reference image as the primary product element. Placement: {placement}. Background: {background_treatment}.`
- **Scene / Abstract:** `Scene: {scene.description}. No people. Visual style: {scene.visual_style}.`

### LLM-generated style sentence (the one AI sub-call)

```
System: Produce a single sentence (<= 30 words) that captures the overall visual character of an AIA Singapore poster given style + palette + tone.

Input:
  Visual style: {visual_style}
  Palette description: {palette_descriptor}   # e.g. "warm neutrals with AIA red accent"
  Tone: {tone}

Output: one sentence only. Example shape: "A {style-adjective}, {palette-adjective} composition that feels {tone-adjective}."
```

The deterministic template + LLM-polished style sentence gives reproducibility (same inputs ⇒ same composition prompt structure) while keeping the opening line expressive.

---

## 8. Refinement Chat

**Endpoint:** `refine-chat`

```
System: You refine AI-generated AIA insurance posters based on user requests. You modify the visual image only — not the copy text, not the subject identity, not the layout template. Each call is independent; context is reconstructed each turn.

Context per call:
  Original composition prompt:
    {original_merged_prompt}

  Accepted changes so far (in order):
    1. {change_description_1}
    2. ...

  Current turn user request:
    {user_message}

Task:
  1. First, determine if the request is a STRUCTURAL CHANGE (touches copy text, layout template, subject type/identity, format). If so, output:
       { "action_type": "REDIRECT", "redirect_target": "...", "message": "..." }
     Do NOT produce a new image.
  2. Otherwise, produce an updated composition instruction that reflects all accepted changes plus the new request, and return:
       { "action_type": "CHAT_REFINE", "refined_prompt": "...", "change_description": "<= 5 words", "message": "<= 25 words" }

Output: JSON only.
```

The backend then feeds `refined_prompt` to `gemini-2.5-flash-image` together with the current image as an input image (image-editing mode, per https://ai.google.dev/gemini-api/docs/image-generation#image_editing_text_and_images_to_image), producing the new variant image.

`change_description` becomes the label on the change-log pill. Kept short (≤ 5 words).

---

## 9. Structural-Change Classifier

Hybrid: keyword short-circuit first, LLM fallback second.

### Keyword patterns (fast path)

```python
COPY_PATTERNS = [r"\bchange (the )?(headline|subhead|body|cta|copy)\b",
                 r"\brewrite (the )?copy\b", r"\bchange (the )?text\b"]
LAYOUT_PATTERNS = [r"\bdifferent layout\b", r"\bchange (the )?layout\b",
                   r"\bswap (image|text) (side|position)\b"]
SUBJECT_PATTERNS = [r"\bchange (the )?(person|model|subject|product)\b",
                    r"\buse (a )?different (photo|image|model)\b"]
FORMAT_PATTERNS = [r"\bdifferent format\b", r"\b(portrait|landscape|square|story) format\b"]
```

If any match, classifier returns `{is_structural: true, target: ..., confidence: 0.9}` immediately.

### LLM fallback

If no keyword matches but message is ambiguous (> 10 words, contains an imperative verb), call Gemini with:

```
Classify the intent of this chat message about an AI-generated poster.

Message: "{user_message}"

Possible intents:
  - VISUAL_ADJUSTMENT (colour, lighting, scale, position, mood)  → not structural
  - COPY_CHANGE (wording, length, headline, CTA text)            → STEP_3_COPY
  - LAYOUT_CHANGE (arrangement, template, composition structure) → STEP_4_COMPOSITION
  - SUBJECT_CHANGE (person, product, scene identity)             → STEP_2_SUBJECT
  - FORMAT_CHANGE (dimensions, aspect ratio)                     → STEP_4_COMPOSITION

Output JSON: { "intent": "...", "confidence": 0.0 }
```

If `intent != VISUAL_ADJUSTMENT` and `confidence >= 0.7`, treat as structural.

---

## Prompt-level Safety

All prompts include a shared compliance footer template:

```
Hard prohibitions (apply to every output):
  - No "guaranteed", "guarantee", "no risk", "best in market", "the only", "number one".
  - No specific financial returns or payout figures not present in input.
  - British English.
```

The compliance engine (doc 08) acts as belt-and-suspenders server-side regardless of whether prompts include this footer — LLM drift is expected.

---

## Telemetry Hooks per Prompt

Each call emits a telemetry event with `generation_id`, `prompt_template_version`, `tokens_in`, `tokens_out`, `latency_ms`, `accepted` (set later when the user proceeds without editing). Used to compute the PRD §2.2 acceptance metrics.

---

## Cross-references

- Endpoint contracts → doc 02.
- Variant temperature scheme → doc 04.
- Structural-change UX → doc 07.
- Compliance-rule overlap with prompt footer → doc 08.

*Continue to `04-image-generation-pipeline.md`.*
