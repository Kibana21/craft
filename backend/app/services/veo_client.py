"""
Typed wrapper around Google Veo via the google-genai SDK (Vertex AI backend).

Authentication: service account key file at settings.GOOGLE_VEO_KEY_FILE.
All methods are synchronous — the worker runs them in a Celery task.

API reference: https://ai.google.dev/gemini-api/docs/video

Return contract:
  generate_scene(prompt)              → (video_obj, mp4_bytes)
  extend_scene(prompt, video_obj)     → (video_obj, mp4_bytes)

  video_obj  — the google-genai Video object; pass directly to the next
               extend_scene call for visual continuity.
  mp4_bytes  — raw MP4 bytes for upload (only the last scene's bytes are used).

Exceptions raised (user-friendly, no raw API strings leaked):
  VeoTimeoutError            — scene exceeded VEO_SCENE_TIMEOUT_SECONDS
  VeoPolicyError             — prompt violated content policy
  VeoQuotaError              — quota / billing limit hit
  VeoMalformedResponseError  — unexpected response shape
  VeoNotConfiguredError      — key file missing or auth failed
"""
import logging
import os
import tempfile
import time

from app.core.config import settings

log = logging.getLogger(__name__)


# ── Typed exceptions ──────────────────────────────────────────────────────────

class VeoTimeoutError(Exception):
    pass

class VeoPolicyError(Exception):
    pass

class VeoQuotaError(Exception):
    pass

class VeoMalformedResponseError(Exception):
    pass

class VeoNotConfiguredError(Exception):
    pass


# ── Auth ──────────────────────────────────────────────────────────────────────

def _make_client():
    """Build an authenticated google-genai Client for Vertex AI."""
    from pathlib import Path

    key_path = Path(settings.GOOGLE_VEO_KEY_FILE)
    if not key_path.is_absolute():
        key_path = Path.cwd() / key_path

    if not key_path.exists():
        raise VeoNotConfiguredError(
            f"Veo key file not found at {key_path}. "
            "Set GOOGLE_VEO_KEY_FILE in .env to the correct path."
        )

    from google.oauth2 import service_account
    from google import genai

    credentials = service_account.Credentials.from_service_account_file(
        str(key_path),
        scopes=["https://www.googleapis.com/auth/cloud-platform"],
    )

    return genai.Client(
        vertexai=True,
        project=settings.VEO_PROJECT_ID,
        location=settings.VEO_LOCATION,
        credentials=credentials,
    )


# ── Error translation ─────────────────────────────────────────────────────────

def _translate_error(exc: Exception) -> Exception:
    """Map raw SDK errors to our typed exception hierarchy."""
    log.error("Veo raw error (%s): %s", type(exc).__name__, exc, exc_info=True)
    msg = str(exc).lower()
    if "deadline" in msg or "timeout" in msg:
        return VeoTimeoutError(
            f"Scene timed out after {settings.VEO_SCENE_TIMEOUT_SECONDS}s. "
            "Consider splitting into shorter scenes."
        )
    if "policy" in msg or "safety" in msg or "blocked" in msg:
        return VeoPolicyError(
            "This scene was blocked by Veo content policy. "
            "Revise the dialogue or setting and try again."
        )
    if "quota" in msg or "resource exhausted" in msg or "billing" in msg:
        return VeoQuotaError(
            "Veo API quota exceeded. Check billing limits or wait before retrying."
        )
    if "permission" in msg or "forbidden" in msg or "403" in msg or "unauthenticated" in msg:
        return VeoNotConfiguredError(
            "Veo API access denied. Verify the service account has the Vertex AI User role "
            f"in project {settings.VEO_PROJECT_ID}."
        )
    return VeoMalformedResponseError(
        f"Unexpected response from Veo: {type(exc).__name__}: {exc}"
    )


# ── Polling ───────────────────────────────────────────────────────────────────

def _poll_operation(client, operation, timeout: int):
    """
    Poll until the operation is done or timeout is exceeded.
    Returns the google-genai Video object from the first generated video.

    Correct SDK pattern (from docs):
        operation = client.operations.get(operation)   ← not client.models.fetch_video_operation
    """
    deadline = time.monotonic() + timeout
    poll_interval = 10

    while not operation.done:
        if time.monotonic() >= deadline:
            raise VeoTimeoutError(
                f"Scene timed out after {timeout}s while waiting for Veo."
            )
        time.sleep(poll_interval)
        operation = client.operations.get(operation)   # ← correct API

    # Debug: log the full operation structure so we can see what Vertex AI returns
    log.info("Veo operation done. type=%s attrs=%s", type(operation).__name__, dir(operation))
    log.info("Veo operation.response=%s", getattr(operation, "response", "MISSING"))
    log.info("Veo operation.result=%s", getattr(operation, "result", "MISSING"))

    # Try both .response and .result — Vertex AI SDK uses .response, but inspect both
    response = getattr(operation, "response", None) or getattr(operation, "result", None)

    if response is None:
        raise VeoMalformedResponseError("Veo operation completed but response is None.")

    generated_videos = getattr(response, "generated_videos", None)
    log.info("Veo generated_videos=%s", generated_videos)

    if not generated_videos:
        raise VeoMalformedResponseError(
            "Veo operation completed but returned no videos. "
            f"Response type: {type(response).__name__}, attrs: {dir(response)}"
        )

    return generated_videos[0].video


# ── Download ──────────────────────────────────────────────────────────────────

def _download_bytes(video_obj) -> bytes:
    """
    Download a Veo Video object and return raw MP4 bytes.

    For Vertex AI clients, call video_obj.save() directly.
    client.files.download() is Gemini Developer API only and raises ValueError on Vertex AI.
    """
    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_path = tmp.name
    tmp.close()
    try:
        video_obj.save(tmp_path)
        with open(tmp_path, "rb") as f:
            return f.read()
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


# ── Public API ────────────────────────────────────────────────────────────────

def generate_scene(prompt: str) -> tuple:
    """
    Generate the first scene from a text-only prompt.

    Returns:
        (video_obj, mp4_bytes)
        video_obj  — pass to extend_scene() for the next scene
        mp4_bytes  — raw MP4 bytes
    """
    try:
        from google.genai.types import GenerateVideosConfig

        client = _make_client()
        log.info("Veo: generating scene 1 — model=%s prompt_len=%d",
                 settings.VEO_MODEL_ID, len(prompt))

        operation = client.models.generate_videos(
            model=settings.VEO_MODEL_ID,
            prompt=prompt,
            config=GenerateVideosConfig(
                number_of_videos=1,
                aspect_ratio="16:9",
                resolution="720p",
                person_generation="allow_adult",
            ),
        )
        video_obj = _poll_operation(client, operation, settings.VEO_SCENE_TIMEOUT_SECONDS)
        mp4_bytes = _download_bytes(video_obj)
        return video_obj, mp4_bytes

    except (VeoTimeoutError, VeoPolicyError, VeoQuotaError,
            VeoMalformedResponseError, VeoNotConfiguredError):
        raise
    except Exception as exc:
        raise _translate_error(exc) from exc


def extend_scene(prompt: str, previous_video_obj) -> tuple:
    """
    Extend a video by continuing from the previous scene's Video object.

    Pattern from docs:
        client.models.generate_videos(
            model=...,
            video=operation.response.generated_videos[0].video,  ← Video object, not bytes
            prompt=prompt,
            ...
        )

    Returns:
        (video_obj, mp4_bytes)
    """
    try:
        from google.genai.types import GenerateVideosConfig

        client = _make_client()
        log.info("Veo: extending scene — prompt_len=%d", len(prompt))

        operation = client.models.generate_videos(
            model=settings.VEO_MODEL_ID,
            prompt=prompt,
            video=previous_video_obj,   # ← Video object from previous generation
            config=GenerateVideosConfig(
                number_of_videos=1,
                aspect_ratio="16:9",
                resolution="720p",
                person_generation="allow_adult",
            ),
        )
        video_obj = _poll_operation(client, operation, settings.VEO_SCENE_TIMEOUT_SECONDS)
        mp4_bytes = _download_bytes(video_obj)
        return video_obj, mp4_bytes

    except (VeoTimeoutError, VeoPolicyError, VeoQuotaError,
            VeoMalformedResponseError, VeoNotConfiguredError):
        raise
    except Exception as exc:
        raise _translate_error(exc) from exc
