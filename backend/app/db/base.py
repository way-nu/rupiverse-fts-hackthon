"""Declarative base, constraint naming convention, and the column mixins every table uses."""

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, ForeignKey, MetaData, Uuid, func, text
from sqlalchemy.orm import DeclarativeBase, Mapped, declared_attr, mapped_column

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_N_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def _actor_fk() -> Mapped[uuid.UUID | None]:
    return mapped_column(Uuid, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)


class AuditMixin:
    """id, created/updated/deleted at + by. Never redeclare these in a model.

    `*_by` is the authenticated caller's id; NULL when nobody is signed in (self-signup, RV1's auth writes).
    """

    __mapper_args__: Any = {"eager_defaults": True}

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @declared_attr
    def created_by(cls) -> Mapped[uuid.UUID | None]:
        return _actor_fk()

    @declared_attr
    def updated_by(cls) -> Mapped[uuid.UUID | None]:
        return _actor_fk()

    @declared_attr
    def deleted_by(cls) -> Mapped[uuid.UUID | None]:
        return _actor_fk()


class OwnedMixin:
    """`user_id` for user-owned rows. Deleting the user deletes the rows."""

    @declared_attr
    def user_id(cls) -> Mapped[uuid.UUID]:
        return mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
