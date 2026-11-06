"""Profile API tests also inspect rows directly, so they need the acceptance harness's `db` connection."""

from tests.acceptance.conftest import db

__all__ = ["db"]
