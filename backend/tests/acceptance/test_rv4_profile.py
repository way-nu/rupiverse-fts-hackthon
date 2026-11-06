"""RV4 acceptance · GET / PUT /profile happy paths, clearing and isolation: AC2, AC3, AC4, AC7."""

import asyncpg
import httpx
import pytest

from tests.acceptance.rv4 import (
    EMPTY,
    VALID,
    assert_invalid_request,
    assert_profile,
    body,
    parse_ts,
    profile_rows,
    profile_user,
)

# ── AC2 ──────────────────────────────────────────────────────────────────────


async def test_ac2_get_without_a_saved_profile(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC2: never saved → 200, the account email, all four fields null, updated_at null (never 404)."""
    user = await profile_user(client)
    out = assert_profile(await user.get(), user.email, EMPTY)
    assert out["updated_at"] is None
    assert await profile_rows(db, user.id) == [], "GET must not create a row"


async def test_ac2_email_is_the_lowercased_account_email(client: httpx.AsyncClient) -> None:
    """AC2 / §8: email is the account email, lowercased."""
    user = await profile_user(client)
    out = (await user.get()).json()
    assert out["email"] == user.email.lower() == user.pair["user"]["email"]


# ── AC3 ──────────────────────────────────────────────────────────────────────


async def test_ac3_put_returns_the_values_and_get_matches(client: httpx.AsyncClient) -> None:
    """AC3: PUT valid values → 200 (not 201) with them; a following GET returns the same."""
    user = await profile_user(client)
    put = await user.put(VALID)
    assert put.status_code == 200, f"first save is 200, not {put.status_code}"
    saved = assert_profile(put, user.email, VALID)
    parse_ts(saved["updated_at"])
    assert (await user.get()).json() == saved


async def test_ac3_second_save_updates_the_same_row(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC3: saving again updates the same row (one row per user) and updated_at moves forward."""
    user = await profile_user(client)
    first = assert_profile(await user.put(VALID), user.email, VALID)
    rows = await profile_rows(db, user.id)
    assert len(rows) == 1
    row_id = rows[0]["id"]

    changed = body(full_name="Venu G", age=30, gender="other", phone="9123456789")
    second = assert_profile(await user.put(changed), user.email, changed)
    rows = await profile_rows(db, user.id)
    assert len(rows) == 1 and rows[0]["id"] == row_id, "second save must update the same row"
    assert parse_ts(second["updated_at"]) > parse_ts(first["updated_at"]), "updated_at must move"


async def test_ac3_audit_columns_are_the_signed_in_user(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC3: created_by and updated_by are the user's id after the first and later saves; created_* stays fixed."""
    user = await profile_user(client)
    await user.put(VALID)
    first = (await profile_rows(db, user.id))[0]
    assert str(first["created_by"]) == user.id and str(first["updated_by"]) == user.id, dict(first)
    assert first["deleted_at"] is None and first["deleted_by"] is None

    await user.put(body(age=31))
    second = (await profile_rows(db, user.id))[0]
    assert str(second["created_by"]) == user.id and str(second["updated_by"]) == user.id
    assert second["created_at"] == first["created_at"], "created_at must not change on update"
    assert second["updated_at"] > first["updated_at"]


async def test_ac3_stored_values_match_the_response(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC3 / §7: the row holds what the API returned; phone stored as 10 digits without +91."""
    user = await profile_user(client)
    await user.put(VALID)
    row = (await profile_rows(db, user.id))[0]
    assert (row["full_name"], row["age"], row["gender"], row["phone"]) == ("Venu Gopal", 29, "male", "9876543210")


@pytest.mark.parametrize(
    ("sent", "stored"),
    [
        pytest.param("  Venu Gopal  ", "Venu Gopal", id="trimmed"),
        pytest.param("Abc", "Abc", id="3-chars"),
        pytest.param("x" * 80, "x" * 80, id="80-chars"),
        pytest.param("R2-D2 & Co.", "R2-D2 & Co.", id="digits-symbols"),
        pytest.param("वेणु गोपाल", "वेणु गोपाल", id="devanagari"),
        pytest.param("é" * 80, "é" * 80, id="80-code-points-multibyte"),
    ],
)
async def test_ac3_valid_names(client: httpx.AsyncClient, sent: str, stored: str) -> None:
    """AC3 / §8: names of 3–80 code points after trim, any characters, stored trimmed."""
    user = await profile_user(client)
    assert_profile(await user.put(body(full_name=sent)), user.email, body(full_name=stored))


@pytest.mark.parametrize(
    "values",
    [
        pytest.param({"age": 18}, id="age-18"),
        pytest.param({"age": 120}, id="age-120"),
        pytest.param({"gender": "female"}, id="female"),
        pytest.param({"gender": "other"}, id="other"),
        pytest.param({"phone": "0000000000"}, id="phone-leading-0"),
        pytest.param({"phone": "1234567890"}, id="phone-leading-1"),
    ],
)
async def test_ac3_valid_edge_values(client: httpx.AsyncClient, values: dict) -> None:
    """AC3 / §8: edge values that must be accepted."""
    user = await profile_user(client)
    assert_profile(await user.put(body(**values)), user.email, body(**values))


# ── AC4 ──────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("key", ["full_name", "age", "gender", "phone"])
@pytest.mark.parametrize("clear", [None, ""], ids=["null", "empty-string"])
async def test_ac4_null_or_empty_string_clears_a_field(client: httpx.AsyncClient, key: str, clear: object) -> None:
    """AC4: null or "" clears one field (returned as null); the others are kept."""
    user = await profile_user(client)
    assert_profile(await user.put(VALID), user.email, VALID)
    expected = {**VALID, key: None}
    assert_profile(await user.put(body(**{key: clear})), user.email, expected)
    assert_profile(await user.get(), user.email, expected)


@pytest.mark.parametrize("blank", ["   ", "\t \n"], ids=["spaces", "mixed-whitespace"])
async def test_ac4_whitespace_only_name_clears_it(client: httpx.AsyncClient, blank: str) -> None:
    """AC4 / §8: a whitespace-only name becomes null (not invalid)."""
    user = await profile_user(client)
    await user.put(VALID)
    assert_profile(await user.put(body(full_name=blank)), user.email, {**VALID, "full_name": None})


async def test_ac4_all_null_save_succeeds_and_creates_the_row(
    client: httpx.AsyncClient, db: asyncpg.Connection
) -> None:
    """AC4 / §8: all four null on a first save → 200, a row exists and updated_at is non-null."""
    user = await profile_user(client)
    out = assert_profile(await user.put(EMPTY), user.email, EMPTY)
    parse_ts(out["updated_at"])
    rows = await profile_rows(db, user.id)
    assert len(rows) == 1
    assert (rows[0]["full_name"], rows[0]["age"], rows[0]["gender"], rows[0]["phone"]) == (None, None, None, None)


async def test_ac4_all_empty_strings_clear_everything(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC4: all four "" after a full save clears everything; stored as NULL, not ""."""
    user = await profile_user(client)
    await user.put(VALID)
    assert_profile(await user.put({"full_name": "", "age": "", "gender": "", "phone": ""}), user.email, EMPTY)
    row = (await profile_rows(db, user.id))[0]
    assert (row["full_name"], row["age"], row["gender"], row["phone"]) == (None, None, None, None)


# ── AC7 ──────────────────────────────────────────────────────────────────────


async def test_ac7_two_users_never_mix(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC7: two users save different profiles; each reads back only their own, each row has its own user_id."""
    alice, bob = await profile_user(client), await profile_user(client)
    a = body(full_name="Alice Rao", age=41, gender="female", phone="9000000001")
    b = body(full_name="Bob Iyer", age=52, gender="male", phone="9000000002")
    assert_profile(await alice.put(a), alice.email, a)
    assert_profile(await bob.put(b), bob.email, b)
    assert_profile(await alice.get(), alice.email, a)
    assert_profile(await bob.get(), bob.email, b)
    assert len(await profile_rows(db, alice.id)) == 1 and len(await profile_rows(db, bob.id)) == 1


async def test_ac7_a_new_user_does_not_see_another_users_profile(client: httpx.AsyncClient) -> None:
    """AC7: after someone else saved, a fresh user still gets the empty profile."""
    alice = await profile_user(client)
    await alice.put(VALID)
    bob = await profile_user(client)
    assert_profile(await bob.get(), bob.email, EMPTY)


@pytest.mark.parametrize("key", ["user_id", "id", "email"])
async def test_ac7_body_cannot_name_another_user(client: httpx.AsyncClient, key: str) -> None:
    """AC7 / §8: unknown keys such as user_id or email → 422 invalid_request; the other user is untouched."""
    alice, bob = await profile_user(client), await profile_user(client)
    target = bob.id if key != "email" else bob.email
    assert_invalid_request(await alice.put({**VALID, key: target}), [key])
    assert_profile(await bob.get(), bob.email, EMPTY)
    assert_profile(await alice.get(), alice.email, EMPTY)


async def test_ac7_query_params_cannot_switch_user(client: httpx.AsyncClient) -> None:
    """AC7: ?user_id=<other> is ignored on both endpoints; reads and writes stay on the token's user."""
    alice, bob = await profile_user(client), await profile_user(client)
    await bob.put(body(full_name="Bob Iyer"))
    response = await client.get(
        "/profile", params={"user_id": bob.id}, headers={"Authorization": f"Bearer {alice.token}"}
    )
    assert_profile(response, alice.email, EMPTY)
    response = await client.put(
        "/profile", params={"user_id": bob.id}, json=VALID, headers={"Authorization": f"Bearer {alice.token}"}
    )
    assert_profile(response, alice.email, VALID)
    assert_profile(await bob.get(), bob.email, body(full_name="Bob Iyer"))


async def test_ac7_no_per_user_profile_route(client: httpx.AsyncClient) -> None:
    """AC7: there is no /profile/{id} route to read or write someone else's profile."""
    alice, bob = await profile_user(client), await profile_user(client)
    await bob.put(VALID)
    headers = {"Authorization": f"Bearer {alice.token}"}
    for method in ("GET", "PUT"):
        response = await client.request(method, f"/profile/{bob.id}", json=VALID, headers=headers)
        assert response.status_code in (404, 405), f"{method} /profile/<id> → {response.status_code}"
        assert "Venu" not in response.text
    assert_profile(await bob.get(), bob.email, VALID)
