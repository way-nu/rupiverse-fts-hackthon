"""Every module's models, imported so Alembic sees the full metadata."""

from app.db.base import Base
from app.modules.auth import models as auth_models
from app.modules.profile import models as profile_models

__all__ = ["Base", "auth_models", "profile_models"]
