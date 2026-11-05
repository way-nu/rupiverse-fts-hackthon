"""Auth tables (Spec §7). AuditMixin supplies id / *_at / *_by; OwnedMixin supplies user_id."""

from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, SmallInteger, String, Text, UniqueConstraint, false, text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import AuditMixin, Base, OwnedMixin


class User(AuditMixin, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("email = lower(email)", name="email_lowercase"),)

    email: Mapped[str] = mapped_column(String(254), nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default=false())
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EmailCode(OwnedMixin, AuditMixin, Base):
    """At most one live code per user per purpose; a resend replaces the row's code."""

    __tablename__ = "email_codes"
    __table_args__ = (
        UniqueConstraint("user_id", "purpose"),
        CheckConstraint("purpose IN ('verify_email', 'reset_password')", name="purpose"),
        CheckConstraint("failed_attempts BETWEEN 0 AND 3", name="failed_attempts_range"),
    )

    purpose: Mapped[str] = mapped_column(Text, nullable=False)
    code_hash: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    failed_attempts: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, server_default=text("0"))
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PasswordResetToken(OwnedMixin, AuditMixin, Base):
    __tablename__ = "password_reset_tokens"

    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RefreshToken(OwnedMixin, AuditMixin, Base):
    __tablename__ = "refresh_tokens"

    token_hash: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
