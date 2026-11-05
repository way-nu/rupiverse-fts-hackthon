"""RV1 acceptance · SMTP failure: §8 502 email_send_failed for signup and forgot (AC26 shape)."""

import socket
from collections.abc import Iterator

import asyncpg
import httpx
import pytest

from tests.acceptance.conftest import (
    STRONG_PASSWORD,
    Server,
    assert_error,
    new_email,
    server_env,
    start_server,
    stop_server,
)


def _closed_port() -> int:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


@pytest.fixture(scope="module")
def server(database_url: str) -> Iterator[Server]:
    """Real SMTP path (outbox off) pointed at a local port nobody listens on, so every send fails fast."""
    env = server_env(database_url, TEST_OUTBOX_ENABLED="false", SMTP_HOST="127.0.0.1", SMTP_PORT=str(_closed_port()))
    srv = start_server(env, "smtp-failure")
    yield srv
    stop_server(srv.process)


async def test_signup_smtp_error_is_502_and_user_is_kept(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """§8 signup: SMTP error → 502 email_send_failed; the user row is kept (unverified) so they can resend."""
    email = new_email("smtp")
    assert_error(
        await client.post("/auth/signup", json={"email": email, "password": STRONG_PASSWORD}), 502, "email_send_failed"
    )
    row = await db.fetchrow("SELECT is_verified FROM users WHERE email = $1", email)
    assert row is not None and row["is_verified"] is False


async def test_forgot_smtp_error_is_502(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """§8 forgot: SMTP error for a known email → 502 email_send_failed."""
    email = new_email("smtp-forgot")
    await client.post("/auth/signup", json={"email": email, "password": STRONG_PASSWORD})
    assert await db.fetchval("SELECT count(*) FROM users WHERE email = $1", email) == 1
    assert_error(await client.post("/auth/password/forgot", json={"email": email}), 502, "email_send_failed")
