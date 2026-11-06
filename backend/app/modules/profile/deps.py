"""Wiring: session + repository + the auth service (for the account email) -> ProfileService."""

from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_session
from app.modules.auth.deps import AuthServiceDep
from app.modules.profile.repository import ProfileRepository
from app.modules.profile.service import ProfileService


def get_profile_service(session: Annotated[AsyncSession, Depends(get_session)], auth: AuthServiceDep) -> ProfileService:
    return ProfileService(ProfileRepository(session), auth)


ProfileServiceDep = Annotated[ProfileService, Depends(get_profile_service)]
