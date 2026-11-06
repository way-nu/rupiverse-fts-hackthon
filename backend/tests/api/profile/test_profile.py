"""GET / PUT /profile against a real server + Postgres: every success path and every §8 error code, two-user
isolation, audit columns, concurrency and the CORS preflight for PUT."""

import asyncio
import time
import uuid
from typing import Any

import asyncpg
import httpx
import pytest

from tests.acceptance.conftest import assert_error, forge_jwt, jwt_payload, verified_user

VALID: dict[str, Any] = {"full_name": "Venu Gopal", "age": 29, "gender": "male", "phone": "9876543210"}
EMPTY: dict[str, Any] = {"full_name": None, "age": None, "gender": None, "phone": None}
OUT_KEYS = {"email", "full_name", "age", "gender", "phone", "updated_at"}


class User:
    def __init__(self, client: httpx.AsyncClient, email: str, pair: dict[str, Any]) -> None:
        self.client, self.email, self.pair = client, email, pair
        self.id: str = pair["user"]["id"]
        self.headers = {"Authorization": f"Bearer {pair['access_token']}"}

    async def get(self) -> httpx.Response:
        return await self.client.get("/profile", headers=self.headers)

    async def put(self, body: object) -> httpx.Response:
        return await self.client.put("/profile", json=body, headers=self.headers)


async def new_user(client: httpx.AsyncClient) -> User:
    email, pair = await verified_user(client)
    return User(client, email, pair)


def fields_of(response: httpx.Response, email: str) -> dict[str, Any]:
    assert response.status_code == 200, response.text
    out = response.json()
    assert set(out) == OUT_KEYS and out["email"] == email.lower()
    return {k: out[k] for k in ("full_name", "age", "gender", "phone")}


async def rows(db: asyncpg.Connection, user_id: str) -> list[asyncpg.Record]:
    return await db.fetch("SELECT * FROM public.user_profiles WHERE user_id = $1::uuid", user_id)


# ── GET ──────────────────────────────────────────────────────────────────────


async def test_get_without_row(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    user = await new_user(client)
    response = await user.get()
    assert fields_of(response, user.email) == EMPTY
    assert response.json()["updated_at"] is None
    assert await rows(db, user.id) == []


async def test_get_ignores_a_soft_deleted_row(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    user = await new_user(client)
    await user.put(VALID)
    await db.execute("UPDATE public.user_profiles SET deleted_at = now() WHERE user_id = $1::uuid", user.id)
    assert fields_of(await user.get(), user.email) == EMPTY
    # the next save brings the one row back rather than failing on the unique user_id
    assert fields_of(await user.put(VALID), user.email) == VALID
    row = (await rows(db, user.id))[0]
    assert row["deleted_at"] is None and row["deleted_by"] is None


# ── PUT ──────────────────────────────────────────────────────────────────────


async def test_put_then_get(client: httpx.AsyncClient) -> None:
    user = await new_user(client)
    put = await user.put(VALID)
    assert fields_of(put, user.email) == VALID
    assert put.json()["updated_at"].endswith("Z")
    assert (await user.get()).json() == put.json()


async def test_second_put_updates_one_row_and_audit_columns(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    user = await new_user(client)
    await user.put(VALID)
    first = (await rows(db, user.id))[0]
    assert str(first["created_by"]) == user.id == str(first["updated_by"])
    await user.put({**VALID, "age": 40})
    after = await rows(db, user.id)
    assert len(after) == 1 and after[0]["id"] == first["id"] and after[0]["age"] == 40
    assert after[0]["created_at"] == first["created_at"] and after[0]["updated_at"] > first["updated_at"]
    assert str(after[0]["created_by"]) == user.id == str(after[0]["updated_by"])


async def test_clear_fields_with_null_and_empty_string(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    user = await new_user(client)
    await user.put(VALID)
    response = await user.put({"full_name": "  ", "age": "", "gender": None, "phone": ""})
    assert fields_of(response, user.email) == EMPTY
    row = (await rows(db, user.id))[0]
    assert (row["full_name"], row["age"], row["gender"], row["phone"]) == (None, None, None, None)


async def test_name_is_stored_trimmed(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    user = await new_user(client)
    assert fields_of(await user.put({**VALID, "full_name": "  Venu  "}), user.email)["full_name"] == "Venu"
    assert (await rows(db, user.id))[0]["full_name"] == "Venu"


async def test_parallel_first_saves_make_one_row(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    user = await new_user(client)
    responses = await asyncio.gather(*[user.put({**VALID, "age": 20 + i}) for i in range(8)])
    assert all(r.status_code == 200 for r in responses), [r.text for r in responses]
    assert len(await rows(db, user.id)) == 1


# ── invalid_profile ──────────────────────────────────────────────────────────


async def test_invalid_profile_lists_fields_saves_nothing(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    user = await new_user(client)
    response = await user.put({"full_name": "Zq", "age": 4321, "gender": "Zzgender", "phone": "55511"})
    body = assert_error(response, 422, "invalid_profile", fields=["full_name", "age", "gender", "phone"])
    assert body["detail"] == "Some profile fields are not valid."
    for value in ("Zq", "4321", "Zzgender", "55511"):
        assert value not in response.text
    assert await rows(db, user.id) == []


# ── invalid_request ──────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("payload", "fields"),
    [
        pytest.param({}, ["age", "full_name", "gender", "phone"], id="empty-object"),
        pytest.param({**VALID, "age": "29"}, ["age"], id="age-string"),
        pytest.param({**VALID, "age": 29.0}, ["age"], id="age-float"),
        pytest.param({**VALID, "age": True}, ["age"], id="age-bool"),
        pytest.param({**VALID, "phone": 9876543210}, ["phone"], id="phone-int"),
        pytest.param({**VALID, "user_id": str(uuid.uuid4())}, ["user_id"], id="unknown-key"),
        pytest.param({"full_name": "ab", "age": 5, "gender": "male"}, ["phone"], id="beats-invalid-profile"),
    ],
)
async def test_invalid_request(client: httpx.AsyncClient, payload: object, fields: list[str]) -> None:
    user = await new_user(client)
    assert_error(await user.put(payload), 422, "invalid_request", fields=fields)


@pytest.mark.parametrize("raw", [b"not json", b"[]", b"null", b'"x"', b""])
async def test_non_object_body_is_invalid_request_with_no_fields(client: httpx.AsyncClient, raw: bytes) -> None:
    user = await new_user(client)
    headers = {**user.headers, "Content-Type": "application/json"}
    response = await client.put("/profile", content=raw, headers=headers)
    assert_error(response, 422, "invalid_request", fields=[])


# ── 401s ─────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("method", ["GET", "PUT"])
async def test_auth_errors(client: httpx.AsyncClient, db: asyncpg.Connection, method: str) -> None:
    user = await new_user(client)
    token = user.pair["access_token"]
    now = int(time.time())

    async def call(headers: dict[str, str]) -> httpx.Response:
        return await client.request(method, "/profile", json=VALID if method == "PUT" else None, headers=headers)

    assert_error(await call({}), 401, "not_authenticated")
    expired = forge_jwt({**jwt_payload(token), "iat": now - 1000, "exp": now - 100})
    assert_error(await call({"Authorization": f"Bearer {expired}"}), 401, "token_expired")
    assert_error(await call({"Authorization": "Bearer not.a.jwt"}), 401, "invalid_token")
    await db.execute("DELETE FROM public.users WHERE id = $1::uuid", user.id)
    assert_error(await call(user.headers), 401, "invalid_token")


async def test_bad_token_beats_bad_body(client: httpx.AsyncClient) -> None:
    headers = {"Authorization": "Bearer not.a.jwt", "Content-Type": "application/json"}
    assert_error(await client.put("/profile", content=b"{", headers=headers), 401, "invalid_token")
    assert_error(await client.put("/profile", json={"age": "x"}), 401, "not_authenticated")


async def test_deleting_the_user_deletes_the_profile(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    user = await new_user(client)
    await user.put(VALID)
    await db.execute("DELETE FROM public.users WHERE id = $1::uuid", user.id)
    assert await rows(db, user.id) == []


# ── isolation ────────────────────────────────────────────────────────────────


async def test_two_users_never_mix(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    alice, bob = await new_user(client), await new_user(client)
    a = {**VALID, "full_name": "Alice Rao", "gender": "female"}
    b = {**VALID, "full_name": "Bob Iyer", "phone": "9000000002"}
    await alice.put(a)
    await bob.put(b)
    assert fields_of(await alice.get(), alice.email) == a
    assert fields_of(await bob.get(), bob.email) == b
    response = await client.put("/profile", params={"user_id": bob.id}, json=VALID, headers=alice.headers)
    assert fields_of(response, alice.email) == VALID
    assert fields_of(await bob.get(), bob.email) == b
    assert (await rows(db, alice.id))[0]["user_id"] != (await rows(db, bob.id))[0]["user_id"]


# ── CORS ─────────────────────────────────────────────────────────────────────


async def test_cors_preflight_allows_put(client: httpx.AsyncClient) -> None:
    response = await client.options(
        "/profile",
        headers={
            "Origin": "http://localhost:8082",
            "Access-Control-Request-Method": "PUT",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200, response.text
    assert "PUT" in response.headers["access-control-allow-methods"]
