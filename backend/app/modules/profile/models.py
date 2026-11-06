"""Profile table (Spec §7). AuditMixin supplies id / *_at / *_by; OwnedMixin supplies user_id."""

from sqlalchemy import CheckConstraint, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import AuditMixin, Base, OwnedMixin


class UserProfile(OwnedMixin, AuditMixin, Base):
    """One row per user, created on the first save. Every field is optional; the checks mirror the service rules."""

    __tablename__ = "user_profiles"
    __table_args__ = (
        UniqueConstraint("user_id"),
        CheckConstraint("char_length(full_name) BETWEEN 3 AND 80", name="full_name_length"),
        CheckConstraint("age BETWEEN 18 AND 120", name="age_range"),
        CheckConstraint("gender IN ('male', 'female', 'other')", name="gender"),
        CheckConstraint("phone ~ '^[0-9]{10}$'", name="phone_digits"),
    )

    full_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    age: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    gender: Mapped[str | None] = mapped_column(Text, nullable=True)
    phone: Mapped[str | None] = mapped_column(String(10), nullable=True)
