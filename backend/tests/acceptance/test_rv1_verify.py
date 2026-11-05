"""RV1 acceptance · email verification + resend: AC5, AC6 (verify), AC7 (verify), AC8, AC25 (updated_at), AC26."""

import asyncpg
import httpx

from tests.acceptance.conftest import (
    allow_resend,
    assert_error,
    assert_token_pair,
    code_row,
    expire_code,
    jwt_payload,
    new_email,
    other_code,
    outbox,
    signup,
    user_row,
)


async def verify(client: httpx.AsyncClient, email: str, code: str) -> httpx.Response:
    return await client.post("/auth/verify", json={"email": email, "code": code})


# ── AC5 ──────────────────────────────────────────────────────────────────────


async def test_ac5_correct_code_returns_token_pair_and_verifies(
    client: httpx.AsyncClient, db: asyncpg.Connection
) -> None:
    """AC5: correct code within 10 min → 200 TokenPair, user verified, code consumed."""
    email = new_email("verify")
    code = await signup(client, email)

    body = assert_token_pair(await verify(client, email, code), email)
    assert body["user"]["is_verified"] is True

    user = await user_row(db, email)
    assert user["is_verified"] is True and user["verified_at"] is not None
    assert str(user["id"]) == body["user"]["id"]
    claims = jwt_payload(body["access_token"])
    assert claims["sub"] == str(user["id"]) and claims["type"] == "access"
    assert (await code_row(db, email))["consumed_at"] is not None


async def test_ac5_same_code_cannot_be_used_twice(client: httpx.AsyncClient) -> None:
    """AC5: the code is single-use; a second verify → 409 already_verified."""
    email = new_email("twice")
    code = await signup(client, email)
    assert (await verify(client, email, code)).status_code == 200
    assert_error(await verify(client, email, code), 409, "already_verified")


async def test_ac5_code_just_under_10_minutes_still_works(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC5: 'within 10 min' — a code sent 9 min 50 s ago still verifies."""
    email = new_email("nine")
    code = await signup(client, email)
    await db.execute(
        "UPDATE email_codes c SET sent_at = c.sent_at - interval '590 seconds', "
        "expires_at = c.expires_at - interval '590 seconds' FROM users u WHERE u.id = c.user_id AND u.email = $1",
        email,
    )
    assert (await verify(client, email, code)).status_code == 200


async def test_ac25_verify_sets_updated_by_and_moves_updated_at(
    client: httpx.AsyncClient, db: asyncpg.Connection
) -> None:
    """AC25: verify moves users.updated_at forward and sets users.updated_by = the user's id (code row too)."""
    email = new_email("audit")
    code = await signup(client, email)
    before = await user_row(db, email)
    await db.execute("UPDATE users SET updated_at = updated_at - interval '1 minute' WHERE id = $1", before["id"])
    stamped = (await user_row(db, email))["updated_at"]

    assert (await verify(client, email, code)).status_code == 200
    after = await user_row(db, email)
    assert after["updated_by"] == after["id"]
    assert after["updated_at"] > stamped
    assert after["created_by"] is None
    assert (await code_row(db, email))["updated_by"] == after["id"]


# ── AC6 (verify) ─────────────────────────────────────────────────────────────


async def test_ac6_verify_wrong_codes_count_down_then_lock(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC6: wrong #1 → code_invalid (2 left), #2 → code_invalid (1 left), #3 → code_locked; then correct → locked."""
    email = new_email("lock")
    code = await signup(client, email)
    wrong = other_code(code)

    assert_error(await verify(client, email, wrong), 400, "code_invalid", attempts_remaining=2)
    assert_error(await verify(client, email, wrong), 400, "code_invalid", attempts_remaining=1)
    assert_error(await verify(client, email, wrong), 400, "code_locked")
    assert_error(await verify(client, email, code), 400, "code_locked")
    assert_error(await verify(client, email, wrong), 400, "code_locked")

    row = await code_row(db, email)
    assert row["failed_attempts"] == 3
    assert (await user_row(db, email))["is_verified"] is False


async def test_ac6_verify_lock_clears_after_resend(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC6: a locked code stays rejected until a resend; the new code then verifies."""
    email = new_email("unlock")
    code = await signup(client, email)
    for _ in range(3):
        await verify(client, email, other_code(code))
    await allow_resend(db, email)

    assert (await client.post("/auth/resend", json={"email": email})).status_code == 202
    new_code = (await outbox(client, email))["code"]
    assert_token_pair(await verify(client, email, new_code), email)


async def test_ac6_verify_unknown_email_is_code_invalid(client: httpx.AsyncClient) -> None:
    """§8: unknown email on verify → code_invalid (no enumeration)."""
    body = assert_error(await verify(client, new_email("ghost"), "123456"), 400, "code_invalid")
    assert "attempts_remaining" not in body or body["attempts_remaining"] in (1, 2)


async def test_ac6_correct_code_after_one_wrong_still_works(client: httpx.AsyncClient) -> None:
    """AC6: the lock only comes on the 3rd wrong attempt; the correct code after 1 wrong verifies."""
    email = new_email("onewrong")
    code = await signup(client, email)
    assert_error(await verify(client, email, other_code(code)), 400, "code_invalid", attempts_remaining=2)
    assert (await verify(client, email, code)).status_code == 200


# ── AC7 (verify) ─────────────────────────────────────────────────────────────


async def test_ac7_verify_code_older_than_10_min_is_expired(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC7: a verification code older than 10 min → 400 code_expired, user stays unverified."""
    email = new_email("expired")
    code = await signup(client, email)
    await expire_code(db, email)
    assert_error(await verify(client, email, code), 400, "code_expired")
    assert (await user_row(db, email))["is_verified"] is False


# ── AC8 ──────────────────────────────────────────────────────────────────────


async def test_ac8_resend_within_60s_is_429(client: httpx.AsyncClient) -> None:
    """AC8: resend within 60 s → 429 resend_too_soon with retry_after_seconds (1..60)."""
    email = new_email("soon")
    await signup(client, email)
    body = assert_error(
        await client.post("/auth/resend", json={"email": email}), 429, "resend_too_soon", retry_after_seconds=...
    )
    assert isinstance(body["retry_after_seconds"], int) and 1 <= body["retry_after_seconds"] <= 60


async def test_ac8_resend_after_60s_issues_new_code_and_resets_attempts(
    client: httpx.AsyncClient, db: asyncpg.Connection
) -> None:
    """AC8: after 60 s → 202, new code, old code invalid, attempts reset to 0."""
    email = new_email("resend")
    old_code = await signup(client, email)
    old_sent = await outbox(client, email)
    for _ in range(2):
        await verify(client, email, other_code(old_code))
    assert (await code_row(db, email))["failed_attempts"] == 2
    await allow_resend(db, email)

    response = await client.post("/auth/resend", json={"email": email})
    assert response.status_code == 202, response.text
    assert response.json() == {"status": "verification_sent", "retry_after_seconds": 60}

    new_sent = await outbox(client, email)
    assert new_sent["sent_at"] != old_sent["sent_at"]
    row = await code_row(db, email)
    assert row["failed_attempts"] == 0 and row["consumed_at"] is None

    if new_sent["code"] != old_code:
        # Old code is dead; and attempts were reset, so this wrong try reports 2 left.
        assert_error(await verify(client, email, old_code), 400, "code_invalid", attempts_remaining=2)
    assert (await verify(client, email, new_sent["code"])).status_code == 200


async def test_ac8_resend_restarts_the_60s_window(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC8: right after a successful resend, another resend is too soon again."""
    email = new_email("window")
    await signup(client, email)
    await allow_resend(db, email)
    assert (await client.post("/auth/resend", json={"email": email})).status_code == 202
    assert_error(
        await client.post("/auth/resend", json={"email": email}), 429, "resend_too_soon", retry_after_seconds=...
    )


async def test_ac8_resend_unknown_email_is_202(client: httpx.AsyncClient) -> None:
    """§8: unknown email on resend → 202, same body (no enumeration)."""
    response = await client.post("/auth/resend", json={"email": new_email("ghost")})
    assert response.status_code == 202, response.text
    assert response.json() == {"status": "verification_sent", "retry_after_seconds": 60}


async def test_ac8_resend_for_verified_email_is_409(client: httpx.AsyncClient) -> None:
    """§8: resend for a verified account → 409 already_verified."""
    email = new_email("done")
    code = await signup(client, email)
    assert (await verify(client, email, code)).status_code == 200
    assert_error(await client.post("/auth/resend", json={"email": email}), 409, "already_verified")
