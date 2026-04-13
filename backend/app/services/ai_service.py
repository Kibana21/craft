import json
from pathlib import Path

from app.core.config import settings
from app.services.prompt_builder import (
    build_image_prompt,
    build_tagline_prompt,
    build_storyboard_prompt,
    build_presenter_appearance_prompt,
    build_script_draft_prompt,
    build_script_rewrite_prompt,
    build_scene_split_prompt,
    build_keyword_suggestion_prompt,
    build_dialogue_refinement_prompt,
    build_setting_suggestion_prompt,
    build_video_brief_prompt,
    build_brief_field_improve_prompt,
)

# ── Cached Vertex AI client ────────────────────────────────────────────────────
# Credentials and genai.Client are created once per process and reused.
# Creating them on every call (the old approach) executes synchronous blocking
# I/O (file read + possible token refresh) inside the async event loop, which
# blocks uvicorn from accepting/responding to other requests and causes
# ECONNRESET on concurrent requests.

_vertex_client = None  # genai.Client singleton


def _get_vertex_client():
    """Return the cached Vertex AI genai.Client, creating it on first call.

    Reads the service-account key file synchronously — safe to do once at
    startup or on the first AI request (before the event loop is saturated).
    Subsequent calls return the already-constructed client with no I/O.

    Raises RuntimeError if GOOGLE_VEO_KEY_FILE is missing or misconfigured.
    """
    global _vertex_client
    if _vertex_client is not None:
        return _vertex_client

    from google.oauth2 import service_account
    from google import genai

    key_path = Path(settings.GOOGLE_VEO_KEY_FILE)
    if not key_path.is_absolute():
        key_path = Path.cwd() / key_path
    key_path = key_path.resolve()

    if not key_path.exists():
        raise RuntimeError(
            f"Gemini service account key not found at {key_path}. "
            "Ensure GOOGLE_VEO_KEY_FILE in .env points to the correct JSON file."
        )

    credentials = service_account.Credentials.from_service_account_file(
        str(key_path),
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )
    _vertex_client = genai.Client(
        vertexai=True,
        project=settings.VEO_PROJECT_ID,
        location=settings.VEO_LOCATION,
        credentials=credentials,
    )
    return _vertex_client


class _VertexGeminiModel:
    """Thin wrapper so callers can use await model.generate_content(prompt)."""

    def __init__(self, model_name: str):
        self._model_name = model_name

    async def generate_content(
        self,
        prompt: str,
        temperature: float = 1.0,
        response_mime_type: str | None = None,
        response_schema: dict | None = None,
    ):
        from google import genai

        client = _get_vertex_client()
        config_kwargs: dict = {"temperature": temperature}
        if response_mime_type:
            config_kwargs["response_mime_type"] = response_mime_type
        if response_schema:
            config_kwargs["response_schema"] = response_schema

        config = genai.types.GenerateContentConfig(**config_kwargs)
        return await client.aio.models.generate_content(
            model=self._model_name,
            contents=prompt,
            config=config,
        )


def _gemini_model(model_name: str = "gemini-2.5-flash") -> _VertexGeminiModel:
    """Return a Gemini model wrapper backed by the cached Vertex AI client.

    Raises RuntimeError (propagated from _get_vertex_client) if not configured.
    """
    return _VertexGeminiModel(model_name)


# ── Gemini image model ─────────────────────────────────────────────────────────


class GeminiImageError(Exception):
    """Raised when the Gemini image model fails or returns no image part."""

    def __init__(self, message: str, error_code: str = "AI_UPSTREAM_ERROR"):
        super().__init__(message)
        self.error_code = error_code


async def generate_image_gemini(
    prompt: str,
    input_images: list[bytes] | None = None,
    mime_type: str = "image/png",
) -> bytes:
    """Low-level Gemini image generation call.

    Uses the cached Vertex AI client (_get_vertex_client) to avoid blocking
    synchronous credential loading on every call.

    Errors:
    - GeminiImageError(error_code="AI_CONTENT_POLICY") — safety/policy rejection
    - GeminiImageError(error_code="AI_UPSTREAM_ERROR") — no image part in response
    - RuntimeError — model not configured (propagated from _get_vertex_client)
    """
    from google.genai import types

    client = _get_vertex_client()

    # Build multipart contents: prompt first, then optional input images
    parts: list = [prompt]
    if input_images:
        for raw in input_images:
            parts.append(types.Part.from_bytes(data=raw, mime_type=mime_type))

    response = await client.aio.models.generate_content(
        model="gemini-2.5-flash-image",
        contents=parts,
    )

    # Check for safety/policy rejection via finish_reason
    candidates = getattr(response, "candidates", [])
    if candidates:
        finish_reason = getattr(candidates[0], "finish_reason", None)
        finish_str = str(finish_reason) if finish_reason else ""
        if any(s in finish_str.upper() for s in ("SAFETY", "PROHIBITED", "OTHER")):
            raise GeminiImageError(
                f"Image generation blocked by safety filters: {finish_str}",
                error_code="AI_CONTENT_POLICY",
            )
        # Extract inline image from the first candidate's parts
        for part in candidates[0].content.parts:
            inline = getattr(part, "inline_data", None)
            if inline is not None:
                return inline.data

    raise GeminiImageError(
        "Gemini returned no image part in the response. "
        "The model may have produced a text-only response.",
        error_code="AI_UPSTREAM_ERROR",
    )


# Fallback taglines when Gemini is not configured
FALLBACK_TAGLINES: dict[str, list[str]] = {
    "default": [
        "Protection that grows with your family",
        "Secure today, confident tomorrow",
        "Your family's future, our promise",
        "Smart protection for modern families",
        "Because every moment matters",
    ],
    "PAA": [
        "Accidents don't wait, neither should you",
        "24/7 protection for life's unexpected moments",
        "Affordable coverage, priceless peace of mind",
        "Personal accident protection, simplified",
        "Live boldly, we've got you covered",
    ],
    "HealthShield": [
        "Healthcare coverage that keeps up with you",
        "Your health, our shield",
        "Comprehensive care, zero worries",
        "Protection that adapts to your needs",
        "Because health is your greatest wealth",
    ],
}

FALLBACK_STORYBOARD = [
    {"frame_number": 1, "duration_seconds": 4, "text_overlay": "Did you know?", "visual_description": "Young family at a park, warm sunlight", "transition": "fade"},
    {"frame_number": 2, "duration_seconds": 5, "text_overlay": "Life is unpredictable", "visual_description": "Quick montage of daily life moments", "transition": "slide_left"},
    {"frame_number": 3, "duration_seconds": 5, "text_overlay": "But your protection doesn't have to be", "visual_description": "Shield icon morphing into family embrace", "transition": "zoom_in"},
    {"frame_number": 4, "duration_seconds": 5, "text_overlay": "AIA protects what matters", "visual_description": "Family smiling together, AIA branding visible", "transition": "slide_up"},
    {"frame_number": 5, "duration_seconds": 5, "text_overlay": "From just $1.20/day", "visual_description": "Product name with price point, clean design", "transition": "fade"},
    {"frame_number": 6, "duration_seconds": 6, "text_overlay": "Start protecting today", "visual_description": "CTA with QR code and AIA logo", "transition": "fade"},
]


async def generate_taglines(
    product: str,
    audience: str,
    tone: str,
    count: int = 5,
) -> list[str]:
    """Generate taglines using Gemini, or return fallback."""
    try:
        model = _gemini_model()
        prompt = build_tagline_prompt(product, audience, tone, count)
        response = await model.generate_content(prompt)

        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        taglines = json.loads(text)
        return taglines[:count]
    except Exception as e:
        print(f"Gemini tagline generation failed: {e}")

    # Fallback
    key = product.split(" ")[0].upper() if product else "default"
    fallback = FALLBACK_TAGLINES.get(key, FALLBACK_TAGLINES["default"])
    return fallback[:count]


async def generate_image(
    product: str,
    audience: str,
    tone: str,
    artifact_type: str,
    aspect_ratio: str,
    brand_colors: dict | None = None,
) -> tuple[str, str]:
    """Generate image using Imagen 3, or return placeholder.
    Returns (image_url, prompt_used).
    """
    prompt = build_image_prompt(product, audience, tone, artifact_type, aspect_ratio, brand_colors)

    if settings.GOOGLE_API_KEY:
        try:
            # Imagen 3 via Vertex AI — requires more setup
            # For now, use a placeholder approach
            pass
        except Exception as e:
            print(f"Image generation failed: {e}")

    # Return a placeholder gradient URL (frontend renders a preview card)
    placeholder = f"/api/placeholder/image?type={artifact_type}&ratio={aspect_ratio}"
    return placeholder, prompt


async def generate_storyboard(
    topic: str,
    key_message: str,
    product: str,
    tone: str,
) -> list[dict]:
    """Generate storyboard using Gemini, or return fallback."""
    try:
        model = _gemini_model()
        prompt = build_storyboard_prompt(topic, key_message, product, tone)
        response = await model.generate_content(prompt)

        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        frames = json.loads(text)
        return frames
    except Exception as e:
        print(f"Gemini storyboard generation failed: {e}")

    return FALLBACK_STORYBOARD


async def generate_presenter_appearance(keywords: str, speaking_style: str) -> str:
    """Generate a detailed presenter appearance description using Gemini."""
    try:
        model = _gemini_model()
        prompt = build_presenter_appearance_prompt(keywords, speaking_style)
        response = await model.generate_content(prompt)
        text = response.text.strip()
        if text:
            return text
    except Exception as e:
        print(f"Gemini appearance generation failed: {e}")
        raise

    # Fallback
    style_map = {
        "authoritative": "confident and composed",
        "conversational": "warm and approachable",
        "enthusiastic": "energetic and engaging",
        "empathetic": "caring and supportive",
    }
    style_desc = style_map.get(speaking_style.lower(), "professional")
    return (
        f"A professional presenter with {keywords}. "
        f"They wear smart business attire appropriate for a financial services setting. "
        f"Their manner is {style_desc}, speaking directly to camera with a composed expression. "
        f"The background is a soft-focus modern office with warm ambient lighting."
    )


async def draft_script(brief: dict) -> str:
    """Generate a video script from a project brief using Gemini."""
    try:
        model = _gemini_model()
        prompt = build_script_draft_prompt(brief)
        response = await model.generate_content(prompt)
        text = response.text.strip()
        if text:
            return text
    except Exception as e:
        print(f"Gemini script draft failed: {e}")
        raise

    # Fallback
    product = brief.get("product", "AIA insurance")
    audience = brief.get("target_audience", "working adults")
    cta = brief.get("cta_text", "Learn more at aia.com.sg")
    return (
        f"Did you know that {audience} face unexpected financial challenges every day? "
        f"That's why {product} was designed with you in mind. "
        f"Whether it's protecting your family or securing your future, we're here to help. "
        f"Our comprehensive coverage gives you the peace of mind to live life fully. "
        f"AIA Singapore — because what matters most deserves the best protection. "
        f"{cta}"
    )


async def rewrite_script(content: str, tone: str) -> str:
    """Rewrite an existing script in the specified tone using Gemini."""
    try:
        model = _gemini_model()
        prompt = build_script_rewrite_prompt(content, tone)
        response = await model.generate_content(prompt)
        text = response.text.strip()
        if text:
            return text
    except Exception as e:
        print(f"Gemini script rewrite failed: {e}")
        raise

    # Fallback: simple text transformations
    if tone == "shorter":
        words = content.split()
        return " ".join(words[: max(1, int(len(words) * 0.8))])
    tone_labels = {
        "warm": "With warmth and care — ",
        "professional": "In our professional assessment — ",
        "stronger_cta": "",
    }
    return tone_labels.get(tone, "") + content


async def split_script_into_scenes(
    script: str,
    target_duration_seconds: int,
    presenter: dict | None = None,
    brand_kit: dict | None = None,
) -> list[dict]:
    """Ask Gemini to split a script into scenes. Returns a list of scene dicts."""
    try:
        model = _gemini_model()
        prompt = build_scene_split_prompt(script, target_duration_seconds, presenter, brand_kit)
        response = await model.generate_content(prompt)
        text = response.text.strip()
        # Strip fenced code block markers (```json ... ``` or ``` ... ```)
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        data = json.loads(text)
        scenes = data.get("scenes", data) if isinstance(data, dict) else data
        if isinstance(scenes, list) and len(scenes) > 0:
            return scenes
    except Exception as e:
        print(f"Gemini scene split failed: {e}")

    # Fallback: single scene wrapping the whole script
    return [
        {
            "name": "Main scene",
            "dialogue": script,
            "setting": "Modern professional office with warm ambient lighting",
            "camera_framing": "MEDIUM_SHOT",
        }
    ]


async def suggest_appearance_keywords(name: str, age_range: str, speaking_style: str) -> str:
    """Suggest comma-separated appearance keywords based on presenter details."""
    try:
        model = _gemini_model()
        prompt = build_keyword_suggestion_prompt(name, age_range, speaking_style)
        response = await model.generate_content(prompt)
        text = response.text.strip()
        if text:
            return text
    except Exception as e:
        print(f"Gemini keyword suggestion failed: {e}")
        raise

    # Fallback based on speaking style
    style_keywords = {
        "authoritative": "professional business attire, dark navy suit, confident expression, modern office background",
        "conversational": "smart casual wear, warm smile, approachable expression, bright neutral background",
        "enthusiastic": "vibrant business casual, energetic posture, open expression, dynamic background",
        "empathetic": "soft professional attire, gentle expression, welcoming posture, warm neutral background",
    }
    base = style_keywords.get(speaking_style, "professional attire, neutral background")
    return f"East Asian, {age_range} age range, {base}"


async def refine_scene_dialogue(dialogue: str, scene_name: str) -> str:
    """Refine and tighten a scene's dialogue using Gemini."""
    try:
        model = _gemini_model()
        prompt = build_dialogue_refinement_prompt(dialogue, scene_name)
        response = await model.generate_content(prompt)
        text = response.text.strip()
        if text:
            return text
    except Exception as e:
        print(f"Gemini dialogue refinement failed: {e}")
        raise

    return dialogue  # Fallback: return unchanged


async def suggest_scene_setting(dialogue: str, scene_name: str) -> str:
    """Suggest a visual setting description for a scene using Gemini."""
    try:
        model = _gemini_model()
        prompt = build_setting_suggestion_prompt(dialogue, scene_name)
        response = await model.generate_content(prompt)
        text = response.text.strip()
        if text:
            return text
    except Exception as e:
        print(f"Gemini setting suggestion failed: {e}")
        raise

    return "Modern professional office with warm ambient lighting, clean minimalist design"


async def improve_brief_field(field: str, context: dict) -> str:
    """Improve a single brief field (or generate the narrative brief) using Gemini."""
    model = _gemini_model()
    prompt = build_brief_field_improve_prompt(field, context)
    response = await model.generate_content(prompt)
    text = response.text.strip()
    return text if text else context.get(field, "")


async def generate_video_brief(project_brief: dict, video_name: str) -> dict:
    """Generate video brief suggestions using Gemini."""
    try:
        model = _gemini_model()
        prompt = build_video_brief_prompt(project_brief, video_name)
        response = await model.generate_content(prompt)
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        data = json.loads(text)
        return {
            "key_message": data.get("key_message", ""),
            "target_audience": data.get("target_audience", ""),
            "tone": data.get("tone", "professional"),
            "cta_text": data.get("cta_text", ""),
        }
    except Exception as e:
        print(f"Gemini brief generation failed: {e}")
        return {
            "key_message": project_brief.get("key_message", ""),
            "target_audience": project_brief.get("target_audience", ""),
            "tone": project_brief.get("tone", "professional"),
            "cta_text": project_brief.get("cta_text", ""),
        }
