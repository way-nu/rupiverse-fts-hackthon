"""Settings from the environment (and backend/.env). Env vars always win over the file."""

from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class DatabaseSettings(BaseSettings):
    """Only what Alembic needs, so migrations run without the app's secrets."""

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str


class Settings(DatabaseSettings):
    jwt_secret: str
    code_hash_secret: str
    access_token_ttl_min: int = 15
    refresh_token_ttl_days: int = 30

    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_app_password: str = ""
    smtp_from: str = ""

    cors_origins: str = ""
    app_env: str = "development"
    test_outbox_enabled: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.strip().lower() == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()  # values come from the environment
