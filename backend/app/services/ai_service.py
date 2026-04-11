import json

from app.core.config import settings
from app.services.prompt_builder import (
    build_image_prompt,
    build_tagline_prompt,
    build_storyboard_prompt,
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
    if settings.GOOGLE_API_KEY:
        try:
            import google.generativeai as genai

            genai.configure(api_key=settings.GOOGLE_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")

            prompt = build_tagline_prompt(product, audience, tone, count)
            response = model.generate_content(prompt)

            # Parse JSON array from response
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
    if settings.GOOGLE_API_KEY:
        try:
            import google.generativeai as genai

            genai.configure(api_key=settings.GOOGLE_API_KEY)
            model = genai.GenerativeModel("gemini-1.5-flash")

            prompt = build_storyboard_prompt(topic, key_message, product, tone)
            response = model.generate_content(prompt)

            text = response.text.strip()
            if text.startswith("```"):
                text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
            frames = json.loads(text)
            return frames
        except Exception as e:
            print(f"Gemini storyboard generation failed: {e}")

    return FALLBACK_STORYBOARD
