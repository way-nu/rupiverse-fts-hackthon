"""Parallel requests against a real server + Postgres: the single-use and lockout rules hold under concurrency
(review findings on PR #6: AC6 lock bypass, AC11 refresh reuse, AC16 reset reuse)."""

import asyncio
from collections import Counter

import httpx

from tests.acceptance.conftest import login, new_email, other_code, outbox, signup, verified_user

PARALLEL = 10


async def _codes(responses: list[httpx.Response]) -> Counter[str]:
    return Counter(r.json().get("error", "ok") if r.status_code >= 400 else "ok" for r in responses)


async def test_parallel_wrong_codes_lock_after_three(client: httpx.AsyncClient) -> None:
    email = new_email("race-lock")
    code = await signup(client, email)
    wrong = other_code(code)
    responses = await asyncio.gather(
        *[client.post("/auth/verify", json={"email": email, "code": wrong}) for _ in range(PARALLEL)]
    )
    seen = await _codes(responses)
    assert seen["code_invalid"] <= 2, seen
    assert seen["code_locked"] == PARALLEL - seen["code_invalid"], seen
    locked = await client.post("/auth/verify", json={"email": email, "code": code})
    assert locked.json()["error"] == "code_locked", locked.text


async def test_parallel_correct_code_is_consumed_once(client: httpx.AsyncClient) -> None:
    email = new_email("race-consume")
    code = await signup(client, email)
    responses = await asyncio.gather(
        *[client.post("/auth/verify", json={"email": email, "code": code}) for _ in range(5)]
    )
    assert sum(r.status_code == 200 for r in responses) == 1, [r.text for r in responses]


async def test_parallel_refresh_rotates_once(client: httpx.AsyncClient) -> None:
    _, pair = await verified_user(client)
    responses = await asyncio.gather(
        *[client.post("/auth/refresh", json={"refresh_token": pair["refresh_token"]}) for _ in range(5)]
    )
    seen = await _codes(responses)
    assert seen == Counter({"ok": 1, "invalid_refresh_token": 4}), seen


async def test_parallel_reset_token_works_once(client: httpx.AsyncClient) -> None:
    email, _ = await verified_user(client)
    assert (await client.post("/auth/password/forgot", json={"email": email})).status_code == 202
    code = (await outbox(client, email, "reset_password"))["code"]
    token = (await client.post("/auth/password/verify-code", json={"email": email, "code": code})).json()["reset_token"]
    responses = await asyncio.gather(
        *[
            client.post("/auth/password/reset", json={"reset_token": token, "new_password": f"Verse#2027y{i}"})
            for i in range(5)
        ]
    )
    statuses = Counter(r.status_code for r in responses)
    assert statuses == Counter({204: 1, 400: 4}), statuses
    winner = next(i for i, r in enumerate(responses) if r.status_code == 204)
    assert (await login(client, email, f"Verse#2027y{winner}")).status_code == 200
