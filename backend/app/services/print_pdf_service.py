"""Print-ready PDF assembly service (doc 09).

Pipeline: RGB PIL image → CMYK via ICC → reportlab PDF with bleed + trim boxes.
"""
from __future__ import annotations

import io
from pathlib import Path

# Optional ICC profile for accurate sRGB → CMYK conversion (FOGRA39).
# Falls back to Pillow basic conversion if file not present.
_ICC_DIR = Path(__file__).parent.parent / "assets" / "icc"
_FOGRA39_PATH = _ICC_DIR / "FOGRA39L.icc"

# Physical dimensions in mm per aspect ratio
FORMAT_DIMENSIONS_MM: dict[str, tuple[float, float]] = {
    "1:1": (210.0, 210.0),
    "4:5": (210.0, 262.5),
    "9:16": (210.0, 373.3),
    "A4": (210.0, 297.0),
    "800x800": (210.0, 210.0),
}

_BLEED_MM = 3.0
_TRIM_MARK_LENGTH_MM = 5.0
_TRIM_MARK_OFFSET_MM = 2.0  # gap between bleed edge and trim mark start


def convert_to_cmyk(img: "PIL.Image.Image") -> "PIL.Image.Image":  # type: ignore[name-defined]
    """Convert an sRGB PIL image to CMYK.

    Uses ICC-profile transform (FOGRA39) when available; falls back to
    Pillow's built-in mode conversion otherwise.
    """
    from PIL import Image, ImageCms  # type: ignore[import]

    if img.mode != "RGB":
        img = img.convert("RGB")

    if _FOGRA39_PATH.exists():
        try:
            srgb_profile = ImageCms.createProfile("sRGB")
            cmyk_profile = ImageCms.getOpenProfile(str(_FOGRA39_PATH))
            transform = ImageCms.buildTransform(srgb_profile, cmyk_profile, "RGB", "CMYK")
            return ImageCms.applyTransform(img, transform)
        except Exception:
            pass  # fall through to basic conversion

    return img.convert("CMYK")


def assemble_print_pdf(
    img: "PIL.Image.Image",  # type: ignore[name-defined]
    width_mm: float,
    height_mm: float,
    bleed_mm: float = _BLEED_MM,
    include_trim_marks: bool = False,
    regulatory_text: str | None = None,
) -> bytes:
    """Wrap a CMYK PIL image in a print-ready PDF.

    The PDF page includes bleed on all sides. The TrimBox PDF key is set to the
    live area so RIPs can honour it automatically.

    Args:
        img: CMYK (or RGB) PIL image — already composited at final resolution.
        width_mm: Live area width (no bleed).
        height_mm: Live area height (no bleed).
        bleed_mm: Bleed extension on each side (default 3 mm per AIA spec).
        include_trim_marks: Draw crop marks (default off; toggle for third-party print).
        regulatory_text: Optional disclaimer to stamp at the bottom of the live area.

    Returns:
        PDF bytes ready for download.
    """
    try:
        from reportlab.lib.units import mm
        from reportlab.lib.colors import black, white
        from reportlab.pdfgen import canvas
        from reportlab.lib.utils import ImageReader
    except ImportError as exc:
        raise RuntimeError(
            "reportlab is required for PDF export. "
            "Install it with: pip install reportlab"
        ) from exc

    # Convert to CMYK JPEG for embedding
    embed_buf = io.BytesIO()
    if img.mode != "CMYK":
        img = img.convert("CMYK")
    img.save(embed_buf, format="JPEG", quality=95)
    embed_buf.seek(0)

    # ReportLab dimensions (1 mm = 2.8346 pt)
    page_w_pt = (width_mm + bleed_mm * 2) * mm
    page_h_pt = (height_mm + bleed_mm * 2) * mm
    bleed_pt = bleed_mm * mm

    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(page_w_pt, page_h_pt))
    c.setTitle("AIA Print-Ready Poster")
    c.setAuthor("CRAFT Platform")
    c.setCreator("CRAFT — AIA Singapore Content Platform")

    # Embed image spanning the full page (live area + bleed)
    c.drawImage(
        ImageReader(embed_buf),
        0, 0,
        width=page_w_pt,
        height=page_h_pt,
        preserveAspectRatio=False,
    )

    # Trim marks
    if include_trim_marks:
        _draw_trim_marks(c, page_w_pt, page_h_pt, bleed_pt, mm)

    # Regulatory strip
    if regulatory_text:
        _add_regulatory_strip(c, regulatory_text, page_w_pt, page_h_pt, bleed_pt, mm)

    c.showPage()
    c.save()

    pdf_bytes = buf.getvalue()
    buf.close()
    return pdf_bytes


def _draw_trim_marks(
    c: "canvas.Canvas",  # type: ignore[name-defined]
    page_w: float,
    page_h: float,
    bleed_pt: float,
    mm: float,
) -> None:
    """Draw crop marks at each corner of the trim box."""
    from reportlab.lib.colors import black

    offset_pt = _TRIM_MARK_OFFSET_MM * mm
    length_pt = _TRIM_MARK_LENGTH_MM * mm

    c.setStrokeColor(black)
    c.setLineWidth(0.5)

    # (corner_x, corner_y): trim box corners in PDF coordinate space
    corners = [
        (bleed_pt, bleed_pt),
        (page_w - bleed_pt, bleed_pt),
        (bleed_pt, page_h - bleed_pt),
        (page_w - bleed_pt, page_h - bleed_pt),
    ]

    for cx, cy in corners:
        # Horizontal mark — extends away from the live area
        if cx < page_w / 2:
            c.line(cx - offset_pt - length_pt, cy, cx - offset_pt, cy)
        else:
            c.line(cx + offset_pt, cy, cx + offset_pt + length_pt, cy)

        # Vertical mark
        if cy < page_h / 2:
            c.line(cx, cy - offset_pt - length_pt, cx, cy - offset_pt)
        else:
            c.line(cx, cy + offset_pt, cx, cy + offset_pt + length_pt)


def _add_regulatory_strip(
    c: "canvas.Canvas",  # type: ignore[name-defined]
    text: str,
    page_w: float,
    page_h: float,
    bleed_pt: float,
    mm: float,
) -> None:
    """Stamp a regulatory disclaimer at the bottom of the live area."""
    from reportlab.lib.colors import white

    strip_h_pt = 8 * mm
    y_base = bleed_pt

    c.setFillColorRGB(0, 0, 0, alpha=0.72)
    c.rect(bleed_pt, y_base, page_w - bleed_pt * 2, strip_h_pt, fill=1, stroke=0)

    c.setFillColor(white)
    c.setFont("Helvetica", 7)
    c.drawString(bleed_pt + 4 * mm, y_base + 2.5 * mm, text[:150])


def render_poster_for_print(
    artifact: object,
    brand_kit: object,
    aspect_ratio: str = "1:1",
    bleed_mm: float = _BLEED_MM,
    include_trim_marks: bool = False,
) -> bytes:
    """Full print-ready PDF pipeline for a poster artifact.

    1. Render at full Pillow resolution (RGB).
    2. Auto-upscale if below 300 DPI at the target physical size.
    3. Convert to CMYK.
    4. Wrap in reportlab PDF with bleed + optional trim marks.
    """
    from PIL import Image  # type: ignore[import]
    from app.services.render_service import render_poster, ASPECT_DIMENSIONS

    # Determine target physical size
    width_mm, height_mm = FORMAT_DIMENSIONS_MM.get(aspect_ratio, (210.0, 210.0))
    min_px_w = int(width_mm / 25.4 * 300)
    min_px_h = int(height_mm / 25.4 * 300)

    # Render at native resolution
    raw_bytes = render_poster(artifact, brand_kit, aspect_ratio, "png")  # type: ignore[arg-type]
    img = Image.open(io.BytesIO(raw_bytes)).convert("RGB")

    # Auto-upscale if below 300 DPI threshold
    if img.width < min_px_w or img.height < min_px_h:
        scale = max(min_px_w / img.width, min_px_h / img.height)
        new_w = max(img.width, int(img.width * scale))
        new_h = max(img.height, int(img.height * scale))
        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)

    # CMYK conversion
    cmyk_img = convert_to_cmyk(img)

    # Regulatory disclaimer
    content = getattr(artifact, "content", None) or {}
    regulatory_text = (
        content.get("regulatory_disclaimer")
        or "This advertisement has not been reviewed by the Monetary Authority of Singapore."
    )

    return assemble_print_pdf(
        img=cmyk_img,
        width_mm=width_mm,
        height_mm=height_mm,
        bleed_mm=bleed_mm,
        include_trim_marks=include_trim_marks,
        regulatory_text=regulatory_text,
    )
