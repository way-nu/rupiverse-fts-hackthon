"""Settings from the environment (and backend/.env). Env vars always win over the file."""

from functools import lru_cache
from pathlib import Path

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parents[2]


class DatabaseSettings(BaseSettings):
    """Only what Alembic needs, so migrations run without the app's secrets."""

    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str


class Settings(DatabaseSettings):
    # Signing / HMAC keys: refuse to start without a real value (an empty key would sign anything).
    jwt_secret: str = Field(min_length=32)
    code_hash_secret: str = Field(min_length=32)
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


class ConfigError(RuntimeError):
    """Startup configuration problem. The message names the env vars only, never their values."""


def load_settings() -> Settings:
    try:
        return Settings()  # values come from the environment (and backend/.env)
    except ValidationError as exc:
        problems = []
        for error in exc.errors():
            name = str(error["loc"][0]).upper() if error.get("loc") else "settings"
            reason = "is missing" if error["type"] == "missing" else "is empty or too short (min 32 characters)"
            if error["type"] not in ("missing", "string_too_short"):
                reason = "is invalid"
            problems.append(f"{name} {reason}")
        raise ConfigError("Invalid configuration: " + "; ".join(problems)) from None


@lru_cache
def get_settings() -> Settings:
    return load_settings()
