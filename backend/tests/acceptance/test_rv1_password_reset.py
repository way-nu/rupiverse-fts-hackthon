"""RV1 acceptance · forgot / verify reset code / reset: AC3 (reset), AC6 (reset), AC7 (reset), AC15, AC16, AC17,
AC26."""

import asyncpg
import httpx
import pytest

from tests.acceptance.conftest import (
    OTHER_PASSWORD,
    STRONG_PASSWORD,
    allow_resend,
    assert_error,
    assert_token_pair,
    code_row,
    expire_code,
    login,
    new_email,
    other_code,
    outbox,
    sha256_forms,
    signup,
    user_row,
    verified_user,
)

RESET = "reset_password"


async def forgot(client: httpx.AsyncClient, email: str) -> httpx.Response:
    return await client.post("/auth/password/forgot", json={"email": email})


async def verify_code(client: httpx.AsyncClient, email: str, code: str) -> httpx.Response:
    return await client.post("/auth/password/verify-code", json={"email": email, "code": code})


async def reset(client: httpx.AsyncClient, token: str, password: str = OTHER_PASSWORD) -> httpx.Response:
    return await client.post("/auth/password/reset", json={"reset_token": token, "new_password": password})


async def reset_code(client: httpx.AsyncClient, email: str) -> str:
    assert (await forgot(client, email)).status_code == 202
    return (await outbox(client, email, RESET))["code"]


async def reset_token(client: httpx.AsyncClient, email: str) -> str:
    response = await verify_code(client, email, await reset_code(client, email))
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"reset_token", "expires_in"} and body["expires_in"] == 600
    return body["reset_token"]


async def reset_row(db: asyncpg.Connection, token: str) -> asyncpg.Record:
    row = await db.fetchrow(
        "SELECT * FROM password_reset_tokens WHERE token_hash = ANY($1::text[])", list(sha256_forms(token))
    )
    assert row is not None, "reset token not found by its SHA-256 hash"
    return row


# ── AC15 ─────────────────────────────────────────────────────────────────────


async def test_ac15_identical_body_for_known_unknown_and_unverified(client: httpx.AsyncClient) -> None:
    """AC15: forgot → identical 202 body (byte for byte) for verified, unknown and unverified emails."""
    known, _ = await verified_user(client)
    unverified = new_email("unv")
    await signup(client, unverified)

    responses = [await forgot(client, e) for e in (known, new_email("ghost"), unverified)]
    assert [r.status_code for r in responses] == [202, 202, 202]
    assert responses[0].json() == {"status": "reset_code_sent", "retry_after_seconds": 60}
    assert responses[0].content == responses[1].content == responses[2].content


async def test_ac15_only_known_emails_get_a_reset_email(client: httpx.AsyncClient) -> None:
    """AC15: a known (verified or unverified) email receives a reset code; an unknown one receives nothing."""
    known, _ = await verified_user(client)
    unverified = new_email("unv")
    await signup(client, unverified)
    ghost = new_email("ghost")
    for email in (known, unverified, ghost):
        assert (await forgot(client, email)).status_code == 202

    assert (await outbox(client, known, RESET))["purpose"] == RESET
    assert (await outbox(client, unverified, RESET))["purpose"] == RESET
    response = await client.get("/test/outbox/latest", params={"email": ghost, "purpose": RESET})
    assert response.status_code != 200, f"an unknown email must not get a reset email: {response.text}"


async def test_ac15_second_request_within_60s_sends_nothing(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC15: a second forgot within 60 s → still 202, no new email; after 60 s a new code is sent."""
    email, _ = await verified_user(client)
    assert (await forgot(client, email)).status_code == 202
    first = await outbox(client, email, RESET)

    again = await forgot(client, email)
    assert again.status_code == 202
    assert again.json() == {"status": "reset_code_sent", "retry_after_seconds": 60}
    assert await outbox(client, email, RESET) == first

    await allow_resend(db, email, RESET)
    assert (await forgot(client, email)).status_code == 202
    assert (await outbox(client, email, RESET))["sent_at"] != first["sent_at"]


async def test_ac15_reset_code_is_stored_hashed_and_separate(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """§7 + AC14: the reset code is its own email_codes row (purpose reset_password), stored only as a hash."""
    email = new_email("both")
    verify_code_value = await signup(client, email)
    code = await reset_code(client, email)
    row = await code_row(db, email, RESET)
    assert code not in row["code_hash"]
    # The verification code row is untouched by the reset request.
    assert (await client.post("/auth/verify", json={"email": email, "code": verify_code_value})).status_code == 200


@pytest.mark.parametrize("email", ["not-an-email", "", "a@"])
async def test_ac15_forgot_invalid_email_is_422(client: httpx.AsyncClient, email: str) -> None:
    """§8: forgot with a malformed email → 422 invalid_email."""
    assert_error(await forgot(client, email), 422, "invalid_email")


# ── AC6 / AC7 (reset code) ───────────────────────────────────────────────────


async def test_ac6_reset_wrong_codes_count_down_then_lock(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC6 (reset): 2 then 1 attempts remaining, 3rd → code_locked, correct code then also locked."""
    email, _ = await verified_user(client)
    code = await reset_code(client, email)
    wrong = other_code(code)

    assert_error(await verify_code(client, email, wrong), 400, "code_invalid", attempts_remaining=2)
    assert_error(await verify_code(client, email, wrong), 400, "code_invalid", attempts_remaining=1)
    assert_error(await verify_code(client, email, wrong), 400, "code_locked")
    assert_error(await verify_code(client, email, code), 400, "code_locked")
    assert (await code_row(db, email, RESET))["failed_attempts"] == 3


async def test_ac6_reset_lock_clears_after_resend(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC6 (reset): after a resend (forgot again, ≥60 s later) the new code works and attempts are reset."""
    email, _ = await verified_user(client)
    code = await reset_code(client, email)
    for _ in range(3):
        await verify_code(client, email, other_code(code))
    await allow_resend(db, email, RESET)

    new_code = await reset_code(client, email)
    assert (await code_row(db, email, RESET))["failed_attempts"] == 0
    assert (await verify_code(client, email, new_code)).status_code == 200


async def test_ac6_reset_unknown_email_is_code_invalid(client: httpx.AsyncClient) -> None:
    """§8: verify-code for an unknown email → 400 code_invalid."""
    assert_error(await verify_code(client, new_email("ghost"), "123456"), 400, "code_invalid")


async def test_ac6_reset_code_is_single_use(client: httpx.AsyncClient) -> None:
    """§8: verify-code consumes the code; the same code cannot mint a second reset token."""
    email, _ = await verified_user(client)
    code = await reset_code(client, email)
    assert (await verify_code(client, email, code)).status_code == 200
    second = await verify_code(client, email, code)
    assert second.status_code == 400, second.text
    assert second.json()["error"] in {"code_invalid", "code_expired", "code_locked"}


async def test_ac7_reset_code_older_than_10_min_is_expired(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC7 (reset): a reset code older than 10 min → 400 code_expired."""
    email, _ = await verified_user(client)
    code = await reset_code(client, email)
    await expire_code(db, email, RESET)
    assert_error(await verify_code(client, email, code), 400, "code_expired")


# ── AC16 ─────────────────────────────────────────────────────────────────────


async def test_ac16_reset_token_is_hashed_and_lives_10_minutes(
    client: httpx.AsyncClient, db: asyncpg.Connection
) -> None:
    """AC16: the reset token is opaque, stored only as a SHA-256 hash, and expires 10 min after issue."""
    email, _ = await verified_user(client)
    token = await reset_token(client, email)
    assert token.count(".") != 2, "reset token must be opaque, not a JWT"
    row = await reset_row(db, token)
    assert token not in {str(v) for v in dict(row).values()}
    lifetime = (row["expires_at"] - row["created_at"]).total_seconds()
    assert abs(lifetime - 600) < 60, lifetime
    user = await user_row(db, email)
    assert row["user_id"] == user["id"]


async def test_ac16_reset_token_works_once(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC16: the reset token works once; reusing it → 400 invalid_reset_token."""
    email, _ = await verified_user(client)
    token = await reset_token(client, email)
    assert (await reset(client, token)).status_code == 204
    row = await reset_row(db, token)
    assert row["used_at"] is not None
    assert_error(await reset(client, token, "Third@Pass3"), 400, "invalid_reset_token")
    assert (await login(client, email, "Third@Pass3")).status_code == 401


async def test_ac16_expired_reset_token(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC16: a reset token older than 10 min → 400 invalid_reset_token; the password is unchanged."""
    email, _ = await verified_user(client)
    token = await reset_token(client, email)
    row = await reset_row(db, token)
    await db.execute(
        "UPDATE password_reset_tokens SET expires_at = now() - interval '1 second' WHERE id = $1", row["id"]
    )
    assert_error(await reset(client, token), 400, "invalid_reset_token")
    assert (await login(client, email, STRONG_PASSWORD)).status_code == 200


async def test_ac16_unknown_reset_token(client: httpx.AsyncClient) -> None:
    """AC16: an unknown reset token → 400 invalid_reset_token."""
    assert_error(await reset(client, "not-a-real-reset-token"), 400, "invalid_reset_token")


# ── AC3 (reset) ──────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("password", "code"),
    [
        pytest.param("Ab1!xyz", "password_too_short", id="7-bytes"),
        pytest.param("Ab1!" + "€" * 23, "password_too_long", id="73-bytes-multibyte"),
        pytest.param("abcdefg1!", "password_too_weak", id="no-uppercase"),
        pytest.param("ABCDEFG1!", "password_too_weak", id="no-lowercase"),
        pytest.param("Abcdefgh!", "password_too_weak", id="no-digit"),
        pytest.param("Abcdefgh1", "password_too_weak", id="no-special"),
    ],
)
async def test_ac3_reset_enforces_password_policy(client: httpx.AsyncClient, password: str, code: str) -> None:
    """AC3 (reset): the same policy applies to the new password; a rejected reset leaves the token usable."""
    email, _ = await verified_user(client)
    token = await reset_token(client, email)
    assert_error(await reset(client, token, password), 422, code)
    assert (await reset(client, token, OTHER_PASSWORD)).status_code == 204


# ── AC17 ─────────────────────────────────────────────────────────────────────


async def test_ac17_reset_changes_password(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC17: after reset the old password fails login and the new one works; hash is bcrypt."""
    email, _ = await verified_user(client)
    before = (await user_row(db, email))["password_hash"]
    assert (await reset(client, await reset_token(client, email), OTHER_PASSWORD)).status_code == 204

    after = await user_row(db, email)
    assert after["password_hash"] != before and after["password_hash"].startswith(("$2a$", "$2b$", "$2y$"))
    assert_error(await login(client, email, STRONG_PASSWORD), 401, "invalid_credentials")
    assert_token_pair(await login(client, email, OTHER_PASSWORD), email)


async def test_ac17_reset_revokes_all_sessions(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC17: every refresh token the user holds → 401 after a reset."""
    email, first = await verified_user(client)
    second = assert_token_pair(await login(client, email), email)
    third = assert_token_pair(await login(client, email), email)

    assert (await reset(client, await reset_token(client, email))).status_code == 204
    for pair in (first, second, third):
        assert_error(
            await client.post("/auth/refresh", json={"refresh_token": pair["refresh_token"]}),
            401,
            "invalid_refresh_token",
        )
    user = await user_row(db, email)
    live = await db.fetchval(
        "SELECT count(*) FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL", user["id"]
    )
    assert live == 0


async def test_ac17_reset_marks_unverified_account_verified(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC17: a reset on an unverified account marks it verified; login then works (no 403)."""
    email = new_email("unv-reset")
    await signup(client, email)
    assert (await reset(client, await reset_token(client, email), OTHER_PASSWORD)).status_code == 204

    user = await user_row(db, email)
    assert user["is_verified"] is True and user["verified_at"] is not None
    assert_token_pair(await login(client, email, OTHER_PASSWORD), email)


async def test_ac17_reset_does_not_log_the_user_in(client: httpx.AsyncClient) -> None:
    """§8: reset returns 204 with no body (no tokens; the user goes to Login)."""
    email, _ = await verified_user(client)
    response = await reset(client, await reset_token(client, email))
    assert response.status_code == 204 and response.content == b""
