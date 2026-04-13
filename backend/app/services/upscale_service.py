"""2× upscale service for poster variant images (doc 09).

Uses Pillow LANCZOS for quality upscaling. Saves the upscaled result alongside
the original as `{variant_id}@2x.png`.
"""
from __future__ import annotations

import io
from pathlib import Path

UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"


def upscale_image_2x(image_bytes: bytes) -> bytes:
    """Double the resolution of an image using LANCZOS resampling.

    Returns PNG bytes regardless of the input format.
    """
    from PIL import Image  # type: ignore[import]

    img = Image.open(io.BytesIO(image_bytes))
    upscaled = img.resize((img.width * 2, img.height * 2), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    upscaled.convert("RGBA" if img.mode == "RGBA" else "RGB").save(buf, format="PNG")
    return buf.getvalue()


async def upscale_variant(artifact_id: str, variant_id: str) -> dict:
    """Upscale a stored poster variant image to 2× and persist the result.

    Looks for the source file in:
      uploads/poster-variants/{artifact_id}/{variant_id}.{png|jpg|jpeg}

    Saves the upscaled version as:
      uploads/poster-variants/{artifact_id}/{variant_id}@2x.png

    Returns:
        dict with keys: image_url, width, height
    """
    from PIL import Image  # type: ignore[import]

    variant_dir = UPLOAD_DIR / "poster-variants" / artifact_id

    # Locate the source variant file
    source_path: Path | None = None
    for ext in ("png", "jpg", "jpeg"):
        candidate = variant_dir / f"{variant_id}.{ext}"
        if candidate.exists():
            source_path = candidate
            break

    if source_path is None:
        raise ValueError(f"Variant image not found for variant_id={variant_id}")

    raw_bytes = source_path.read_bytes()
    upscaled_bytes = upscale_image_2x(raw_bytes)

    # Persist @2x alongside the original
    variant_dir.mkdir(parents=True, exist_ok=True)
    upscaled_path = variant_dir / f"{variant_id}@2x.png"
    upscaled_path.write_bytes(upscaled_bytes)

    img = Image.open(io.BytesIO(upscaled_bytes))
    return {
        "image_url": f"/uploads/poster-variants/{artifact_id}/{variant_id}@2x.png",
        "width": img.width,
        "height": img.height,
    }
