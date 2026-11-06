"""RV4 acceptance · server validation, malformed bodies and auth: AC5, AC6."""

import time
import uuid

import asyncpg
import httpx
import pytest

from tests.acceptance.conftest import assert_error, forge_jwt, jwt_payload
from tests.acceptance.rv4 import (
    VALID,
    assert_invalid_profile,
    assert_invalid_request,
    assert_profile,
    bearer,
    body,
    profile_rows,
    profile_user,
)

# ── AC5: well-typed values that break a rule → invalid_profile ───────────────

BAD_VALUES = [
    pytest.param("full_name", "ab", id="name-2-chars"),
    pytest.param("full_name", "  ab  ", id="name-2-chars-after-trim"),
    pytest.param("full_name", "x" * 81, id="name-81-chars"),
    pytest.param("full_name", "é" * 81, id="name-81-code-points"),
    pytest.param("age", 17, id="age-17"),
    pytest.param("age", 0, id="age-0"),
    pytest.param("age", -5, id="age-negative"),
    pytest.param("age", 121, id="age-121"),
    pytest.param("age", 999, id="age-999"),
    pytest.param("gender", "Male", id="gender-wrong-case"),
    pytest.param("gender", "FEMALE", id="gender-upper"),
    pytest.param("gender", "unknown", id="gender-unknown"),
    pytest.param("gender", " male", id="gender-padded"),
    pytest.param("phone", "987654321", id="phone-9-digits"),
    pytest.param("phone", "98765432101", id="phone-11-digits"),
    pytest.param("phone", "+919876543210", id="phone-plus91"),
    pytest.param("phone", "98765 43210", id="phone-space"),
    pytest.param("phone", "98765-43210", id="phone-dash"),
    pytest.param("phone", "98765abcde", id="phone-letters"),
    pytest.param("phone", "９８７６５４３２１０", id="phone-fullwidth-digits"),
    pytest.param("phone", "   ", id="phone-spaces-only"),
]


@pytest.mark.parametrize(("key", "value"), BAD_VALUES)
async def test_ac5_rule_violation_is_invalid_profile(
    client: httpx.AsyncClient, db: asyncpg.Connection, key: str, value: object
) -> None:
    """AC5: one bad field → 422 invalid_profile, fields == [key], nothing saved, value never echoed."""
    user = await profile_user(client)
    response = await user.put(body(**{key: value}))
    assert_invalid_profile(response, [key])
    if isinstance(value, str) and value.strip():
        assert value.strip() not in response.text, "the submitted value must not be echoed"
    assert await profile_rows(db, user.id) == [], "nothing is saved on invalid_profile"


async def test_ac5_every_bad_field_is_listed_in_order(client: httpx.AsyncClient) -> None:
    """AC5 / §8: all four bad → fields in the order full_name, age, gender, phone."""
    user = await profile_user(client)
    response = await user.put({"phone": "123", "gender": "x", "age": 5, "full_name": "ab"})
    assert_invalid_profile(response, ["full_name", "age", "gender", "phone"])


async def test_ac5_some_bad_fields_only_those_listed(client: httpx.AsyncClient) -> None:
    """AC5: valid fields are not listed; the order holds for a subset."""
    user = await profile_user(client)
    assert_invalid_profile(await user.put(body(phone="1", full_name="ab")), ["full_name", "phone"])
    assert_invalid_profile(await user.put(body(gender="M", age=200)), ["age", "gender"])


async def test_ac5_invalid_save_keeps_the_previous_profile(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC5: a rejected save changes nothing — neither the values nor updated_at."""
    user = await profile_user(client)
    saved = assert_profile(await user.put(VALID), user.email, VALID)
    before = (await profile_rows(db, user.id))[0]
    assert_invalid_profile(await user.put(body(full_name="Valid Name", age=12)), ["age"])
    assert (await user.get()).json() == saved
    after = (await profile_rows(db, user.id))[0]
    assert after["updated_at"] == before["updated_at"] and after["full_name"] == "Venu Gopal"


async def test_ac5_detail_never_contains_submitted_values(client: httpx.AsyncClient) -> None:
    """AC5 / §4: the error body names fields only; none of the submitted values appear in it."""
    user = await profile_user(client)
    sent = {"full_name": "Zq", "age": 4321, "gender": "Zzgender", "phone": "55511"}
    response = await user.put(sent)
    assert_invalid_profile(response, ["full_name", "age", "gender", "phone"])
    for value in ("Zq", "4321", "Zzgender", "55511"):
        assert value not in response.text, f"{value!r} echoed in {response.text}"


# ── AC6: malformed bodies → invalid_request ──────────────────────────────────


@pytest.mark.parametrize("missing", ["full_name", "age", "gender", "phone"])
async def test_ac6_missing_key_is_invalid_request(client: httpx.AsyncClient, missing: str) -> None:
    """AC6 / §8: every key is required (full replace); a missing one → invalid_request naming it."""
    user = await profile_user(client)
    payload = {k: v for k, v in VALID.items() if k != missing}
    assert_invalid_request(await user.put(payload), [missing])


async def test_ac6_empty_object_lists_every_key_sorted(client: httpx.AsyncClient) -> None:
    """AC6 / §8: {} → invalid_request, fields sorted alphabetically."""
    user = await profile_user(client)
    assert_invalid_request(await user.put({}), ["age", "full_name", "gender", "phone"])


WRONG_TYPES = [
    pytest.param("age", "29", id="age-string"),
    pytest.param("age", 29.0, id="age-float-whole"),
    pytest.param("age", 29.5, id="age-float"),
    pytest.param("age", True, id="age-bool"),
    pytest.param("age", [29], id="age-list"),
    pytest.param("full_name", 12345, id="name-int"),
    pytest.param("full_name", ["Venu"], id="name-list"),
    pytest.param("full_name", {"first": "Venu"}, id="name-object"),
    pytest.param("full_name", True, id="name-bool"),
    pytest.param("gender", 1, id="gender-int"),
    pytest.param("gender", ["male"], id="gender-list"),
    pytest.param("phone", 9876543210, id="phone-int"),
    pytest.param("phone", ["9876543210"], id="phone-list"),
]


@pytest.mark.parametrize(("key", "value"), WRONG_TYPES)
async def test_ac6_wrong_type_is_invalid_request(
    client: httpx.AsyncClient, db: asyncpg.Connection, key: str, value: object
) -> None:
    """AC6 / §8: strict JSON types → invalid_request naming the key; nothing saved; the value is not echoed."""
    user = await profile_user(client)
    response = await user.put(body(**{key: value}))
    assert_invalid_request(response, [key])
    if key in ("full_name", "phone"):
        assert "Venu" not in response.text and "9876543210" not in response.text
    assert await profile_rows(db, user.id) == []


@pytest.mark.parametrize("extra", ["user_id", "email", "updated_at", "nickname"])
async def test_ac6_unknown_key_is_invalid_request(client: httpx.AsyncClient, extra: str) -> None:
    """AC6 / §8: unknown keys are rejected with invalid_request naming them."""
    user = await profile_user(client)
    assert_invalid_request(await user.put({**VALID, extra: "x"}), [extra])


@pytest.mark.parametrize(
    "raw",
    [
        pytest.param(b"not json", id="not-json"),
        pytest.param(b"[]", id="array"),
        pytest.param(b'"Venu"', id="string"),
        pytest.param(b"null", id="null"),
        pytest.param(b"", id="empty"),
    ],
)
async def test_ac6_non_object_body_is_invalid_request(client: httpx.AsyncClient, raw: bytes) -> None:
    """AC6 / §8: a body that isn't a JSON object → invalid_request (fields may be [])."""
    user = await profile_user(client)
    assert_invalid_request(await user.put_raw(raw))


async def test_ac6_invalid_request_wins_over_invalid_profile(client: httpx.AsyncClient) -> None:
    """AC6 / §8: a missing key plus a rule violation → invalid_request only; invalid_profile is not evaluated."""
    user = await profile_user(client)
    response = await user.put({"full_name": "ab", "age": 5, "gender": "male"})
    err = assert_invalid_request(response, ["phone"])
    assert "full_name" not in err["fields"] and "age" not in err["fields"]


async def test_ac6_several_type_errors_listed_sorted(client: httpx.AsyncClient) -> None:
    """AC6 / §8: invalid_request fields are sorted alphabetically."""
    user = await profile_user(client)
    assert_invalid_request(
        await user.put({"phone": 1, "gender": 2, "full_name": 3, "age": "4"}), ["age", "full_name", "gender", "phone"]
    )


# ── AC6: auth on both endpoints ──────────────────────────────────────────────


async def _tokens(client: httpx.AsyncClient) -> tuple[str, dict]:
    user = await profile_user(client)
    return user.token, user.pair


def _expired(token: str) -> str:
    now = int(time.time())
    return forge_jwt({**jwt_payload(token), "iat": now - 1000, "exp": now - 100})


def _tampered(token: str) -> str:
    header, _, signature = token.split(".")
    other = forge_jwt({**jwt_payload(token), "sub": str(uuid.uuid4())}).split(".")[1]
    return f"{header}.{other}.{signature}"


async def _call(client: httpx.AsyncClient, method: str, token: str | None, raw_header: str | None = None):
    headers = bearer(token) if raw_header is None else {"Authorization": raw_header}
    if method == "GET":
        return await client.get("/profile", headers=headers)
    return await client.put("/profile", json=VALID, headers=headers)


@pytest.mark.parametrize("method", ["GET", "PUT"])
async def test_ac6_no_token_is_not_authenticated(client: httpx.AsyncClient, method: str) -> None:
    """AC6: no Authorization header → 401 not_authenticated."""
    assert_error(await _call(client, method, None), 401, "not_authenticated")


@pytest.mark.parametrize("method", ["GET", "PUT"])
async def test_ac6_expired_token_is_token_expired(client: httpx.AsyncClient, method: str) -> None:
    """AC6: expired access token → 401 token_expired."""
    token, _ = await _tokens(client)
    assert_error(await _call(client, method, _expired(token)), 401, "token_expired")


@pytest.mark.parametrize("method", ["GET", "PUT"])
async def test_ac6_tampered_tokens_are_invalid_token(client: httpx.AsyncClient, method: str) -> None:
    """AC6: tampered payload, wrong signing key, garbage, or a refresh token → 401 invalid_token."""
    token, pair = await _tokens(client)
    for bad in (
        _tampered(token),
        forge_jwt(jwt_payload(token), secret="not-the-secret"),
        "not.a.jwt",
        pair["refresh_token"],
        forge_jwt({**jwt_payload(token), "type": "refresh"}),
    ):
        assert_error(await _call(client, method, bad), 401, "invalid_token")


@pytest.mark.parametrize("method", ["GET", "PUT"])
async def test_ac6_token_of_a_deleted_user_is_invalid_token(
    client: httpx.AsyncClient, db: asyncpg.Connection, method: str
) -> None:
    """AC6 / §8: a validly signed token whose user no longer exists → 401 invalid_token (same as /me)."""
    token, pair = await _tokens(client)
    await db.execute("DELETE FROM public.users WHERE id = $1::uuid", pair["user"]["id"])
    assert_error(await _call(client, method, token), 401, "invalid_token")


async def test_ac6_auth_is_checked_before_the_body(client: httpx.AsyncClient) -> None:
    """AC6 / §8: bad token + bad body → 401, not 422."""
    response = await client.put("/profile", json={"age": "x"}, headers=bearer("not.a.jwt"))
    assert_error(response, 401, "invalid_token")
    response = await client.put("/profile", content=b"not json", headers={"Content-Type": "application/json"})
    assert_error(response, 401, "not_authenticated")
