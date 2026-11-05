"""RV1 acceptance · migrations, schema and repo hygiene: AC1, AC14 (repo part), AC25 (schema part)."""

import asyncio
import re
import subprocess
from collections.abc import Iterator
from pathlib import Path

import asyncpg
import pytest

from tests.acceptance.conftest import (
    AUDIT_COLUMNS,
    BACKEND_DIR,
    RV1_TABLES,
    alembic,
    create_database,
    drop_database,
    pg_dsn,
)

REPO_DIR = BACKEND_DIR.parent
ENV_EXAMPLE_KEYS = (
    "DATABASE_URL",
    "JWT_SECRET",
    "CODE_HASH_SECRET",
    "ACCESS_TOKEN_TTL_MIN",
    "REFRESH_TOKEN_TTL_DAYS",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USER",
    "SMTP_APP_PASSWORD",
    "SMTP_FROM",
    "CORS_ORIGINS",
    "APP_ENV",
    "TEST_OUTBOX_ENABLED",
)


async def _query(url: str, sql: str) -> list[asyncpg.Record]:
    conn = await asyncpg.connect(pg_dsn(url))
    try:
        return await conn.fetch(sql)
    finally:
        await conn.close()


def query(url: str, sql: str) -> list[asyncpg.Record]:
    return asyncio.run(_query(url, sql))


USER_OBJECTS_SQL = """
SELECT n.nspname AS schema, c.relname AS name, c.relkind AS kind
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
ORDER BY 1, 2
"""


def public_tables(url: str) -> set[str]:
    rows = query(url, "SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    return {r["tablename"] for r in rows}


def run_ok(url: str, *args: str) -> None:
    result = alembic(url, *args)
    assert result.returncode == 0, f"alembic {' '.join(args)} failed:\n{result.stdout}\n{result.stderr}"


@pytest.fixture
def fresh_db() -> Iterator[str]:
    url = create_database("rv1_mig")
    yield url
    drop_database(url)


# ── AC1 ──────────────────────────────────────────────────────────────────────


def test_ac1_upgrade_head_on_fresh_db_creates_only_public_objects(fresh_db: str) -> None:
    """AC1: `alembic upgrade head` applies cleanly to a fresh Postgres; only `public` objects; `auth` untouched."""
    schemas_before = {r["nspname"] for r in query(fresh_db, "SELECT nspname FROM pg_namespace")}
    run_ok(fresh_db, "upgrade", "head")

    assert set(RV1_TABLES) <= public_tables(fresh_db)
    objects = query(fresh_db, USER_OBJECTS_SQL)
    outside_public = [(r["schema"], r["name"]) for r in objects if r["schema"] != "public"]
    assert outside_public == [], f"migration created objects outside public: {outside_public}"
    schemas_after = {r["nspname"] for r in query(fresh_db, "SELECT nspname FROM pg_namespace")}
    assert schemas_after == schemas_before, f"migration created schemas: {schemas_after - schemas_before}"
    assert "auth" not in schemas_after


def test_ac1_upgrade_downgrade_one_upgrade_round_trip(fresh_db: str) -> None:
    """AC1: upgrade head → downgrade -1 → upgrade head works."""
    run_ok(fresh_db, "upgrade", "head")
    run_ok(fresh_db, "downgrade", "-1")
    run_ok(fresh_db, "upgrade", "head")
    assert set(RV1_TABLES) <= public_tables(fresh_db)


def test_ac1_downgrade_base_removes_everything(fresh_db: str) -> None:
    """AC1: `alembic downgrade base` reverses the migration locally."""
    run_ok(fresh_db, "upgrade", "head")
    run_ok(fresh_db, "downgrade", "base")
    leftover = public_tables(fresh_db) - {"alembic_version"}
    assert leftover == set(), f"downgrade base left tables behind: {leftover}"
    types = query(
        fresh_db,
        "SELECT t.typname FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace "
        "WHERE n.nspname = 'public' AND t.typtype = 'e'",
    )
    assert types == [], f"downgrade base left enum types behind: {[r['typname'] for r in types]}"


def test_ac1_migration_is_named_0001_rv1_auth() -> None:
    """AC1 / Spec §7: the first migration is `0001_rv1_auth`."""
    versions = list((BACKEND_DIR / "alembic" / "versions").glob("*.py"))
    assert any("0001_rv1_auth" in p.name or "0001_rv1_auth" in p.read_text() for p in versions), versions


# ── AC25 (schema) ────────────────────────────────────────────────────────────


@pytest.fixture(scope="module")
def migrated_db() -> Iterator[str]:
    url = create_database("rv1_schema")
    try:
        run_ok(url, "upgrade", "head")
        yield url
    finally:
        drop_database(url)


@pytest.mark.parametrize("table", RV1_TABLES)
def test_ac25_audit_mixin_columns_on_every_table(migrated_db: str, table: str) -> None:
    """AC25: every RV1 table has the AuditMixin columns with the types/defaults in Spec §7."""
    rows = query(
        migrated_db,
        "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns "
        f"WHERE table_schema = 'public' AND table_name = '{table}'",
    )
    cols = {r["column_name"]: r for r in rows}
    missing = [c for c in AUDIT_COLUMNS if c not in cols]
    assert missing == [], f"{table} is missing AuditMixin columns {missing}"

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
        assert (cols[name]["data_type"], cols[name]["is_nullable"]) == (data_type, nullable), (table, dict(cols[name]))
    assert "gen_random_uuid()" in (cols["id"]["column_default"] or ""), cols["id"]
    assert "now()" in (cols["created_at"]["column_default"] or ""), cols["created_at"]
    assert "now()" in (cols["updated_at"]["column_default"] or ""), cols["updated_at"]

    pk = query(
        migrated_db,
        "SELECT a.attname FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey) "
        f"WHERE i.indrelid = 'public.{table}'::regclass AND i.indisprimary",
    )
    assert [r["attname"] for r in pk] == ["id"], f"{table} primary key: {pk}"


@pytest.mark.parametrize("table", RV1_TABLES)
def test_ac25_by_columns_reference_users_on_delete_set_null(migrated_db: str, table: str) -> None:
    """AC25: created_by / updated_by / deleted_by → users.id ON DELETE SET NULL."""
    rows = query(
        migrated_db,
        """
        SELECT a.attname AS column_name, cf.relname AS ref_table, c.confdeltype::text AS on_delete
        FROM pg_constraint c
        JOIN pg_class ct ON ct.oid = c.conrelid
        JOIN pg_class cf ON cf.oid = c.confrelid
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND ct.relname = '"""
        + table
        + "'",
    )
    fks = {r["column_name"]: (r["ref_table"], r["on_delete"]) for r in rows}
    for column in ("created_by", "updated_by", "deleted_by"):
        assert fks.get(column) == ("users", "n"), f"{table}.{column} FK should be users ON DELETE SET NULL: {fks}"


def test_ac25_spec_columns_and_constraints(migrated_db: str) -> None:
    """Spec §7: table-specific columns, unique/check constraints and user_id cascades."""

    def columns(table: str) -> set[str]:
        rows = query(
            migrated_db,
            f"SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='{table}'",
        )
        return {r["column_name"] for r in rows}

    assert {"email", "password_hash", "is_verified", "verified_at"} <= columns("users")
    assert {
        "user_id",
        "purpose",
        "code_hash",
        "expires_at",
        "sent_at",
        "failed_attempts",
        "consumed_at",
    } <= columns("email_codes")
    assert {"user_id", "token_hash", "expires_at", "used_at"} <= columns("password_reset_tokens")
    assert {"user_id", "token_hash", "expires_at", "revoked_at"} <= columns("refresh_tokens")

    cascades = query(
        migrated_db,
        """
        SELECT ct.relname AS table_name, c.confdeltype::text AS on_delete
        FROM pg_constraint c
        JOIN pg_class ct ON ct.oid = c.conrelid
        JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
        WHERE c.contype = 'f' AND a.attname = 'user_id'
        """,
    )
    assert {r["table_name"]: r["on_delete"] for r in cascades} == {
        "email_codes": "c",
        "password_reset_tokens": "c",
        "refresh_tokens": "c",
    }


async def test_ac25_db_constraints_reject_bad_rows(migrated_db: str) -> None:
    """Spec §7: email must be lowercase and unique; purpose in (verify_email, reset_password); one code per purpose;
    failed_attempts 0–3."""
    conn = await asyncpg.connect(pg_dsn(migrated_db))
    try:
        with pytest.raises(asyncpg.CheckViolationError):
            await conn.execute("INSERT INTO users (email, password_hash) VALUES ('Upper@Example.com', 'x')")
        uid = await conn.fetchval("INSERT INTO users (email, password_hash) VALUES ('c@example.com', 'x') RETURNING id")
        with pytest.raises(asyncpg.UniqueViolationError):
            await conn.execute("INSERT INTO users (email, password_hash) VALUES ('c@example.com', 'y')")
        row = (
            "INSERT INTO email_codes (user_id, purpose, code_hash, expires_at, sent_at{extra}) "
            "VALUES ($1, $2, 'h', now(), now(){vals})"
        )
        with pytest.raises(asyncpg.CheckViolationError):
            await conn.execute(row.format(extra="", vals=""), uid, "login")
        await conn.execute(row.format(extra="", vals=""), uid, "verify_email")
        with pytest.raises(asyncpg.UniqueViolationError):
            await conn.execute(row.format(extra="", vals=""), uid, "verify_email")
        with pytest.raises(asyncpg.CheckViolationError):
            await conn.execute(row.format(extra=", failed_attempts", vals=", 4"), uid, "reset_password")
        defaults = await conn.fetchrow("SELECT is_verified, verified_at, created_by FROM users WHERE id = $1", uid)
        assert (defaults["is_verified"], defaults["verified_at"], defaults["created_by"]) == (False, None, None)
    finally:
        await conn.close()


AUDIT_DECLARATION = re.compile(
    r"^\s*(id|created_at|created_by|updated_at|updated_by|deleted_at|deleted_by)\s*(:|=)", re.MULTILINE
)


def test_ac25_audit_columns_come_from_mixin_not_redeclared() -> None:
    """AC25: AuditMixin lives in app/db/base.py and no model redeclares its columns."""
    base = BACKEND_DIR / "app" / "db" / "base.py"
    assert base.exists(), "app/db/base.py is missing"
    assert re.search(r"^class AuditMixin\b", base.read_text(), re.MULTILINE), "AuditMixin not defined in db/base.py"

    model_files = list((BACKEND_DIR / "app" / "modules").glob("*/models.py"))
    assert model_files, "no app/modules/*/models.py found"
    offenders: list[str] = []
    for path in model_files:
        for match in AUDIT_DECLARATION.finditer(path.read_text()):
            offenders.append(f"{path.relative_to(BACKEND_DIR)}: {match.group(1)}")
    assert offenders == [], f"AuditMixin columns redeclared in models: {offenders}"


# ── AC14 (repo part) ─────────────────────────────────────────────────────────


def _tracked_files() -> list[str]:
    out = subprocess.run(["git", "ls-files"], cwd=REPO_DIR, capture_output=True, text=True, check=True).stdout
    return out.splitlines()


def test_ac14_env_example_committed_and_env_not_tracked() -> None:
    """AC14: the repo holds only backend/.env.example (every Spec key), never a real .env."""
    tracked = _tracked_files()
    env_files = [f for f in tracked if re.search(r"(^|/)\.env($|\.)", f) and not f.endswith(".env.example")]
    assert env_files == [], f".env files are committed: {env_files}"
    assert "backend/.env.example" in tracked, "backend/.env.example is not committed"

    example = (BACKEND_DIR / ".env.example").read_text()
    keys = {line.split("=", 1)[0].strip() for line in example.splitlines() if "=" in line and not line.startswith("#")}
    missing = [k for k in ENV_EXAMPLE_KEYS if k not in keys]
    assert missing == [], f".env.example is missing keys: {missing}"
    assert re.search(r"^TEST_OUTBOX_ENABLED\s*=\s*false\s*$", example, re.MULTILINE | re.IGNORECASE)


def test_ac14_no_secret_looking_values_in_tracked_backend_files() -> None:
    """AC14: no Gmail app password, private key or Supabase credential committed."""
    patterns = {
        "private key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
        "gmail app password": re.compile(r"SMTP_APP_PASSWORD\s*=\s*[a-z]{4}\s?[a-z]{4}\s?[a-z]{4}\s?[a-z]{4}\b"),
        "postgres url with password": re.compile(
            r"postgres(ql)?(\+\w+)?://[^:\s/]+:[^@\s]{6,}@(?!localhost|127\.0\.0\.1)"
        ),
        "supabase key": re.compile(r"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_-]{20,}"),
    }
    hits: list[str] = []
    for rel in _tracked_files():
        if not rel.startswith("backend/") or rel.endswith((".lock", ".png")):
            continue
        path = Path(REPO_DIR, rel)
        if not path.is_file():
            continue
        text = path.read_text(errors="ignore")
        hits += [f"{rel}: {name}" for name, pattern in patterns.items() if pattern.search(text)]
    assert hits == [], f"possible secrets committed: {hits}"
