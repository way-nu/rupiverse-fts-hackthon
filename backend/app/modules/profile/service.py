"""Profile use cases (Spec §8): read the signed-in user's profile, and replace it after validating every field."""

import uuid
from dataclasses import dataclass
from datetime import datetime

from app.modules.profile import errors
from app.modules.profile.constants import AGE_MAX, AGE_MIN, GENDERS, NAME_MAX_CHARS, NAME_MIN_CHARS, PHONE_PATTERN
from app.modules.profile.models import UserProfile
from app.modules.profile.ports import AccountReader
from app.modules.profile.repository import ProfileRepository, ProfileValues


@dataclass(frozen=True)
class ProfileUpdateInput:
    """A well-typed PUT body (types already checked by the schema). Values are not yet validated."""

    full_name: str | None
    age: int | str | None  # an int, "" or None
    gender: str | None
    phone: str | None


@dataclass(frozen=True)
class Profile:
    email: str
    full_name: str | None
    age: int | None
    gender: str | None
    phone: str | None
    updated_at: datetime | None


def validate(update: ProfileUpdateInput) -> ProfileValues:
    """Normalise (`""` → None, name trimmed) and check every field; raise `invalid_profile` listing each bad key
    in the order full_name, age, gender, phone. Never includes a value in the error."""
    bad: list[str] = []

    full_name = (update.full_name or "").strip() or None
    if full_name is not None and not NAME_MIN_CHARS <= len(full_name) <= NAME_MAX_CHARS:
        bad.append("full_name")

    age: int | None = None
    if isinstance(update.age, int) and not isinstance(update.age, bool):
        age = update.age
        if not AGE_MIN <= age <= AGE_MAX:
            bad.append("age")
    elif update.age not in (None, ""):
        bad.append("age")  # the schema already rejects other types; kept so the rule never relies on it

    gender = update.gender or None
    if gender is not None and gender not in GENDERS:
        bad.append("gender")

    phone = update.phone or None
    if phone is not None and PHONE_PATTERN.fullmatch(phone) is None:
        bad.append("phone")

    if bad:
        raise errors.invalid_profile(bad)
    return ProfileValues(full_name=full_name, age=age, gender=gender, phone=phone)


class ProfileService:
    def __init__(self, repo: ProfileRepository, accounts: AccountReader) -> None:
        self._repo = repo
        self._accounts = accounts

    async def get_profile(self, user_id: uuid.UUID) -> Profile:
        """Never 404: a user who never saved gets four nulls and `updated_at` None. Reading creates no row."""
        account = await self._accounts.current_user(user_id)
        return _profile(account.email, await self._repo.get(user_id))

    async def update_profile(self, user_id: uuid.UUID, update: ProfileUpdateInput) -> Profile:
        """Full replace of the user's one row (created on the first save). Nothing is written if any field is bad."""
        account = await self._accounts.current_user(user_id)
        values = validate(update)
        row = await self._repo.upsert(user_id, values, actor_id=user_id)
        await self._repo.commit()
        return _profile(account.email, row)


def _profile(email: str, row: UserProfile | None) -> Profile:
    if row is None:
        return Profile(email=email.lower(), full_name=None, age=None, gender=None, phone=None, updated_at=None)
    return Profile(
        email=email.lower(),
        full_name=row.full_name,
        age=row.age,
        gender=row.gender,
        phone=row.phone,
        updated_at=row.updated_at,
    )
