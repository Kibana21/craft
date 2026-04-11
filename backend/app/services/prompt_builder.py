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
