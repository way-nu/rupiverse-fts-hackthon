"""0002_rv4_profile: upgrade head → downgrade -1 → upgrade head on a fresh database (RV1 tables survive)."""

import asyncio
from collections.abc import Iterator

import asyncpg
import pytest

from tests.acceptance.conftest import alembic, create_database, drop_database, pg_dsn


async def _tables(url: str) -> set[str]:
    conn = await asyncpg.connect(pg_dsn(url))
    try:
        return {r["tablename"] for r in await conn.fetch("SELECT tablename FROM pg_tables WHERE schemaname='public'")}
    finally:
        await conn.close()


def tables(url: str) -> set[str]:
    return asyncio.run(_tables(url))


@pytest.fixture
def fresh_db() -> Iterator[str]:
    url = create_database("rv4_api_mig")
    yield url
    drop_database(url)


def test_upgrade_downgrade_upgrade(fresh_db: str) -> None:
    for step in (("upgrade", "head"), ("downgrade", "-1"), ("upgrade", "head")):
        result = alembic(fresh_db, *step)
        assert result.returncode == 0, f"alembic {' '.join(step)}:\n{result.stdout}\n{result.stderr}"
        if step[0] == "downgrade":
            remaining = tables(fresh_db)
            assert "user_profiles" not in remaining
            assert {"users", "email_codes", "password_reset_tokens", "refresh_tokens"} <= remaining
    assert "user_profiles" in tables(fresh_db)
