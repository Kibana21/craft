"""Server-side rendering: poster/card images (Pillow) and reels (ffmpeg)."""
from __future__ import annotations

import io
import os
import tempfile
import uuid
from pathlib import Path
from typing import Literal

from app.models.artifact import Artifact
from app.models.brand_kit import BrandKit

ASPECT_DIMENSIONS: dict[str, tuple[int, int]] = {
    "1:1": (1080, 1080),
    "4:5": (1080, 1350),
    "9:16": (1080, 1920),
    "800x800": (800, 800),
}

OutputFormat = Literal["png", "jpg", "mp4"]


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _load_background_image(artifact: Artifact, width: int, height: int):
    """Load the artifact background image or fall back to a brand-colored gradient."""
    from PIL import Image, ImageDraw

    content = artifact.content or {}
    bg_url = content.get("background_url") or content.get("image_url")

    if bg_url and bg_url.startswith("/uploads/"):
        local_path = Path(__file__).parent.parent.parent / bg_url.lstrip("/")
        if local_path.exists():
            img = Image.open(local_path).convert("RGB")
            img = img.resize((width, height), Image.Resampling.LANCZOS)
            return img

    # Generate a gradient placeholder
    img = Image.new("RGB", (width, height))
    draw = ImageDraw.Draw(img)
    for y in range(height):
        ratio = y / height
        r = int(30 + ratio * 20)
        g = int(30 + ratio * 10)
        b = int(40 + ratio * 30)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    return img


def _overlay_brand_tint(img, primary_color: str, opacity: int = 80):
    """Blend a semi-transparent brand-color tint over the image."""
    from PIL import Image

    r, g, b = _hex_to_rgb(primary_color)
    tint = Image.new("RGBA", img.size, (r, g, b, opacity))
    base = img.convert("RGBA")
    blended = Image.alpha_composite(base, tint)
    return blended.convert("RGB")


def _place_logo(img, brand_kit: BrandKit):
    """Place the brand logo in the top-right corner."""
    from PIL import Image

    logo_url = brand_kit.logo_url
    if not logo_url:
        return img

    if logo_url.startswith("/uploads/"):
        logo_path = Path(__file__).parent.parent.parent / logo_url.lstrip("/")
        if not logo_path.exists():
            return img
        try:
            logo = Image.open(logo_path).convert("RGBA")
        except Exception:
            return img
    else:
        return img

    max_logo_w = int(img.width * 0.2)
    max_logo_h = int(img.height * 0.08)
    logo.thumbnail((max_logo_w, max_logo_h), Image.Resampling.LANCZOS)

    padding = int(img.width * 0.04)
    x = img.width - logo.width - padding
    y = padding

    base = img.convert("RGBA")
    base.paste(logo, (x, y), logo)
    return base.convert("RGB")


def _render_text_overlays(img, artifact: Artifact, brand_kit: BrandKit):
    """Draw headline, tagline, agent name + headshot, and disclaimer."""
    from PIL import Image, ImageDraw, ImageFont

    draw = ImageDraw.Draw(img)
    content = artifact.content or {}
    w, h = img.size

    primary_rgb = _hex_to_rgb(brand_kit.primary_color)
    accent_rgb = _hex_to_rgb(brand_kit.accent_color)

    # Helper: try to load a font by size
    def _font(size: int):
        fonts_config = brand_kit.fonts or {}
        heading_url = fonts_config.get("heading_url")
        if heading_url and heading_url.startswith("/uploads/"):
            font_path = Path(__file__).parent.parent.parent / heading_url.lstrip("/")
            if font_path.exists():
                try:
                    return ImageFont.truetype(str(font_path), size)
                except Exception:
                    pass
        for path in [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
        ]:
            try:
                return ImageFont.truetype(path, size)
            except (OSError, IOError):
                pass
        return ImageFont.load_default()

    def _body_font(size: int):
        for path in [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
            "/System/Library/Fonts/Helvetica.ttc",
        ]:
            try:
                return ImageFont.truetype(path, size)
            except (OSError, IOError):
                pass
        return ImageFont.load_default()

    padding = int(w * 0.06)
    text_area_w = w - padding * 2

    # Headline
    headline = content.get("headline") or content.get("title") or artifact.name
    if headline:
        font_size = max(32, int(h * 0.045))
        font = _font(font_size)
        # Word wrap
        words = str(headline).split()
        lines, line = [], ""
        for word in words:
            test = f"{line} {word}".strip()
            bbox = draw.textbbox((0, 0), test, font=font)
            if bbox[2] - bbox[0] > text_area_w and line:
                lines.append(line)
                line = word
            else:
                line = test
        if line:
            lines.append(line)

        y = int(h * 0.55)
        for line_text in lines[:3]:
            draw.text((padding, y), line_text, font=font, fill=(255, 255, 255))
            y += font_size + int(font_size * 0.3)

    # Tagline / sub-headline
    tagline = content.get("tagline") or content.get("sub_headline")
    if tagline:
        font_size = max(20, int(h * 0.025))
        font = _body_font(font_size)
        draw.text((padding, int(h * 0.75)), str(tagline)[:80], font=font, fill=(220, 220, 220))

    # Disclaimer at bottom
    product_type = content.get("product_type") or ""
    disclaimer_text = content.get("disclaimer") or (
        "This advertisement has not been reviewed by the Monetary Authority of Singapore."
        if product_type else ""
    )
    if disclaimer_text:
        font_size = max(12, int(h * 0.013))
        font = _body_font(font_size)
        max_chars = int(text_area_w / (font_size * 0.55))
        short = disclaimer_text[:max_chars]
        draw.rectangle([(0, h - int(h * 0.07)), (w, h)], fill=(0, 0, 0, 180))
        draw.text((padding, h - int(h * 0.055)), short, font=font, fill=(200, 200, 200))

    return img


def render_poster(
    artifact: Artifact,
    brand_kit: BrandKit,
    aspect_ratio: str,
    output_format: str,
) -> bytes:
    """Render a poster or card as PNG/JPG bytes."""
    from PIL import Image

    dims = ASPECT_DIMENSIONS.get(aspect_ratio, ASPECT_DIMENSIONS["1:1"])
    width, height = dims

    img = _load_background_image(artifact, width, height)
    img = _overlay_brand_tint(img, brand_kit.primary_color, opacity=60)
    img = _place_logo(img, brand_kit)
    img = _render_text_overlays(img, artifact, brand_kit)

    output = io.BytesIO()
    if output_format == "jpg":
        img.convert("RGB").save(output, format="JPEG", quality=95)
    else:
        img.convert("RGB").save(output, format="PNG")
    return output.getvalue()


def render_whatsapp_card(artifact: Artifact, brand_kit: BrandKit) -> bytes:
    """Render an 800x800 WhatsApp card."""
    return render_poster(artifact, brand_kit, "800x800", "png")


def render_reel(artifact: Artifact, brand_kit: BrandKit) -> bytes:
    """Render a 1080x1920 MP4 reel from storyboard frames."""
    from PIL import Image

    content = artifact.content or {}
    frames_data = content.get("frames") or content.get("storyboard") or []

    with tempfile.TemporaryDirectory() as tmpdir:
        frame_paths = []

        if not frames_data:
            # Single placeholder frame
            frames_data = [{"text_overlay": content.get("headline", artifact.name), "duration_seconds": 3}]

        for i, frame in enumerate(frames_data[:10]):
            img = _load_background_image(artifact, 1080, 1920)
            img = _overlay_brand_tint(img, brand_kit.primary_color, opacity=70)

            # Render frame text
            from PIL import ImageDraw, ImageFont
            draw = ImageDraw.Draw(img)
            text = frame.get("text_overlay") or frame.get("text") or ""
            if text:
                font_size = 52
                try:
                    font = ImageFont.truetype(
                        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size
                    )
                except (OSError, IOError):
                    try:
                        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
                    except (OSError, IOError):
                        font = ImageFont.load_default()

                words = str(text).split()
                lines, line = [], ""
                for word in words:
                    test = f"{line} {word}".strip()
                    bbox = draw.textbbox((0, 0), test, font=font)
                    if bbox[2] - bbox[0] > 900 and line:
                        lines.append(line)
                        line = word
                    else:
                        line = test
                if line:
                    lines.append(line)

                total_h = len(lines) * (font_size + 12)
                y = (1920 - total_h) // 2
                for line_text in lines[:5]:
                    bbox = draw.textbbox((0, 0), line_text, font=font)
                    x = (1080 - (bbox[2] - bbox[0])) // 2
                    draw.text((x, y), line_text, font=font, fill=(255, 255, 255))
                    y += font_size + 12

            img = _place_logo(img, brand_kit)

            frame_path = os.path.join(tmpdir, f"frame_{i:03d}.png")
            img.save(frame_path, "PNG")
            frame_paths.append((frame_path, float(frame.get("duration_seconds", 3))))

        # Build MP4 with ffmpeg
        output_path = os.path.join(tmpdir, "reel.mp4")
        _encode_reel_ffmpeg(frame_paths, output_path)

        with open(output_path, "rb") as f:
            return f.read()


def _encode_reel_ffmpeg(frame_paths: list[tuple[str, float]], output_path: str) -> None:
    """Encode frames to MP4 using ffmpeg-python or subprocess fallback."""
    try:
        import ffmpeg  # type: ignore

        inputs = []
        for path, duration in frame_paths:
            inputs.append(ffmpeg.input(path, loop=1, t=duration))

        if len(inputs) == 1:
            video = inputs[0].video
        else:
            # Concatenate with xfade transitions
            video = inputs[0].video
            for i in range(1, len(inputs)):
                total_dur = sum(d for _, d in frame_paths[:i])
                video = ffmpeg.filter(
                    [video, inputs[i].video],
                    "xfade",
                    transition="fade",
                    duration=0.5,
                    offset=total_dur - 0.5,
                )

        (
            ffmpeg
            .output(video, output_path, vcodec="libx264", pix_fmt="yuv420p", r=30, s="1080x1920")
            .overwrite_output()
            .run(quiet=True)
        )
    except Exception:
        # Fallback: use subprocess with ffmpeg directly
        _encode_reel_subprocess(frame_paths, output_path)


def _encode_reel_subprocess(frame_paths: list[tuple[str, float]], output_path: str) -> None:
    """Subprocess fallback for ffmpeg encoding."""
    import subprocess

    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        concat_file = f.name
        for path, duration in frame_paths:
            f.write(f"file '{path}'\n")
            f.write(f"duration {duration}\n")
        # ffmpeg requires the last entry to be repeated without duration
        if frame_paths:
            f.write(f"file '{frame_paths[-1][0]}'\n")

    try:
        subprocess.run(
            [
                "ffmpeg", "-y",
                "-f", "concat", "-safe", "0", "-i", concat_file,
                "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
                "-vcodec", "libx264", "-pix_fmt", "yuv420p", "-r", "30",
                output_path,
            ],
            check=True,
            capture_output=True,
        )
    finally:
        os.unlink(concat_file)
