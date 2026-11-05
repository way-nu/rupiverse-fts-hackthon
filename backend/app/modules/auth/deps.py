"""Wiring: session + repository + adapters -> AuthService."""

from datetime import timedelta
from typing import Annotated

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.clock import SystemClock
from app.adapters.email.outbox import OUTBOX, OutboxEmailSender
from app.adapters.email.smtp import SmtpEmailSender
from app.core.config import Settings, get_settings
from app.core.deps import get_session
from app.modules.auth.ports import EmailSender
from app.modules.auth.repository import AuthRepository
from app.modules.auth.service import AuthConfig, AuthService

_CLOCK = SystemClock()


def get_email_sender(settings: Annotated[Settings, Depends(get_settings)]) -> EmailSender:
    if settings.test_outbox_enabled and not settings.is_production:
        return OutboxEmailSender(OUTBOX, _CLOCK)
    return SmtpEmailSender(
        host=settings.smtp_host,
        port=settings.smtp_port,
        user=settings.smtp_user,
        password=settings.smtp_app_password,
        sender=settings.smtp_from,
    )


def get_auth_service(
    session: Annotated[AsyncSession, Depends(get_session)],
    mailer: Annotated[EmailSender, Depends(get_email_sender)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthService:
    config = AuthConfig(
        jwt_secret=settings.jwt_secret,
        code_hash_secret=settings.code_hash_secret,
        access_token_ttl=timedelta(minutes=settings.access_token_ttl_min),
        refresh_token_ttl=timedelta(days=settings.refresh_token_ttl_days),
    )
    return AuthService(AuthRepository(session), mailer, _CLOCK, config)


AuthServiceDep = Annotated[AuthService, Depends(get_auth_service)]
