"""Every query on user_profiles. Reads take `user_id` and skip soft-deleted rows. Writes take the acting user's id."""

import uuid
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.profile.models import UserProfile


@dataclass(frozen=True)
class ProfileValues:
    """The four profile fields, already validated and normalised (`""` → None, name trimmed)."""

    full_name: str | None
    age: int | None
    gender: str | None
    phone: str | None


class ProfileRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def commit(self) -> None:
        await self._session.commit()

    async def get(self, user_id: uuid.UUID) -> UserProfile | None:
        result = await self._session.execute(
            select(UserProfile).where(UserProfile.user_id == user_id, UserProfile.deleted_at.is_(None))
        )
        return result.scalar_one_or_none()

    async def upsert(self, user_id: uuid.UUID, values: ProfileValues, actor_id: uuid.UUID) -> UserProfile:
        """Insert the user's one row, or replace all four fields on it. Atomic, so parallel first saves can't
        create two rows. `created_*` is set on insert only; `updated_at` / `updated_by` on every call. A
        soft-deleted row is brought back, since the unique `user_id` leaves room for only one."""
        fields = {"full_name": values.full_name, "age": values.age, "gender": values.gender, "phone": values.phone}
        stmt = (
            insert(UserProfile)
            .values(user_id=user_id, created_by=actor_id, updated_by=actor_id, **fields)
            .on_conflict_do_update(
                index_elements=[UserProfile.user_id],
                set_={
                    **fields,
                    "updated_by": actor_id,
                    "updated_at": func.now(),
                    "deleted_at": None,
                    "deleted_by": None,
                },
            )
            .returning(UserProfile)
        )
        result = await self._session.execute(stmt, execution_options={"populate_existing": True})
        return result.scalar_one()
