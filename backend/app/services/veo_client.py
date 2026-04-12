"""
Typed wrapper around Google Veo via the google-genai SDK (Vertex AI backend).

Authentication: service account key file at settings.GOOGLE_VEO_KEY_FILE.
All methods are synchronous — the worker runs them in a BackgroundTask thread.

Exceptions raised (user-friendly, no raw API strings leaked):
  VeoTimeoutError            — scene exceeded VEO_SCENE_TIMEOUT_SECONDS
  VeoPolicyError             — prompt violated content policy
  VeoQuotaError              — quota / billing limit hit
  VeoMalformedResponseError  — unexpected response shape
  VeoNotConfiguredError      — key file missing or auth failed
"""
import logging
import time
from pathlib import Path

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


# ── Internal helpers ──────────────────────────────────────────────────────────

def _make_client():
    """Build an authenticated google-genai Client for Vertex AI."""
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


def _translate_error(exc: Exception) -> Exception:
    """Map raw SDK errors to our typed exception hierarchy."""
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
    log.error("Unclassified Veo error: %s", exc)
    return VeoMalformedResponseError(f"Unexpected response from Veo: {type(exc).__name__}")


def _poll_operation(client, operation, timeout: int) -> bytes:
    """
    Poll a GenerateVideosOperation until it completes or times out.
    Returns the raw MP4 bytes of the first generated video.
    """
    from google.genai.types import GenerateVideosOperation

    deadline = time.monotonic() + timeout
    poll_interval = 10  # seconds between polls

    op: GenerateVideosOperation = operation
    while not op.done:
        if time.monotonic() >= deadline:
            raise VeoTimeoutError(
                f"Scene timed out after {timeout}s while waiting for Veo."
            )
        time.sleep(poll_interval)
        op = client.models.fetch_video_operation(operation_name=op.name)

    response = op.result
    if response is None or not response.generated_videos:
        raise VeoMalformedResponseError(
            "Veo operation completed but returned no videos."
        )

    video = response.generated_videos[0].video
    if video is None:
        raise VeoMalformedResponseError("Veo returned a video entry with no content.")

    # Prefer inline bytes; fall back to URI download if needed
    if video.video_bytes:
        return video.video_bytes

    if video.uri:
        log.info("Veo returned GCS URI %s — downloading", video.uri)
        return _download_gcs(video.uri)

    raise VeoMalformedResponseError("Veo video has neither bytes nor URI.")


def _download_gcs(uri: str) -> bytes:
    """Download a gs:// URI using the storage client."""
    try:
        from google.cloud import storage
        bucket_name, blob_path = uri.replace("gs://", "").split("/", 1)
        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_path)
        return blob.download_as_bytes()
    except Exception as exc:
        raise VeoMalformedResponseError(f"Failed to download GCS video: {exc}") from exc


# ── Public API ────────────────────────────────────────────────────────────────

def generate_scene(prompt: str) -> bytes:
    """
    Generate Scene 1 from a text-only prompt.
    Returns raw MP4 bytes.
    Raises VeoNotConfiguredError, VeoPolicyError, VeoQuotaError, VeoTimeoutError,
           VeoMalformedResponseError.
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
                person_generation="allow_adult",
            ),
        )
        return _poll_operation(client, operation, settings.VEO_SCENE_TIMEOUT_SECONDS)

    except (VeoTimeoutError, VeoPolicyError, VeoQuotaError,
            VeoMalformedResponseError, VeoNotConfiguredError):
        raise
    except Exception as exc:
        raise _translate_error(exc) from exc


def extend_scene(prompt: str, previous_clip: bytes) -> bytes:
    """
    Extend a video by starting from the previous scene's clip.
    Returns raw MP4 bytes of the extended/continued clip.
    """
    try:
        from google.genai.types import GenerateVideosConfig, GenerateVideosSource, Video

        client = _make_client()
        log.info("Veo: extending scene — prev_clip=%d bytes prompt_len=%d",
                 len(previous_clip), len(prompt))

        source = GenerateVideosSource(
            prompt=prompt,
            video=Video(video_bytes=previous_clip, mime_type="video/mp4"),
        )
        operation = client.models.generate_videos(
            model=settings.VEO_MODEL_ID,
            prompt=prompt,
            source=source,
            config=GenerateVideosConfig(
                number_of_videos=1,
                aspect_ratio="16:9",
                person_generation="allow_adult",
            ),
        )
        return _poll_operation(client, operation, settings.VEO_SCENE_TIMEOUT_SECONDS)

    except (VeoTimeoutError, VeoPolicyError, VeoQuotaError,
            VeoMalformedResponseError, VeoNotConfiguredError):
        raise
    except Exception as exc:
        raise _translate_error(exc) from exc
