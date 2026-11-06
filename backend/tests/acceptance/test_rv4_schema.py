"""RV4 acceptance · user_profiles table and migration: AC1 (local part).

AC1's Supabase-staging part is a one-off run with `.env.staging` during VERIFY; its output goes in the Test report.
"""

import asyncio
import uuid
from collections.abc import Iterator

import asyncpg
import pytest

from tests.acceptance.conftest import AUDIT_COLUMNS, BACKEND_DIR, alembic, create_database, drop_database, pg_dsn

TABLE = "user_profiles"


async def _query(url: str, sql: str, *args: object) -> list[asyncpg.Record]:
    conn = await asyncpg.connect(pg_dsn(url))
    try:
        return await conn.fetch(sql, *args)
    finally:
        await conn.close()


def query(url: str, sql: str, *args: object) -> list[asyncpg.Record]:
    return asyncio.run(_query(url, sql, *args))


def run_ok(url: str, *args: str) -> None:
    result = alembic(url, *args)
    assert result.returncode == 0, f"alembic {' '.join(args)} failed:\n{result.stdout}\n{result.stderr}"


def public_tables(url: str) -> set[str]:
    return {r["tablename"] for r in query(url, "SELECT tablename FROM pg_tables WHERE schemaname = 'public'")}


@pytest.fixture
def fresh_db() -> Iterator[str]:
    url = create_database("rv4_mig")
    yield url
    drop_database(url)


@pytest.fixture(scope="module")
def migrated_db() -> Iterator[str]:
    url = create_database("rv4_schema")
    try:
        run_ok(url, "upgrade", "head")
        yield url
    finally:
        drop_database(url)


def columns(url: str) -> dict[str, asyncpg.Record]:
    rows = query(
        url,
        "SELECT column_name, data_type, is_nullable, character_maximum_length, column_default "
        "FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1",
        TABLE,
    )
    return {r["column_name"]: r for r in rows}


# ── migration ────────────────────────────────────────────────────────────────


def test_ac1_upgrade_head_creates_user_profiles_in_public(fresh_db: str) -> None:
    """AC1: `alembic upgrade head` on a fresh DB creates public.user_profiles."""
    run_ok(fresh_db, "upgrade", "head")
    assert TABLE in public_tables(fresh_db)
    other = query(fresh_db, "SELECT table_schema FROM information_schema.tables WHERE table_name = $1", TABLE)
    assert {r["table_schema"] for r in other} == {"public"}, other


def test_ac1_upgrade_downgrade_one_upgrade_round_trip(fresh_db: str) -> None:
    """AC1: upgrade head → downgrade -1 (drops user_profiles, keeps RV1) → upgrade head."""
    run_ok(fresh_db, "upgrade", "head")
    run_ok(fresh_db, "downgrade", "-1")
    tables = public_tables(fresh_db)
    assert TABLE not in tables, "downgrade -1 must drop user_profiles"
    assert {"users", "email_codes", "password_reset_tokens", "refresh_tokens"} <= tables, "RV1 tables must survive"
    run_ok(fresh_db, "upgrade", "head")
    assert TABLE in public_tables(fresh_db)


def test_ac1_migration_is_0002_rv4_profile() -> None:
    """AC1 / §7: the migration is `0002_rv4_profile`."""
    versions = list((BACKEND_DIR / "alembic" / "versions").glob("*.py"))
    assert any("0002_rv4_profile" in p.name for p in versions), [p.name for p in versions]


# ── columns ──────────────────────────────────────────────────────────────────


def test_ac1_profile_columns_and_types(migrated_db: str) -> None:
    """AC1 / §7: full_name VARCHAR(80), age SMALLINT, gender TEXT, phone VARCHAR(10), all nullable; user_id NOT NULL."""
    cols = columns(migrated_db)
    expected = {
        "full_name": ("character varying", 80),
        "age": ("smallint", None),
        "gender": ("text", None),
        "phone": ("character varying", 10),
    }
    for name, (data_type, length) in expected.items():
        assert name in cols, f"missing column {name}: {sorted(cols)}"
        assert cols[name]["data_type"] == data_type, dict(cols[name])
        assert cols[name]["character_maximum_length"] == length, dict(cols[name])
        assert cols[name]["is_nullable"] == "YES", f"{name} must be nullable"
    assert cols["user_id"]["data_type"] == "uuid" and cols["user_id"]["is_nullable"] == "NO", dict(cols["user_id"])


def test_ac1_audit_mixin_columns(migrated_db: str) -> None:
    """AC1: AuditMixin columns with their types and defaults; id is the primary key."""
    cols = columns(migrated_db)
    assert [c for c in AUDIT_COLUMNS if c not in cols] == []
    expected = {
        "id": ("uuid", "NO"),
        "created_at": ("timestamp with time zone", "NO"),
        "created_by": ("uuid", "YES"),
        "updated_at": ("timestamp with time zone", "NO"),
        "updated_by": ("uuid", "YES"),
        "deleted_at": ("timestamp with time zone", "YES"),
        "deleted_by": ("uuid", "YES"),
    }
    for name, (data_type, nullable) in expected.items():
        assert (cols[name]["data_type"], cols[name]["is_nullable"]) == (data_type, nullable), dict(cols[name])
    assert "gen_random_uuid()" in (cols["id"]["column_default"] or "")
    assert "now()" in (cols["created_at"]["column_default"] or "")
    assert "now()" in (cols["updated_at"]["column_default"] or "")
    pk = query(
        migrated_db,
        "SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) "
        "WHERE i.indrelid = 'public.user_profiles'::regclass AND i.indisprimary",
    )
    assert [r["attname"] for r in pk] == ["id"]


def test_ac1_foreign_keys(migrated_db: str) -> None:
    """AC1: user_id → users ON DELETE CASCADE (OwnedMixin); *_by → users ON DELETE SET NULL (AuditMixin)."""
    rows = query(
        migrated_db,
        """
        SELECT a.attname AS col, cf.relname AS ref, c.confdeltype::text AS on_delete
        FROM pg_constraint c
        JOIN pg_class cf ON cf.oid = c.confrelid
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND c.conrelid = 'public.user_profiles'::regclass
        """,
    )
    fks = {r["col"]: (r["ref"], r["on_delete"]) for r in rows}
    assert fks.get("user_id") == ("users", "c"), fks
    for col in ("created_by", "updated_by", "deleted_by"):
        assert fks.get(col) == ("users", "n"), fks


def test_ac1_user_id_is_unique_and_indexed(migrated_db: str) -> None:
    """AC1 / §7: one profile per user: a unique index (or constraint) on user_id alone."""
    rows = query(
        migrated_db,
        "SELECT i.indisunique, array_agg(a.attname::text) AS cols FROM pg_index i "
        "JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) "
        "WHERE i.indrelid = 'public.user_profiles'::regclass GROUP BY i.indexrelid, i.indisunique",
    )
    assert any(r["indisunique"] and r["cols"] == ["user_id"] for r in rows), [dict(r) for r in rows]


def test_ac1_constraint_names_follow_the_convention(migrated_db: str) -> None:
    """§7: constraint names come from the naming convention in db/base.py (pk_/uq_/ck_/fk_<table>_…)."""
    rows = query(
        migrated_db,
        "SELECT conname, contype::text AS contype FROM pg_constraint WHERE conrelid = 'public.user_profiles'::regclass",
    )
    prefixes = {"p": "pk_user_profiles", "u": "uq_user_profiles_", "c": "ck_user_profiles_", "f": "fk_user_profiles_"}
    bad = [
        r["conname"] for r in rows if r["contype"] in prefixes and not r["conname"].startswith(prefixes[r["contype"]])
    ]
    assert bad == [], f"constraints not named by the convention: {bad}"
    assert sum(1 for r in rows if r["contype"] == "c") >= 4, "expected the four §7 check constraints"


# ── check constraints (insert straight into the DB) ──────────────────────────


async def _insert_profile(url: str, **values: object) -> None:
    conn = await asyncpg.connect(pg_dsn(url))
    try:
        async with conn.transaction():
            user_id = await conn.fetchval(
                "INSERT INTO public.users (email, password_hash) VALUES ($1, 'x') RETURNING id",
                f"rv4-ck-{uuid.uuid4().hex[:10]}@example.com",
            )
            cols = ", ".join(["user_id", *values])
            params = ", ".join(f"${i}" for i in range(1, len(values) + 2))
            await conn.execute(
                f"INSERT INTO public.user_profiles ({cols}) VALUES ({params})", user_id, *values.values()
            )
            raise _RollbackError
    except _RollbackError:
        pass
    finally:
        await conn.close()


class _RollbackError(Exception):
    pass


@pytest.mark.parametrize(
    "values",
    [
        pytest.param({"age": 17}, id="age-17"),
        pytest.param({"age": 121}, id="age-121"),
        pytest.param({"gender": "Male"}, id="gender-wrong-case"),
        pytest.param({"gender": "unknown"}, id="gender-unknown"),
        pytest.param({"phone": "987654321"}, id="phone-9-digits"),
        pytest.param({"phone": "98765 4321"}, id="phone-space"),
        pytest.param({"full_name": "ab"}, id="name-2-chars"),
    ],
)
def test_ac1_check_constraints_reject_bad_values(migrated_db: str, values: dict[str, object]) -> None:
    """AC1 / §7: DB check constraints mirror the rules (age 18–120, gender set, 10 digits, name 3–80)."""
    with pytest.raises(asyncpg.CheckViolationError):
        asyncio.run(_insert_profile(migrated_db, **values))


@pytest.mark.parametrize(
    "values",
    [
        pytest.param({}, id="all-null"),
        pytest.param({"full_name": "Abc", "age": 18, "gender": "other", "phone": "0123456789"}, id="lower-edges"),
        pytest.param({"full_name": "x" * 80, "age": 120, "gender": "female"}, id="upper-edges"),
    ],
)
def test_ac1_check_constraints_accept_valid_values(migrated_db: str, values: dict[str, object]) -> None:
    """AC1 / §7: every field is nullable and the edge values are accepted."""
    asyncio.run(_insert_profile(migrated_db, **values))


def test_ac1_second_profile_for_the_same_user_is_rejected(migrated_db: str) -> None:
    """AC1 / §7: unique user_id at the DB level."""

    async def go() -> None:
        conn = await asyncpg.connect(pg_dsn(migrated_db))
        try:
            async with conn.transaction():
                user_id = await conn.fetchval(
                    "INSERT INTO public.users (email, password_hash) VALUES ($1, 'x') RETURNING id",
                    f"rv4-uq-{uuid.uuid4().hex[:10]}@example.com",
                )
                await conn.execute("INSERT INTO public.user_profiles (user_id) VALUES ($1)", user_id)
                await conn.execute("INSERT INTO public.user_profiles (user_id) VALUES ($1)", user_id)
        finally:
            await conn.close()

    with pytest.raises(asyncpg.UniqueViolationError):
        asyncio.run(go())
