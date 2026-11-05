"""RV1 acceptance · AuditMixin behaviour: AC25 (*_by NULL after every RV1 write, updated_at moves, soft-deleted users
ignored by lookups). Schema-level AC25 checks live in test_rv1_schema.py."""

import asyncpg
import httpx

from tests.acceptance.conftest import (
    OTHER_PASSWORD,
    STRONG_PASSWORD,
    allow_resend,
    assert_error,
    login,
    new_email,
    other_code,
    outbox,
    signup,
    user_row,
)

BY_COLUMNS = ("created_by", "updated_by", "deleted_by")


async def by_values(db: asyncpg.Connection, user_id: object) -> dict[str, list[tuple[object, ...]]]:
    """Every *_by and deleted_at value in all four RV1 tables for one user."""
    cols = ", ".join((*BY_COLUMNS, "deleted_at"))
    return {
        "users": [tuple(r) for r in await db.fetch(f"SELECT {cols} FROM users WHERE id = $1", user_id)],
        "email_codes": [
            tuple(r) for r in await db.fetch(f"SELECT {cols} FROM email_codes WHERE user_id = $1", user_id)
        ],
        "refresh_tokens": [
            tuple(r) for r in await db.fetch(f"SELECT {cols} FROM refresh_tokens WHERE user_id = $1", user_id)
        ],
        "password_reset_tokens": [
            tuple(r) for r in await db.fetch(f"SELECT {cols} FROM password_reset_tokens WHERE user_id = $1", user_id)
        ],
    }


async def test_ac25_every_rv1_write_leaves_by_columns_null(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC25: after signup, re-signup, wrong codes, resend, verify, login, refresh, logout, forgot, verify-code,
    reset: created_by / updated_by / deleted_by (and deleted_at) are NULL on every row of all four tables."""
    email = new_email("audit-all")
    code = await signup(client, email)
    assert (await client.post("/auth/signup", json={"email": email, "password": OTHER_PASSWORD})).status_code == 201
    await client.post("/auth/verify", json={"email": email, "code": other_code(code)})
    await allow_resend(db, email)
    assert (await client.post("/auth/resend", json={"email": email})).status_code == 202
    code = (await outbox(client, email))["code"]
    pair = (await client.post("/auth/verify", json={"email": email, "code": code})).json()
    second = (await login(client, email, OTHER_PASSWORD)).json()
    rotated = (await client.post("/auth/refresh", json={"refresh_token": pair["refresh_token"]})).json()
    assert (await client.post("/auth/logout", json={"refresh_token": rotated["refresh_token"]})).status_code == 204
    assert (await client.post("/auth/password/forgot", json={"email": email})).status_code == 202
    reset_code = (await outbox(client, email, "reset_password"))["code"]
    await client.post("/auth/password/verify-code", json={"email": email, "code": other_code(reset_code)})
    token = (await client.post("/auth/password/verify-code", json={"email": email, "code": reset_code})).json()
    reset = {"reset_token": token["reset_token"], "new_password": STRONG_PASSWORD}
    assert (await client.post("/auth/password/reset", json=reset)).status_code == 204
    assert second["refresh_token"]

    user = await user_row(db, email)
    values = await by_values(db, user["id"])
    assert all(values.values()), f"every table should have rows for this user after the flow: {values}"
    not_null = {table: rows for table, rows in values.items() if any(v is not None for row in rows for v in row)}
    assert not_null == {}, f"*_by / deleted_at must be NULL after RV1 writes (all unauthenticated): {not_null}"


async def test_ac25_updated_at_moves_on_update(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC25: updated_at changes on update (users, email_codes, refresh_tokens)."""
    email = new_email("audit-ts")
    code = await signup(client, email)
    user = await user_row(db, email)
    await db.execute("UPDATE users SET updated_at = updated_at - interval '1 hour' WHERE id = $1", user["id"])
    await db.execute(
        "UPDATE email_codes SET updated_at = updated_at - interval '1 hour' WHERE user_id = $1", user["id"]
    )
    stale_user = (await user_row(db, email))["updated_at"]
    stale_code = await db.fetchval("SELECT updated_at FROM email_codes WHERE user_id = $1", user["id"])

    await client.post("/auth/verify", json={"email": email, "code": other_code(code)})
    assert await db.fetchval("SELECT updated_at FROM email_codes WHERE user_id = $1", user["id"]) > stale_code

    pair = (await client.post("/auth/verify", json={"email": email, "code": code})).json()
    assert (await user_row(db, email))["updated_at"] > stale_user

    await db.execute(
        "UPDATE refresh_tokens SET updated_at = updated_at - interval '1 hour' WHERE user_id = $1", user["id"]
    )
    stale_token = await db.fetchval("SELECT updated_at FROM refresh_tokens WHERE user_id = $1", user["id"])
    assert (await client.post("/auth/logout", json={"refresh_token": pair["refresh_token"]})).status_code == 204
    assert await db.fetchval("SELECT updated_at FROM refresh_tokens WHERE user_id = $1", user["id"]) > stale_token


async def test_ac25_soft_deleted_user_cannot_log_in(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC25: a user row with deleted_at set is ignored by lookups: login → 401 invalid_credentials."""
    email = new_email("deleted")
    code = await signup(client, email)
    assert (await client.post("/auth/verify", json={"email": email, "code": code})).status_code == 200
    assert (await login(client, email)).status_code == 200

    await db.execute("UPDATE users SET deleted_at = now() WHERE email = $1", email)
    ghost = assert_error(await login(client, new_email("ghost")), 401, "invalid_credentials")
    deleted = assert_error(await login(client, email), 401, "invalid_credentials")
    assert deleted == ghost


async def test_ac25_soft_deleted_user_gets_no_reset_email(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC25: forgot for a soft-deleted user → the usual 202 and no email sent."""
    email = new_email("deleted-forgot")
    await signup(client, email)
    await db.execute("UPDATE users SET deleted_at = now() WHERE email = $1", email)

    response = await client.post("/auth/password/forgot", json={"email": email})
    assert response.status_code == 202
    assert response.json() == {"status": "reset_code_sent", "retry_after_seconds": 60}
    sent = await client.get("/test/outbox/latest", params={"email": email, "purpose": "reset_password"})
    assert sent.status_code != 200, f"a soft-deleted user must not get a reset email: {sent.text}"
