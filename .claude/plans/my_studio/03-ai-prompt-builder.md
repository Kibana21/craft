# 03 — AI Prompt Builder

The Prompt Builder is the feature's key differentiator (PRD §10). Users answer plain-language questions; the AI engineers the prompt.

Architecturally it's the My Studio analogue of `poster_ai_service.build_composition_prompt()` — a deterministic skeleton + one LLM call that enriches the language.

---

## Signature

```python
# backend/app/services/studio_prompt_service.py

async def build_prompt(
    intent: StudioIntent,
    style_inputs: dict,                      # validated Pydantic shape
    subject_description: str | None = None,  # from analyze_source_subject()
    variation_count: int = 4,
) -> tuple[str, list[str]]:
    """Returns (merged_prompt, ai_enrichments).

    - merged_prompt: single Gemini-flash output, ≤ 120 words.
    - ai_enrichments: 3–5 short pill labels for the "What the AI added" panel.
    """
```

And for Image→Image flows, a pre-step:

```python
async def analyze_source_subject(image_bytes: bytes) -> str:
    """One Gemini-vision call. Returns a one-sentence subject description,
    e.g. 'A South Asian woman in her 30s, smiling, wearing glasses.'
    """
```

`analyze_source_subject` keeps the prompt builder language-only — no multi-image coupling inside the enrichment call.

---

## Per-intent skeleton + style language

Each intent has its own **deterministic skeleton** assembled in Python (not LLM) from the typed `style_inputs`. Then a single LLM call enriches that skeleton into the final natural-language prompt.

### Skeleton templates

```python
# Illustrative pseudocode — real version in studio_prompt_service.py

def _skeleton_make_professional(s: MakeProfessionalInputs, subject: str | None) -> str:
    setting = " / ".join(s.setting).lower().replace("_", " ") or "neutral"
    return (
        f"Intent: transform this into a polished professional portrait.\n"
        f"Subject: {subject or 'the person in the source image'}.\n"
        f"Setting: {setting}.\n"
        f"Attire: {'keep current' if s.attire == 'KEEP' else 'make more formal'}.\n"
        f"Mood: {s.mood.lower()}.\n"
        f"User notes: {s.notes or '-'}."
    )

def _skeleton_change_background(s: ChangeBackgroundInputs, subject: str | None) -> str: ...
def _skeleton_enhance_quality(s: EnhanceQualityInputs, subject: str | None) -> str: ...
def _skeleton_variation(s: VariationInputs, subject: str | None) -> str: ...
def _skeleton_custom(s: CustomInputs, subject: str | None) -> str: ...
```

### Enrichment LLM call

Single text call to `gemini-2.5-flash` (via the existing helper in `poster_ai_service._gemini_model()`):

```
You are a professional image prompt engineer. Given the structured brief below,
rewrite it as a single natural-language image-generation prompt, suitable for
gemini-2.5-flash-image.

Constraints:
- Under 120 words.
- Include: subject language, lens/camera cues where relevant, lighting
  descriptors, composition framing, mood.
- Do NOT repeat the user's notes verbatim — integrate them naturally.
- Do NOT include negative guidance in the output. (We append it server-side.)
- Preserve subject identity language from the Subject: line verbatim.

Then, separately, list 3–5 SHORT enrichment labels (≤ 4 words each) that
describe what you added beyond the brief. Format:

```json
{"prompt": "...", "enrichments": ["Lens / camera cues", "Lighting description", ...]}
```

BRIEF:
{skeleton}
```

Response validated via `response_mime_type="application/json"` + `response_schema` so the model returns strict JSON, matching the pattern in `poster_ai_service.classify_structural_change()` LLM fallback.

### Negative guidance (server-side append)

After the LLM returns, append a standard negative-guidance suffix invisibly — NOT shown to the user but included in the final `merged_prompt` sent to the image model:

```
Negative guidance: blurry, low quality, distorted face, extra limbs,
watermarks, text artifacts, logos, compression artifacts.
```

Per PRD §13.2 this is internal only.

---

## Subject-identity preservation

For Image→Image intents, `subject_description` is passed through verbatim to the model in both the skeleton and the enrichment-LLM prompt. The enrichment LLM is explicitly told to preserve it.

Rationale: PRD §13.2 says "Always preserves subject identity language from the source image analysis." Using a two-pass LLM (one to extract subject, one to build prompt) lets us keep identity language stable even if the enrichment model paraphrases the rest.

---

## Prompt regeneration (PRD §10.6)

`POST /workflows/prompt-builder` is pure — hitting it again with the same inputs produces a differently-phrased prompt because the enrichment LLM uses temperature 0.3. Client-side we track up to 3 regenerations per workflow run and keep the previous prompt in local state so the user can Undo.

No server state to track regenerations — enforced client-side for v1.

---

## "What the AI added" panel

Client renders the `ai_enrichments` list as bullet points in the Prompt Review screen. Example labels the LLM should return:

- "Lens / camera style cues"
- "Lighting description"
- "Professional attire language"
- "Composition framing guidance"

These are purely explanatory — they build user trust per PRD §10.4. No functional behavior hangs off them.

---

## Intent-specific prompt-building notes

| Intent | Subject analysis? | Image→Image? | Key enrichments |
|---|---|---|---|
| MAKE_PROFESSIONAL | Yes | Yes | attire language, premium aesthetic, lens cues |
| CHANGE_BACKGROUND | Yes | Yes (inpaint) | lighting match, background depth of field |
| ENHANCE_QUALITY | No (minimal) | Yes | resolution, sharpness, colour grading language |
| VARIATION | Yes | Yes | degree-of-difference language (subtle → dramatic) |
| CUSTOM | Only if `use_source_as_reference=True` | Conditional | freeform user description + light enrichment |

---

## Failure handling

- LLM returns invalid JSON → retry once with stricter instructions → fallback to returning the skeleton verbatim as the prompt, with `ai_enrichments=[]`. Frontend shows a muted warning: "Prompt built from your inputs — AI enrichment unavailable."
- `analyze_source_subject` times out → proceed without subject description (the skeleton uses "the person in the source image" as a fallback).
- `GeminiImageError(AI_CONTENT_POLICY)` from the image gen stage → surface as `AI_CONTENT_POLICY` to client; the prompt is retained for editing.

Per PRD §13.3: "If prompt construction fails, the user is shown an empty editable field with a retry button." — matched by the fallback path above.

---

## Model choice

- **Prompt builder / subject analysis**: `gemini-2.5-flash` (cheap, fast, JSON-mode capable) via `_gemini_model()` helper.
- **Image generation** (downstream): `gemini-2.5-flash-image` via `generate_image_gemini()` — same as the Poster Wizard.

Single code path; model identifiers live in existing config, no new env vars.
