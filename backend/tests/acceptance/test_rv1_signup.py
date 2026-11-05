"""RV1 acceptance · signup: AC2, AC3 (signup), AC4, AC26."""

import asyncpg
import httpx
import pytest

from tests.acceptance.conftest import (
    OTHER_PASSWORD,
    STRONG_PASSWORD,
    allow_resend,
    assert_error,
    code_row,
    login,
    new_email,
    outbox,
    signup,
    user_row,
)

# ── AC2 ──────────────────────────────────────────────────────────────────────


async def test_ac2_signup_creates_unverified_user_and_emails_a_code(
    client: httpx.AsyncClient, db: asyncpg.Connection
) -> None:
    """AC2: 201 {"status": "verification_sent", "email"}, unverified user with a bcrypt hash, one 6-digit code."""
    email = new_email("signup")
    response = await client.post("/auth/signup", json={"email": email, "password": STRONG_PASSWORD})

    assert response.status_code == 201, response.text
    assert response.json() == {"status": "verification_sent", "email": email}

    user = await user_row(db, email)
    assert user["is_verified"] is False
    assert user["verified_at"] is None
    assert user["password_hash"].startswith(("$2a$", "$2b$", "$2y$")), "password must be a bcrypt hash"
    assert STRONG_PASSWORD not in user["password_hash"]

    sent = await outbox(client, email)
    assert sent["email"] == email and sent["purpose"] == "verify_email"


async def test_ac2_db_holds_only_the_code_hash(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC2: email_codes holds a hash of the code, never the code itself."""
    email = new_email("hash")
    code = await signup(client, email)
    row = await code_row(db, email)
    for value in dict(row).values():
        assert str(value) != code
    assert code not in row["code_hash"]
    assert len(row["code_hash"]) >= 40, "code_hash should be an HMAC-SHA256 digest"
    assert row["failed_attempts"] == 0 and row["consumed_at"] is None


async def test_ac2_signup_sends_one_code_email(client: httpx.AsyncClient) -> None:
    """AC2: signup sends one verification email; nothing else is sent right after it."""
    email = new_email("one")
    assert (await client.post("/auth/signup", json={"email": email, "password": STRONG_PASSWORD})).status_code == 201
    sent = await outbox(client, email)
    assert_error(
        await client.post("/auth/resend", json={"email": email}), 429, "resend_too_soon", retry_after_seconds=...
    )
    assert await outbox(client, email) == sent


async def test_ac25_signup_by_columns(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC25 (ruling 2026-11-06): a brand-new signup's users row has created_by / updated_by NULL; its code row is
    created_by / updated_by the owning user_id."""
    email = new_email("audit")
    await signup(client, email)
    user = await user_row(db, email)
    assert user["created_by"] is None and user["updated_by"] is None
    assert user["deleted_at"] is None and user["deleted_by"] is None
    code = await code_row(db, email)
    assert code["created_by"] == user["id"] and code["updated_by"] == user["id"]


# ── AC3 (signup) ─────────────────────────────────────────────────────────────

PASSWORD_CASES = [
    pytest.param("Ab1!xyz", 422, "password_too_short", id="7-bytes"),
    pytest.param("Ab1!" + "x" * 69, 422, "password_too_long", id="73-bytes-ascii"),
    pytest.param("Ab1!" + "€" * 23, 422, "password_too_long", id="73-bytes-27-chars-multibyte"),
    pytest.param("ab1!abcd", 422, "password_too_weak", id="no-uppercase"),
    pytest.param("AB1!ABCD", 422, "password_too_weak", id="no-lowercase"),
    pytest.param("Abc!abcd", 422, "password_too_weak", id="no-digit"),
    pytest.param("Abc1abcd", 422, "password_too_weak", id="no-special"),
]


@pytest.mark.parametrize(("password", "status", "code"), PASSWORD_CASES)
async def test_ac3_signup_password_policy_rejects(
    client: httpx.AsyncClient, db: asyncpg.Connection, password: str, status: int, code: str
) -> None:
    """AC3: <8 bytes → too_short; >72 bytes (UTF-8) → too_long; missing a class → too_weak. No user is created."""
    email = new_email("policy")
    response = await client.post("/auth/signup", json={"email": email, "password": password})
    assert_error(response, status, code)
    assert await db.fetchval("SELECT count(*) FROM users WHERE email = $1", email) == 0


@pytest.mark.parametrize(
    "password",
    [
        pytest.param("Ab1!xyzw", id="8-bytes"),
        pytest.param("Ab1!" + "x" * 68, id="72-bytes-ascii"),
        pytest.param("Ab1!" + "€" * 22 + "xx", id="72-bytes-multibyte"),
    ],
)
async def test_ac3_signup_password_policy_accepts_boundaries(client: httpx.AsyncClient, password: str) -> None:
    """AC3: exactly 8 and exactly 72 bytes (incl. multi-byte) are accepted."""
    response = await client.post("/auth/signup", json={"email": new_email("edge"), "password": password})
    assert response.status_code == 201, response.text


async def test_ac3_72_byte_password_is_not_truncated(client: httpx.AsyncClient) -> None:
    """AC3: a 72-byte password is used in full: changing its last byte must fail login."""
    email = new_email("trunc")
    password = "Ab1!" + "x" * 68
    code = await signup(client, email, password)
    assert (await client.post("/auth/verify", json={"email": email, "code": code})).status_code == 200
    assert (await login(client, email, password)).status_code == 200
    assert_error(await login(client, email, password[:-1] + "y"), 401, "invalid_credentials")


async def test_ac3_too_weak_detail_names_the_missing_rule(client: httpx.AsyncClient) -> None:
    """AC3 / §8: password_too_weak lists the missing rule(s) in detail (wording not pinned, just non-empty)."""
    body = assert_error(
        await client.post("/auth/signup", json={"email": new_email("weak"), "password": "abcdefgh"}),
        422,
        "password_too_weak",
    )
    assert len(body["detail"]) > 0


@pytest.mark.parametrize("email", ["not-an-email", "a@", "@example.com", "", "a b@example.com"])
async def test_ac26_signup_invalid_email(client: httpx.AsyncClient, email: str) -> None:
    """§8 / AC26: 422 invalid_email in the {"error","detail"} shape (not FastAPI's default validation body)."""
    assert_error(
        await client.post("/auth/signup", json={"email": email, "password": STRONG_PASSWORD}), 422, "invalid_email"
    )


# ── AC4 ──────────────────────────────────────────────────────────────────────


async def test_ac4_signup_with_verified_email_returns_409(client: httpx.AsyncClient) -> None:
    """AC4: signup with a verified email → 409 email_taken."""
    email = new_email("taken")
    code = await signup(client, email)
    assert (await client.post("/auth/verify", json={"email": email, "code": code})).status_code == 200
    assert_error(
        await client.post("/auth/signup", json={"email": email, "password": OTHER_PASSWORD}), 409, "email_taken"
    )


async def test_ac4_email_matching_ignores_case(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC4: emails are lowercased + trimmed; a different case of a verified email is still taken."""
    local = new_email("Case")
    mixed = "  " + local.replace("rv1-", "RV1-").replace("example.com", "Example.COM") + " "
    response = await client.post("/auth/signup", json={"email": mixed, "password": STRONG_PASSWORD})
    assert response.status_code == 201, response.text
    assert response.json()["email"] == local.lower()
    assert (await user_row(db, local))["email"] == local.lower()

    code = (await outbox(client, local.lower()))["code"]
    assert (await client.post("/auth/verify", json={"email": local.upper(), "code": code})).status_code == 200
    assert_error(
        await client.post("/auth/signup", json={"email": local.upper(), "password": STRONG_PASSWORD}),
        409,
        "email_taken",
    )
    assert (await login(client, local.upper())).status_code == 200
    assert await db.fetchval("SELECT count(*) FROM users WHERE lower(email) = $1", local.lower()) == 1


async def test_ac4_resignup_unverified_within_60s_updates_password_keeps_code(
    client: httpx.AsyncClient, db: asyncpg.Connection
) -> None:
    """AC4: unverified re-signup → 201, password updated; within 60 s no new code (the current one stays valid)."""
    email = new_email("resign")
    code = await signup(client, email, STRONG_PASSWORD)
    sent_before = await outbox(client, email)
    user_before = await user_row(db, email)

    response = await client.post("/auth/signup", json={"email": email, "password": OTHER_PASSWORD})
    assert response.status_code == 201, response.text
    assert response.json() == {"status": "verification_sent", "email": email}
    assert await outbox(client, email) == sent_before, "no new code within 60 s"

    user_after = await user_row(db, email)
    assert user_after["password_hash"] != user_before["password_hash"]
    assert user_after["updated_by"] == user_after["id"], "AC25: re-signup sets users.updated_by = the user's id"
    assert user_after["created_by"] is None
    # New password is the one that counts now (unverified → 403, not 401); the old one is rejected.
    assert_error(await login(client, email, OTHER_PASSWORD), 403, "email_not_verified", email=email)
    assert_error(await login(client, email, STRONG_PASSWORD), 401, "invalid_credentials")
    # The original code still verifies.
    assert (await client.post("/auth/verify", json={"email": email, "code": code})).status_code == 200


async def test_ac4_resignup_unverified_after_60s_sends_new_code(
    client: httpx.AsyncClient, db: asyncpg.Connection
) -> None:
    """AC4: unverified re-signup ≥60 s after the last send → a new code; the old one no longer works."""
    email = new_email("resign60")
    old_code = await signup(client, email)
    old_sent = await outbox(client, email)
    await allow_resend(db, email)

    assert (await client.post("/auth/signup", json={"email": email, "password": OTHER_PASSWORD})).status_code == 201
    new_sent = await outbox(client, email)
    assert new_sent["sent_at"] != old_sent["sent_at"], "a new verification email must be sent"
    if new_sent["code"] != old_code:
        assert_error(
            await client.post("/auth/verify", json={"email": email, "code": old_code}),
            400,
            "code_invalid",
            attempts_remaining=2,
        )
    assert (await client.post("/auth/verify", json={"email": email, "code": new_sent["code"]})).status_code == 200
