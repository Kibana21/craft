"""Apply watermarks to exported images using Pillow."""
from __future__ import annotations

import io
from typing import Literal


WatermarkType = Literal["aia_official", "crafted_with"]


def apply_watermark(
    image_bytes: bytes,
    watermark_type: str,
    user_name: str | None = None,
) -> bytes:
    """Add a semi-transparent watermark to the bottom-right corner of an image.

    watermark_type:
        'aia_official'   — "AIA Official" (for Brand Library items)
        'crafted_with'   — "Crafted with CRAFT — {user_name}" (for personal artifacts)
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        return image_bytes

    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    w, h = img.size

    if watermark_type == "aia_official":
        text = "AIA Official"
    else:
        name = user_name or "Agent"
        text = f"Crafted with CRAFT — {name}"

    # Build a transparent overlay for the text
    overlay = Image.new("RGBA", img.size, (255, 255, 255, 0))
    draw = ImageDraw.Draw(overlay)

    # Font size: ~1.5% of shortest dimension
    font_size = max(14, int(min(w, h) * 0.018))
    font: ImageFont.FreeTypeFont | ImageFont.ImageFont
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
    except (OSError, IOError):
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
        except (OSError, IOError):
            font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    padding = int(font_size * 0.6)
    x = w - text_w - padding * 2
    y = h - text_h - padding * 2

    # Background pill
    draw.rounded_rectangle(
        [x - padding, y - padding // 2, x + text_w + padding, y + text_h + padding // 2],
        radius=padding // 2,
        fill=(0, 0, 0, 140),
    )
    draw.text((x, y), text, font=font, fill=(255, 255, 255, 220))

    watermarked = Image.alpha_composite(img, overlay)

    output = io.BytesIO()
    watermarked.convert("RGB").save(output, format="PNG")
    return output.getvalue()
