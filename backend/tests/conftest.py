"""Shared test setup: dummy secrets so `app.main` imports without a .env (acceptance tests pass their own)."""

import os

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://rupiverse@localhost:5432/rupiverse_unit_tests_unused")
os.environ.setdefault("JWT_SECRET", "unit-test-jwt-secret")
os.environ.setdefault("CODE_HASH_SECRET", "unit-test-code-secret")
