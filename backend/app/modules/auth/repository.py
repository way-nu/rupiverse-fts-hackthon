"""Every query on the auth tables. Lookups skip soft-deleted rows. Writes take the acting user's id (`actor_id`)."""

import uuid
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import AuditMixin
from app.modules.auth.constants import CodePurpose
from app.modules.auth.models import EmailCode, PasswordResetToken, RefreshToken, User


class AuthRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ── transaction ──────────────────────────────────────────────────────────

    async def commit(self) -> None:
        await self._session.commit()

    async def rollback(self) -> None:
        await self._session.rollback()

    async def add(self, row: AuditMixin, actor_id: uuid.UUID | None) -> None:
        row.created_by = actor_id
        row.updated_by = actor_id
        self._session.add(row)
        await self._session.flush()

    async def save(self, row: AuditMixin, actor_id: uuid.UUID | None) -> None:
        """Flush changes made to a loaded row, stamping who made them."""
        row.updated_by = actor_id
        await self._session.flush()

    # ── users ────────────────────────────────────────────────────────────────

    async def get_user_by_email(self, email: str) -> User | None:
        result = await self._session.execute(select(User).where(User.email == email, User.deleted_at.is_(None)))
        return result.scalar_one_or_none()

    async def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self._session.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
        return result.scalar_one_or_none()

    # ── email codes ──────────────────────────────────────────────────────────

    async def get_code(self, user_id: uuid.UUID, purpose: CodePurpose) -> EmailCode | None:
        result = await self._session.execute(
            select(EmailCode).where(
                EmailCode.user_id == user_id, EmailCode.purpose == purpose, EmailCode.deleted_at.is_(None)
            )
        )
        return result.scalar_one_or_none()

    # ── refresh tokens ───────────────────────────────────────────────────────

    async def get_refresh_token(self, token_hash: str) -> RefreshToken | None:
        result = await self._session.execute(
            select(RefreshToken).where(RefreshToken.token_hash == token_hash, RefreshToken.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def revoke_all_refresh_tokens(self, user_id: uuid.UUID, now: datetime, actor_id: uuid.UUID | None) -> None:
        await self._session.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
            .values(revoked_at=now, updated_by=actor_id)
        )

    # ── password reset tokens ────────────────────────────────────────────────

    async def get_reset_token(self, token_hash: str) -> PasswordResetToken | None:
        result = await self._session.execute(
            select(PasswordResetToken).where(
                PasswordResetToken.token_hash == token_hash, PasswordResetToken.deleted_at.is_(None)
            )
        )
        return result.scalar_one_or_none()
