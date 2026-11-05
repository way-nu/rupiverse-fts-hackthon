"""RV1 acceptance · login, /me, refresh, logout: AC9, AC10, AC11, AC12, AC26."""

import time

import asyncpg
import httpx

from tests.acceptance.conftest import (
    JWT_SECRET,
    STRONG_PASSWORD,
    allow_resend,
    assert_error,
    assert_token_pair,
    forge_jwt,
    jwt_payload,
    login,
    new_email,
    outbox,
    sha256_forms,
    signup,
    user_row,
    verified_user,
)


async def me(client: httpx.AsyncClient, token: str | None) -> httpx.Response:
    headers = {"Authorization": f"Bearer {token}"} if token is not None else {}
    return await client.get("/me", headers=headers)


async def refresh(client: httpx.AsyncClient, token: str) -> httpx.Response:
    return await client.post("/auth/refresh", json={"refresh_token": token})


async def refresh_row(db: asyncpg.Connection, token: str) -> asyncpg.Record:
    row = await db.fetchrow(
        "SELECT * FROM refresh_tokens WHERE token_hash = ANY($1::text[])", list(sha256_forms(token))
    )
    assert row is not None, "refresh token not found by its SHA-256 hash"
    return row


# ── AC9 ──────────────────────────────────────────────────────────────────────


async def test_ac9_login_verified_returns_token_pair(client: httpx.AsyncClient) -> None:
    """AC9: correct credentials on a verified account → 200 TokenPair."""
    email, _ = await verified_user(client)
    body = assert_token_pair(await login(client, email), email)
    assert body["user"]["is_verified"] is True


async def test_ac9_wrong_password_and_unknown_email_look_the_same(client: httpx.AsyncClient) -> None:
    """AC9: wrong password and unknown email → 401 invalid_credentials with an identical body."""
    email, _ = await verified_user(client)
    wrong = await login(client, email, "Wrong@Pass1")
    ghost = await login(client, new_email("ghost"), STRONG_PASSWORD)
    assert_error(wrong, 401, "invalid_credentials")
    assert_error(ghost, 401, "invalid_credentials")
    assert wrong.content == ghost.content, "AC9: identical body for wrong password and unknown email"


async def test_ac9_unverified_login_is_403_with_email(client: httpx.AsyncClient) -> None:
    """AC9: correct password, unverified → 403 email_not_verified, body includes email."""
    email = new_email("unverified")
    await signup(client, email)
    assert_error(await login(client, email), 403, "email_not_verified", email=email)


async def test_ac9_unverified_wrong_password_is_401_not_403(client: httpx.AsyncClient) -> None:
    """AC9: an unverified account with the wrong password must not reveal it exists (401, not 403)."""
    email = new_email("unv-wrong")
    await signup(client, email)
    assert_error(await login(client, email, "Wrong@Pass1"), 401, "invalid_credentials")


async def test_ac9_unverified_login_resends_code_after_60s(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """§8: 403 email_not_verified also sends a new code if ≥60 s since the last send (not before)."""
    email = new_email("unv-resend")
    await signup(client, email)
    first = await outbox(client, email)
    assert_error(await login(client, email), 403, "email_not_verified", email=email)
    assert await outbox(client, email) == first, "no new code within 60 s"

    await allow_resend(db, email)
    assert_error(await login(client, email), 403, "email_not_verified", email=email)
    assert (await outbox(client, email))["sent_at"] != first["sent_at"], "a new code is sent after 60 s"


# ── AC10 ─────────────────────────────────────────────────────────────────────


async def test_ac10_me_with_valid_token(client: httpx.AsyncClient) -> None:
    """AC10: GET /me with a valid access token → 200 {id, email, is_verified, created_at}."""
    email, pair = await verified_user(client)
    response = await me(client, pair["access_token"])
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == {"id", "email", "is_verified", "created_at"}
    assert body["email"] == email and body["is_verified"] is True and body["id"] == pair["user"]["id"]


async def test_ac10_me_without_token(client: httpx.AsyncClient) -> None:
    """AC10: no token → 401 not_authenticated."""
    assert_error(await me(client, None), 401, "not_authenticated")


async def test_ac10_me_with_expired_token(client: httpx.AsyncClient) -> None:
    """AC10: an expired access token → 401 token_expired."""
    _, pair = await verified_user(client)
    now = int(time.time())
    claims = {**jwt_payload(pair["access_token"]), "iat": now - 1000, "exp": now - 100}
    assert_error(await me(client, forge_jwt(claims)), 401, "token_expired")


async def test_ac10_me_with_tampered_token(client: httpx.AsyncClient) -> None:
    """AC10: a tampered token (payload changed, or wrong signing key) → 401 invalid_token."""
    _, pair = await verified_user(client)
    header, payload, signature = pair["access_token"].split(".")
    other_user = {**jwt_payload(pair["access_token"]), "sub": "00000000-0000-0000-0000-000000000000"}
    tampered_payload = forge_jwt(other_user).split(".")[1]
    assert_error(await me(client, f"{header}.{tampered_payload}.{signature}"), 401, "invalid_token")
    assert_error(
        await me(client, forge_jwt(jwt_payload(pair["access_token"]), secret="not-the-secret")), 401, "invalid_token"
    )
    assert_error(await me(client, "not.a.jwt"), 401, "invalid_token")


async def test_ac10_refresh_token_is_not_an_access_token(client: httpx.AsyncClient) -> None:
    """AC10: only `type: access` JWTs authenticate; the opaque refresh token and a non-access JWT are rejected."""
    _, pair = await verified_user(client)
    assert_error(await me(client, pair["refresh_token"]), 401, "invalid_token")
    wrong_type = {**jwt_payload(pair["access_token"]), "type": "refresh"}
    assert_error(await me(client, forge_jwt(wrong_type, JWT_SECRET)), 401, "invalid_token")


async def test_ac10_access_token_lifetime_is_15_minutes(client: httpx.AsyncClient) -> None:
    """AC10: access JWT is HS256 with sub/type/iat/exp and exp - iat = 900 s."""
    _, pair = await verified_user(client)
    claims = jwt_payload(pair["access_token"])
    assert {"sub", "type", "iat", "exp"} <= set(claims)
    assert claims["type"] == "access"
    assert claims["exp"] - claims["iat"] == 900
    assert abs(claims["iat"] - time.time()) < 120


async def test_ac10_access_token_valid_just_before_expiry(client: httpx.AsyncClient) -> None:
    """AC10: a token 14 min 50 s old (signed with the server key) is still accepted."""
    _, pair = await verified_user(client)
    now = int(time.time())
    claims = {**jwt_payload(pair["access_token"]), "iat": now - 890, "exp": now + 10}
    assert (await me(client, forge_jwt(claims))).status_code == 200


# ── AC11 ─────────────────────────────────────────────────────────────────────


async def test_ac11_refresh_rotates_and_old_token_is_dead(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC11: refresh → new TokenPair; the old refresh token is revoked (reuse → 401)."""
    email, pair = await verified_user(client)
    new_pair = assert_token_pair(await refresh(client, pair["refresh_token"]), email)
    assert new_pair["refresh_token"] != pair["refresh_token"]
    assert (await me(client, new_pair["access_token"])).status_code == 200

    assert (await refresh_row(db, pair["refresh_token"]))["revoked_at"] is not None
    assert_error(await refresh(client, pair["refresh_token"]), 401, "invalid_refresh_token")
    assert (await refresh(client, new_pair["refresh_token"])).status_code == 200


async def test_ac11_refresh_with_expired_token(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC11: an expired refresh token → 401 invalid_refresh_token."""
    _, pair = await verified_user(client)
    row = await refresh_row(db, pair["refresh_token"])
    await db.execute("UPDATE refresh_tokens SET expires_at = now() - interval '1 second' WHERE id = $1", row["id"])
    assert_error(await refresh(client, pair["refresh_token"]), 401, "invalid_refresh_token")


async def test_ac11_refresh_with_unknown_token(client: httpx.AsyncClient) -> None:
    """AC11: an unknown refresh token → 401 invalid_refresh_token."""
    assert_error(await refresh(client, "definitely-not-a-real-refresh-token"), 401, "invalid_refresh_token")


async def test_ac11_refresh_token_lifetime_30_days(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """Spec §8: refresh tokens live 30 days and belong to the user."""
    email, pair = await verified_user(client)
    row = await refresh_row(db, pair["refresh_token"])
    lifetime = (row["expires_at"] - row["created_at"]).total_seconds()
    assert abs(lifetime - 30 * 86400) < 120, lifetime
    user = await user_row(db, email)
    assert row["user_id"] == user["id"]


# ── AC12 ─────────────────────────────────────────────────────────────────────


async def test_ac12_logout_revokes_and_is_idempotent(client: httpx.AsyncClient) -> None:
    """AC12: logout → 204; refresh with that token → 401; logout again → 204."""
    _, pair = await verified_user(client)
    first = await client.post("/auth/logout", json={"refresh_token": pair["refresh_token"]})
    assert first.status_code == 204 and first.content == b""
    assert_error(await refresh(client, pair["refresh_token"]), 401, "invalid_refresh_token")
    again = await client.post("/auth/logout", json={"refresh_token": pair["refresh_token"]})
    assert again.status_code == 204


async def test_ac12_logout_unknown_token_is_204(client: httpx.AsyncClient) -> None:
    """AC12 / §8: logout with an unknown token is still 204."""
    response = await client.post("/auth/logout", json={"refresh_token": "never-issued-token"})
    assert response.status_code == 204


async def test_ac12_logout_only_revokes_that_session(client: httpx.AsyncClient) -> None:
    """AC12: logging out one session leaves the user's other session working."""
    email, first = await verified_user(client)
    second = assert_token_pair(await login(client, email), email)
    assert (await client.post("/auth/logout", json={"refresh_token": first["refresh_token"]})).status_code == 204
    assert (await refresh(client, second["refresh_token"])).status_code == 200
