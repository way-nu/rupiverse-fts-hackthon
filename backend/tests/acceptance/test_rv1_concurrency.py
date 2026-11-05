"""RV1 acceptance · single-use rules hold under parallel requests: AC5, AC6, AC11, AC16 (regression for the review
round 1 race findings at f72c3cc). Each check runs several trials of N simultaneous requests against the live server."""

import asyncio

import asyncpg
import httpx
import pytest

from tests.acceptance.conftest import (
    OTHER_PASSWORD,
    allow_resend,
    new_email,
    other_code,
    outbox,
    signup,
    user_row,
    verified_user,
)

PARALLEL = 10
TRIALS = 3


async def burst(client: httpx.AsyncClient, path: str, payloads: list[dict]) -> list[httpx.Response]:
    return list(await asyncio.gather(*(client.post(path, json=p) for p in payloads)))


def codes_of(responses: list[httpx.Response]) -> list[str]:
    return [r.json().get("error", "ok") if r.content else "ok" for r in responses]


@pytest.mark.parametrize("trial", range(TRIALS))
async def test_ac6_parallel_wrong_codes_lock_after_three(
    client: httpx.AsyncClient, db: asyncpg.Connection, trial: int
) -> None:
    """AC6: 10 simultaneous wrong verify codes → at most 2 `code_invalid`; the correct code is then locked out."""
    email = new_email(f"race-lock-{trial}")
    code = await signup(client, email)
    responses = await burst(client, "/auth/verify", [{"email": email, "code": other_code(code)}] * PARALLEL)
    errors = codes_of(responses)
    assert all(r.status_code == 400 for r in responses), errors
    assert errors.count("code_invalid") <= 2, f"more than 2 wrong codes were checked before the lock: {errors}"
    assert (await client.post("/auth/verify", json={"email": email, "code": code})).json()["error"] == "code_locked"
    row = await db.fetchrow(
        "SELECT c.failed_attempts FROM email_codes c JOIN users u ON u.id = c.user_id "
        "WHERE u.email = $1 AND c.purpose = 'verify_email'",
        email,
    )
    assert row["failed_attempts"] == 3
    assert (await user_row(db, email))["is_verified"] is False


@pytest.mark.parametrize("trial", range(TRIALS))
async def test_ac6_parallel_wrong_reset_codes_lock_after_three(client: httpx.AsyncClient, trial: int) -> None:
    """AC6 (reset): 10 simultaneous wrong reset codes → at most 2 `code_invalid`; the correct code is then locked."""
    email, _ = await verified_user(client)
    assert (await client.post("/auth/password/forgot", json={"email": email})).status_code == 202
    code = (await outbox(client, email, "reset_password"))["code"]
    responses = await burst(
        client, "/auth/password/verify-code", [{"email": email, "code": other_code(code)}] * PARALLEL
    )
    errors = codes_of(responses)
    assert errors.count("code_invalid") <= 2, f"more than 2 wrong reset codes were checked: {errors}"
    locked = await client.post("/auth/password/verify-code", json={"email": email, "code": code})
    assert locked.json()["error"] == "code_locked", locked.text


@pytest.mark.parametrize("trial", range(TRIALS))
async def test_ac5_parallel_correct_code_is_used_once(client: httpx.AsyncClient, trial: int) -> None:
    """AC5: the same correct verification code sent 10 times at once yields exactly one TokenPair."""
    email = new_email(f"race-once-{trial}")
    code = await signup(client, email)
    responses = await burst(client, "/auth/verify", [{"email": email, "code": code}] * PARALLEL)
    assert [r.status_code for r in responses].count(200) == 1, codes_of(responses)


@pytest.mark.parametrize("trial", range(TRIALS))
async def test_ac16_parallel_reset_code_mints_one_token(client: httpx.AsyncClient, trial: int) -> None:
    """AC16: a correct reset code sent 10 times at once mints exactly one reset token."""
    email, _ = await verified_user(client)
    assert (await client.post("/auth/password/forgot", json={"email": email})).status_code == 202
    code = (await outbox(client, email, "reset_password"))["code"]
    responses = await burst(client, "/auth/password/verify-code", [{"email": email, "code": code}] * PARALLEL)
    assert [r.status_code for r in responses].count(200) == 1, codes_of(responses)


@pytest.mark.parametrize("trial", range(TRIALS))
async def test_ac11_parallel_refresh_rotates_once(
    client: httpx.AsyncClient, db: asyncpg.Connection, trial: int
) -> None:
    """AC11: one refresh token used 10 times at once → exactly one new pair; the rest are 401 invalid_refresh_token,
    and the user gains exactly one live refresh token."""
    email, pair = await verified_user(client)
    user = await user_row(db, email)
    responses = await burst(client, "/auth/refresh", [{"refresh_token": pair["refresh_token"]}] * PARALLEL)
    statuses = [r.status_code for r in responses]
    assert statuses.count(200) == 1, codes_of(responses)
    assert all(r.json()["error"] == "invalid_refresh_token" for r in responses if r.status_code != 200)
    live = await db.fetchval(
        "SELECT count(*) FROM refresh_tokens WHERE user_id = $1 AND revoked_at IS NULL", user["id"]
    )
    assert live == 1, f"expected exactly one live session after the burst, found {live}"


@pytest.mark.parametrize("trial", range(TRIALS))
async def test_ac16_parallel_reset_token_works_once(client: httpx.AsyncClient, trial: int) -> None:
    """AC16: one reset token used 10 times at once (different passwords) → exactly one 204."""
    email, _ = await verified_user(client)
    assert (await client.post("/auth/password/forgot", json={"email": email})).status_code == 202
    code = (await outbox(client, email, "reset_password"))["code"]
    token = (await client.post("/auth/password/verify-code", json={"email": email, "code": code})).json()["reset_token"]
    payloads = [{"reset_token": token, "new_password": f"{OTHER_PASSWORD}{i}"} for i in range(PARALLEL)]
    responses = await burst(client, "/auth/password/reset", payloads)
    assert [r.status_code for r in responses].count(204) == 1, codes_of(responses)


@pytest.mark.parametrize("trial", range(TRIALS))
async def test_ac8_parallel_resend_sends_once(client: httpx.AsyncClient, db: asyncpg.Connection, trial: int) -> None:
    """AC8: 10 simultaneous resends after the 60 s window → exactly one 202, the rest 429 resend_too_soon."""
    email = new_email(f"race-resend-{trial}")
    await signup(client, email)
    await allow_resend(db, email)
    responses = await burst(client, "/auth/resend", [{"email": email}] * PARALLEL)
    statuses = [r.status_code for r in responses]
    assert statuses.count(202) == 1, codes_of(responses)
    assert statuses.count(429) == PARALLEL - 1, codes_of(responses)
