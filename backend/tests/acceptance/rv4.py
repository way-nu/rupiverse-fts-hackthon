"""RV4 acceptance helpers (Tester-owned). Black-box, against the final §8 contract (builder, 2026-11-06).

Reuses the RV1 harness in conftest.py: a throwaway migrated DB, a real uvicorn on port 8002, verified users via the
test outbox. Nothing here imports application code.
"""

from datetime import datetime
from typing import Any

import asyncpg
import httpx

from tests.acceptance.conftest import assert_error, verified_user

PROFILE_KEYS = ("full_name", "age", "gender", "phone")
PROFILE_OUT_KEYS = {"email", "full_name", "age", "gender", "phone", "updated_at"}
EMPTY = {"full_name": None, "age": None, "gender": None, "phone": None}
VALID = {"full_name": "Venu Gopal", "age": 29, "gender": "male", "phone": "9876543210"}


def bearer(token: str | None) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"} if token is not None else {}


class ProfileUser:
    """A verified user plus GET / PUT /profile with their token."""

    def __init__(self, client: httpx.AsyncClient, email: str, pair: dict[str, Any]) -> None:
        self.client = client
        self.email = email
        self.pair = pair
        self.id = pair["user"]["id"]
        self.token = pair["access_token"]

    async def get(self) -> httpx.Response:
        return await self.client.get("/profile", headers=bearer(self.token))

    async def put(self, body: Any) -> httpx.Response:
        return await self.client.put("/profile", json=body, headers=bearer(self.token))

    async def put_raw(self, content: bytes) -> httpx.Response:
        headers = {**bearer(self.token), "Content-Type": "application/json"}
        return await self.client.put("/profile", content=content, headers=headers)


async def profile_user(client: httpx.AsyncClient) -> ProfileUser:
    email, pair = await verified_user(client)
    return ProfileUser(client, email, pair)


def body(**overrides: Any) -> dict[str, Any]:
    """A full, valid ProfileUpdate with some keys replaced."""
    return {**VALID, **overrides}


def parse_ts(value: str) -> datetime:
    assert isinstance(value, str) and value.endswith("Z"), f"updated_at must be ISO-8601 UTC ending in Z: {value!r}"
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def assert_profile(response: httpx.Response, email: str, expected: dict[str, Any]) -> dict[str, Any]:
    """200 ProfileOut with exactly the §8 keys, the account email and the expected four values."""
    assert response.status_code == 200, f"expected 200 ProfileOut, got {response.status_code}: {response.text}"
    out = response.json()
    assert set(out) == PROFILE_OUT_KEYS, f"ProfileOut keys: {sorted(out)}"
    assert out["email"] == email.strip().lower(), out
    assert {k: out[k] for k in PROFILE_KEYS} == expected, out
    return out


def assert_invalid_profile(response: httpx.Response, fields: list[str]) -> dict[str, Any]:
    err = assert_error(response, 422, "invalid_profile", fields=fields)
    assert err["detail"] == "Some profile fields are not valid.", err
    return err


def assert_invalid_request(response: httpx.Response, fields: list[str] | None = None) -> dict[str, Any]:
    err = assert_error(response, 422, "invalid_request", fields=...)
    assert isinstance(err["fields"], list) and all(isinstance(f, str) for f in err["fields"]), err
    assert err["fields"] == sorted(err["fields"]), f"invalid_request fields must be sorted: {err['fields']}"
    if fields is not None:
        assert err["fields"] == fields, err
    return err


async def profile_rows(db: asyncpg.Connection, user_id: str) -> list[asyncpg.Record]:
    return await db.fetch("SELECT * FROM public.user_profiles WHERE user_id = $1::uuid", user_id)
