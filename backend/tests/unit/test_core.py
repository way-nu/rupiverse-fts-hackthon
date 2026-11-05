import logging

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.core.config import Settings
from app.core.errors import AppError, install_error_handlers
from app.core.logging import RedactionFilter, redact
from app.main import UnsafeConfigError, check_settings


def _settings(**values: object) -> Settings:
    base: dict[str, object] = {"database_url": "postgresql+asyncpg://x@y/z", "jwt_secret": "j", "code_hash_secret": "c"}
    return Settings(**{**base, **values})  # type: ignore[arg-type]


def test_outbox_in_production_refuses_to_start() -> None:
    with pytest.raises(UnsafeConfigError):
        check_settings(_settings(test_outbox_enabled=True, app_env="production"))
    check_settings(_settings(test_outbox_enabled=True, app_env="test"))
    check_settings(_settings(test_outbox_enabled=False, app_env="production"))


@pytest.mark.parametrize(
    "secret",
    [
        "someone@example.com",
        "123456",
        "$2b$12$" + "a" * 53,
        "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl",
        "Zx9_kP2-qR7sT4uV1wX3yZ5aB8cD",
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    ],
)
def test_redaction_masks_secrets(secret: str) -> None:
    assert secret not in redact(f"value={secret} done")


def test_redaction_keeps_ordinary_paths() -> None:
    line = '127.0.0.1:54321 - "POST /auth/password/verify-code HTTP/1.1" 400'
    assert redact(line) == line


def test_redaction_filter_rewrites_args() -> None:
    record = logging.LogRecord("x", logging.INFO, __file__, 1, "sent to %s", ("a@example.com",), None)
    RedactionFilter().filter(record)
    assert "a@example.com" not in record.getMessage()


class _Body(BaseModel):
    email: str
    password: str


def _client() -> TestClient:
    app = FastAPI()
    install_error_handlers(app)

    @app.post("/echo")
    async def echo(body: _Body) -> dict[str, str]:
        raise AppError("code_invalid", 400, "nope", attempts_remaining=2)

    return TestClient(app)


def test_app_error_is_flat_with_extras() -> None:
    response = _client().post("/echo", json={"email": "a@b.co", "password": "p"})
    assert response.status_code == 400
    assert response.json() == {"error": "code_invalid", "detail": "nope", "attempts_remaining": 2}


def test_validation_error_is_flat_and_never_echoes_values() -> None:
    response = _client().post("/echo", json={"email": "a@b.co", "password": 12345678})
    assert response.status_code == 422
    body = response.json()
    assert body["error"] == "invalid_request" and body["fields"] == ["password"]
    assert "12345678" not in response.text


def test_missing_field_is_invalid_request() -> None:
    response = _client().post("/echo", json={"password": "x"})
    assert response.json() == {
        "error": "invalid_request",
        "detail": response.json()["detail"],
        "fields": ["email"],
    }


def test_unknown_route_uses_the_error_shape() -> None:
    response = _client().get("/nope")
    assert response.status_code == 404 and response.json()["error"] == "not_found"
