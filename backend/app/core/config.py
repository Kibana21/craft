from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    APP_NAME: str = "CRAFT"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://content_forge_user:PASSWORD@localhost:5432/craft_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Auth
    JWT_SECRET: str = "CHANGE-ME-IN-PRODUCTION"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ALGORITHM: str = "HS256"

    # S3 / R2 Storage
    S3_BUCKET: str = ""
    S3_REGION: str = "ap-southeast-1"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    S3_ENDPOINT_URL: str = ""

    # Google AI (Gemini)
    GOOGLE_API_KEY: str = ""

    # Google Veo (Vertex AI video generation)
    GOOGLE_VEO_KEY_FILE: str = "video-key.json"   # path relative to backend working dir
    VEO_PROJECT_ID: str = "gen-lang-client-0913704662"
    VEO_LOCATION: str = "us-central1"
    VEO_MODEL_ID: str = "veo-3.0-generate-001"
    VEO_SCENE_TIMEOUT_SECONDS: int = 900          # 15 minutes per scene
    VIDEO_POLL_INTERVAL_SECONDS: int = 5

    # Frontend
    FRONTEND_URL: str = "http://localhost:3000"

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
    }


settings = Settings()
