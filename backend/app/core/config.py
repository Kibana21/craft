from pydantic import model_validator
from pydantic_settings import BaseSettings

# Sentinel values that must never be accepted in a real deployment.
# Anyone seeing one of these at boot has left a placeholder in .env.
_PLACEHOLDER_SECRETS = {
    "CHANGE-ME-IN-PRODUCTION",
    "dev-only-change-in-production",
    "changeme",
}


class Settings(BaseSettings):
    """Environment-driven configuration.

    This class is the *schema* for env vars — the actual values live in
    backend/.env (git-ignored). Declaring them here buys type coercion,
    mypy coverage, and a single startup-time failure when something is
    missing instead of cryptic errors inside request handlers.

    Fields with no default are REQUIRED — the app refuses to boot unless
    they are set in .env. Fields with an empty-string default are optional
    (the feature that uses them degrades gracefully).
    """

    # ── App ────────────────────────────────────────────────────────────────
    APP_NAME: str = "CRAFT"
    DEBUG: bool = False

    # ── Required secrets — no default, must come from .env ─────────────────
    DATABASE_URL: str   # e.g. postgresql+asyncpg://user:pass@host:5432/db
    JWT_SECRET: str     # rotate per environment; 64+ random chars in prod

    # ── Auth knobs (safe defaults) ─────────────────────────────────────────
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"

    # ── Redis (localhost default OK for dev; override in prod) ─────────────
    REDIS_URL: str = "redis://localhost:6379"

    # ── S3 / R2 Storage (optional — empty means fall back to local uploads) ─
    S3_BUCKET: str = ""
    S3_REGION: str = "ap-southeast-1"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_ENDPOINT_URL: str = ""

    # ── Google AI (Gemini) — optional; AI features fail gracefully ─────────
    GOOGLE_API_KEY: str = ""

    # ── Google Veo (Vertex AI video) — optional; video features fail gracefully ─
    GOOGLE_VEO_KEY_FILE: str = ""
    VEO_PROJECT_ID: str = ""
    VEO_LOCATION: str = "us-central1"
    VEO_MODEL_ID: str = "veo-3.0-generate-001"
    VEO_SCENE_TIMEOUT_SECONDS: int = 900
    VIDEO_POLL_INTERVAL_SECONDS: int = 5

    # ── Frontend origin (CORS allow-list) ──────────────────────────────────
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }

    @model_validator(mode="after")
    def _reject_placeholder_secrets(self) -> "Settings":
        if self.JWT_SECRET in _PLACEHOLDER_SECRETS:
            raise ValueError(
                "JWT_SECRET is still a placeholder value. Set a real secret "
                "in backend/.env before running the app."
            )
        return self


settings = Settings()
