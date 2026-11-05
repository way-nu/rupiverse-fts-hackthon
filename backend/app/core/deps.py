"""Shared dependencies: a DB session per request, and the signed-in user's id from the Bearer token."""

import uuid
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.security import TokenExpiredError, TokenInvalidError, decode_access_token
from app.db.engine import get_sessionmaker

_bearer = HTTPBearer(auto_error=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with get_sessionmaker()() as session:
        yield session


async def get_current_user_id(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> uuid.UUID:
    if credentials is None or not credentials.credentials:
        raise AppError("not_authenticated", 401, "Sign in to continue.")
    try:
        claims = decode_access_token(credentials.credentials, settings.jwt_secret)
    except TokenExpiredError as exc:
        raise AppError("token_expired", 401, "Your session has expired.") from exc
    except TokenInvalidError as exc:
        raise AppError("invalid_token", 401, "Your session is not valid.") from exc
    return claims.user_id
