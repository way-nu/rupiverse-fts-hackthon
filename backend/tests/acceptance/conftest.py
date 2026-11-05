"""RV1 acceptance harness (Tester-owned).

These tests are black-box: they talk to a real uvicorn process over HTTP and inspect the database only through the
schema the Spec defines (§7). They never import application code, so they test the contract, not the implementation.

How it works:
- A throwaway database is created from TEST_DATABASE_URL (env or backend/.env) and migrated with `alembic upgrade head`.
- Each test module starts its own server on RV1_ACCEPTANCE_PORT (default 8002, the Tester's port) with the env it needs,
  so modules can use different configs (outbox on, outbox off, broken SMTP, production guard).
- Time-based rules (10 min codes, 60 s resend, token expiry) are exercised by moving timestamps back in the DB, which is
  equivalent to waiting, and by forging JWTs with the test JWT_SECRET.
- Codes are read from the test outbox `GET /test/outbox/latest` (Spec §8).
"""

import asyncio
import base64
import hashlib
import hmac
import json
import os
import re
import socket
import subprocess
import sys
import time
import uuid
from collections.abc import AsyncIterator, Iterator
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import asyncpg
import httpx
import pytest

BACKEND_DIR = Path(__file__).resolve().parents[2]
PORT = int(os.environ.get("RV1_ACCEPTANCE_PORT", "8002"))
HOST = "127.0.0.1"
LOG_DIR = BACKEND_DIR / ".pytest_cache" / "rv1-acceptance-logs"

JWT_SECRET = "rv1-acceptance-jwt-secret-0123456789abcdef"
CODE_HASH_SECRET = "rv1-acceptance-code-secret-0123456789abcdef"
STRONG_PASSWORD = "Rupi@2026x"
OTHER_PASSWORD = "Verse#2027y"

ERROR_KEYS = {"error", "detail"}
ALLOWED_EXTRA_ERROR_KEYS = {"attempts_remaining", "retry_after_seconds", "email", "fields"}

AUDIT_COLUMNS = ("id", "created_at", "created_by", "updated_at", "updated_by", "deleted_at", "deleted_by")
RV1_TABLES = ("users", "email_codes", "password_reset_tokens", "refresh_tokens")


# ── env / database ────────────────────────────────────────────────────────────


def _dotenv() -> dict[str, str]:
    path = BACKEND_DIR / ".env"
    values: dict[str, str] = {}
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def _test_database_url() -> str:
    url = os.environ.get("TEST_DATABASE_URL") or _dotenv().get("TEST_DATABASE_URL")
    if not url:
        pytest.exit("TEST_DATABASE_URL is not set (env or backend/.env); acceptance tests need a local Postgres.", 2)
    return url


def _with_database(url: str, name: str) -> str:
    base, sep, query = url.partition("?")
    return f"{base.rsplit('/', 1)[0]}/{name}{sep}{query}"


def pg_dsn(url: str) -> str:
    """SQLAlchemy URL -> plain libpq DSN for asyncpg."""
    return re.sub(r"^postgresql\+\w+://", "postgresql://", url)


async def _admin(sql: str) -> None:
    conn = await asyncpg.connect(pg_dsn(_test_database_url()))
    try:
        await conn.execute(sql)
    finally:
        await conn.close()


def create_database(prefix: str = "rv1_acc") -> str:
    """Create an empty throwaway database; returns its SQLAlchemy URL (postgresql+asyncpg://...)."""
    name = f"{prefix}_{uuid.uuid4().hex[:10]}"
    asyncio.run(_admin(f'CREATE DATABASE "{name}"'))
    return _with_database(_test_database_url(), name)


def drop_database(url: str) -> None:
    name = url.rsplit("/", 1)[1].split("?", 1)[0]
    asyncio.run(_admin(f'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)'))


def alembic(database_url: str, *args: str) -> subprocess.CompletedProcess[str]:
    env = {**os.environ, "DATABASE_URL": database_url, **_secret_env()}
    return subprocess.run(
        [sys.executable, "-m", "alembic", *args],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=120,
    )


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    """A freshly migrated throwaway database shared by the server-backed modules."""
    url = create_database()
    result = alembic(url, "upgrade", "head")
    if result.returncode != 0:
        drop_database(url)
        pytest.fail(f"alembic upgrade head failed:\n{result.stdout}\n{result.stderr}")
    yield url
    drop_database(url)


@pytest.fixture
async def db(database_url: str) -> AsyncIterator[asyncpg.Connection]:
    conn = await asyncpg.connect(pg_dsn(database_url))
    try:
        yield conn
    finally:
        await conn.close()


# ── server ────────────────────────────────────────────────────────────────────


def _secret_env() -> dict[str, str]:
    return {
        "JWT_SECRET": JWT_SECRET,
        "CODE_HASH_SECRET": CODE_HASH_SECRET,
        "ACCESS_TOKEN_TTL_MIN": "15",
        "REFRESH_TOKEN_TTL_DAYS": "30",
    }


def server_env(database_url: str, **overrides: str | None) -> dict[str, str]:
    env = {
        **os.environ,
        **_secret_env(),
        "DATABASE_URL": database_url,
        "APP_ENV": "test",
        "TEST_OUTBOX_ENABLED": "true",
        "SMTP_HOST": "smtp.gmail.com",
        "SMTP_PORT": "587",
        "SMTP_USER": "rv1-acceptance@example.com",
        "SMTP_APP_PASSWORD": "not-a-real-password",
        "SMTP_FROM": "rv1-acceptance@example.com",
        "CORS_ORIGINS": "http://localhost:8082",
    }
    for key, value in overrides.items():
        if value is None:
            env.pop(key, None)
        else:
            env[key] = value
    return env


def _port_open() -> bool:
    with socket.socket() as sock:
        sock.settimeout(0.2)
        return sock.connect_ex((HOST, PORT)) == 0


@dataclass
class Server:
    base_url: str
    log_path: Path
    process: subprocess.Popen[bytes]

    def log_text(self) -> str:
        return self.log_path.read_text(errors="replace") if self.log_path.exists() else ""


def start_server(env: dict[str, str], name: str) -> Server:
    if _port_open():
        pytest.fail(f"port {PORT} is already in use; stop whatever runs there before the acceptance tests")
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    log_path = LOG_DIR / f"{name}.log"
    log = log_path.open("wb")
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", HOST, "--port", str(PORT)],
        cwd=BACKEND_DIR,
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
    )
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        if process.poll() is not None:
            pytest.fail(f"server '{name}' exited with {process.returncode}:\n{log_path.read_text(errors='replace')}")
        if _port_open():
            return Server(f"http://{HOST}:{PORT}", log_path, process)
        time.sleep(0.2)
    stop_server(process)
    pytest.fail(f"server '{name}' did not start within 30 s:\n{log_path.read_text(errors='replace')}")


def stop_server(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is None:
        process.terminate()
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


@pytest.fixture(scope="module")
def server(database_url: str, request: pytest.FixtureRequest) -> Iterator[Server]:
    """Default server: outbox on, APP_ENV=test. Modules needing another config define their own `server` fixture."""
    srv = start_server(server_env(database_url), request.module.__name__.rsplit(".", 1)[-1])
    yield srv
    stop_server(srv.process)


@pytest.fixture
async def client(server: Server) -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(base_url=server.base_url, timeout=30) as http:
        yield http


# ── helpers ───────────────────────────────────────────────────────────────────


def new_email(tag: str = "user") -> str:
    return f"rv1-{tag}-{uuid.uuid4().hex[:12]}@example.com"


def assert_error(response: httpx.Response, status: int, code: str, **extra: Any) -> dict[str, Any]:
    """AC26: every error is {"error": "<code>", "detail": "<text>"} plus only the extra fields listed in Spec §8."""
    assert response.status_code == status, f"expected {status} {code}, got {response.status_code}: {response.text}"
    body = response.json()
    assert isinstance(body, dict), body
    assert ERROR_KEYS <= body.keys(), f"error body must have 'error' and 'detail': {body}"
    assert body.keys() - ERROR_KEYS <= ALLOWED_EXTRA_ERROR_KEYS, f"unexpected keys in error body: {body}"
    assert body["error"] == code, body
    assert isinstance(body["detail"], str) and body["detail"], body
    for key, value in extra.items():
        assert key in body, f"missing '{key}' in {body}"
        if value is not ...:
            assert body[key] == value, f"{key}: expected {value!r}, got {body[key]!r}"
    return body


def assert_token_pair(response: httpx.Response, email: str, status: int = 200) -> dict[str, Any]:
    assert response.status_code == status, response.text
    body = response.json()
    assert set(body) >= {"access_token", "refresh_token", "token_type", "expires_in", "user"}, body
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == 900
    assert isinstance(body["access_token"], str) and body["access_token"]
    assert isinstance(body["refresh_token"], str) and body["refresh_token"]
    assert set(body["user"]) >= {"id", "email", "is_verified", "created_at"}, body["user"]
    assert body["user"]["email"] == email.strip().lower()
    return body


def other_code(code: str) -> str:
    return f"{(int(code) + 1) % 1_000_000:06d}"


def jwt_payload(token: str) -> dict[str, Any]:
    segment = token.split(".")[1]
    return json.loads(base64.urlsafe_b64decode(segment + "=" * (-len(segment) % 4)))


def forge_jwt(claims: dict[str, Any], secret: str = JWT_SECRET) -> str:
    def b64(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

    header = b64(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode())
    payload = b64(json.dumps(claims, separators=(",", ":")).encode())
    signature = hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    return f"{header}.{payload}.{b64(signature)}"


def sha256_forms(token: str) -> set[str]:
    """SHA-256 of an opaque token, as hex or base64(url) — Spec says SHA-256 but not the text encoding."""
    digest = hashlib.sha256(token.encode()).digest()
    return {
        digest.hex(),
        base64.b64encode(digest).decode(),
        base64.urlsafe_b64encode(digest).decode(),
        base64.urlsafe_b64encode(digest).decode().rstrip("="),
    }


async def outbox(client: httpx.AsyncClient, email: str, purpose: str = "verify_email") -> dict[str, Any]:
    response = await client.get("/test/outbox/latest", params={"email": email, "purpose": purpose})
    assert response.status_code == 200, f"no {purpose} email in the outbox for {email}: {response.text}"
    body = response.json()
    assert set(body) >= {"email", "purpose", "code", "sent_at"}, body
    assert re.fullmatch(r"\d{6}", body["code"]), body
    return body


async def signup(client: httpx.AsyncClient, email: str, password: str = STRONG_PASSWORD) -> str:
    """Sign up and return the emailed verification code."""
    response = await client.post("/auth/signup", json={"email": email, "password": password})
    assert response.status_code == 201, response.text
    return (await outbox(client, email))["code"]


async def verified_user(client: httpx.AsyncClient, password: str = STRONG_PASSWORD) -> tuple[str, dict[str, Any]]:
    """A verified user; returns (email, TokenPair from /auth/verify)."""
    email = new_email("verified")
    code = await signup(client, email, password)
    response = await client.post("/auth/verify", json={"email": email, "code": code})
    return email, assert_token_pair(response, email)


async def login(client: httpx.AsyncClient, email: str, password: str = STRONG_PASSWORD) -> httpx.Response:
    return await client.post("/auth/login", json={"email": email, "password": password})


async def user_row(db: asyncpg.Connection, email: str) -> asyncpg.Record:
    row = await db.fetchrow("SELECT * FROM public.users WHERE email = $1", email.strip().lower())
    assert row is not None, f"no users row for {email}"
    return row


async def code_row(db: asyncpg.Connection, email: str, purpose: str = "verify_email") -> asyncpg.Record:
    row = await db.fetchrow(
        "SELECT c.* FROM public.email_codes c JOIN public.users u ON u.id = c.user_id "
        "WHERE u.email = $1 AND c.purpose = $2",
        email.strip().lower(),
        purpose,
    )
    assert row is not None, f"no {purpose} email_codes row for {email}"
    return row


async def age_code(db: asyncpg.Connection, email: str, purpose: str, seconds: int) -> None:
    """Pretend `seconds` have passed since the code was sent (moves sent_at and expires_at back)."""
    await db.execute(
        "UPDATE public.email_codes c SET sent_at = c.sent_at - make_interval(secs => $3), "
        "expires_at = c.expires_at - make_interval(secs => $3) "
        "FROM public.users u WHERE u.id = c.user_id AND u.email = $1 AND c.purpose = $2",
        email.strip().lower(),
        purpose,
        float(seconds),
    )


async def allow_resend(db: asyncpg.Connection, email: str, purpose: str = "verify_email") -> None:
    """61 s have passed: a resend is allowed, the code itself has not expired yet."""
    await age_code(db, email, purpose, 61)


async def expire_code(db: asyncpg.Connection, email: str, purpose: str = "verify_email") -> None:
    """10 min + 1 s have passed since the code was sent."""
    await age_code(db, email, purpose, 601)
