"""Auth use cases (Spec §8). Owns the transaction: commits once per use case, and before raising after a write."""

import asyncio
import math
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import lru_cache

from app.core import security
from app.core.errors import AppError
from app.modules.auth import errors
from app.modules.auth.constants import (
    CODE_TTL,
    EMAIL_BODIES,
    EMAIL_SUBJECTS,
    MAX_CODE_ATTEMPTS,
    RESEND_INTERVAL,
    RESET_PASSWORD,
    RESET_TOKEN_TTL,
    VERIFY_EMAIL,
    CodePurpose,
)
from app.modules.auth.models import EmailCode, PasswordResetToken, RefreshToken, User
from app.modules.auth.policy import check_password, normalize_email, try_normalize_email
from app.modules.auth.ports import Clock, CodeEmail, EmailSender, EmailSendError
from app.modules.auth.repository import AuthRepository

# Every write in RV1 is unauthenticated, so no user is "acting": *_by stays NULL (Spec §7).
NO_ACTOR: uuid.UUID | None = None


@dataclass(frozen=True)
class AuthConfig:
    jwt_secret: str
    code_hash_secret: str
    access_token_ttl: timedelta
    refresh_token_ttl: timedelta


@dataclass(frozen=True)
class IssuedSession:
    access_token: str
    refresh_token: str
    expires_in: int
    user: User


@dataclass(frozen=True)
class IssuedResetToken:
    reset_token: str
    expires_in: int


@lru_cache
def _dummy_hash() -> str:
    """A real bcrypt hash to compare against for unknown emails, so timing doesn't reveal which emails exist."""
    return security.hash_password("timing-equaliser-Aa1!")


async def _hash_password(password: str) -> str:
    return await asyncio.to_thread(security.hash_password, password)


async def _verify_password(password: str, password_hash: str) -> bool:
    return await asyncio.to_thread(security.verify_password, password, password_hash)


class AuthService:
    def __init__(self, repo: AuthRepository, mailer: EmailSender, clock: Clock, config: AuthConfig) -> None:
        self._repo = repo
        self._mailer = mailer
        self._clock = clock
        self._config = config

    # ── signup / verification ────────────────────────────────────────────────

    async def signup(self, raw_email: str, password: str) -> str:
        """Create (or refresh an unverified) account and email a code. Returns the normalised email."""
        email = normalize_email(raw_email)
        check_password(password)
        password_hash = await _hash_password(password)

        user = await self._repo.get_user_by_email(email)
        if user is not None and user.is_verified:
            raise errors.email_taken()
        if user is None:
            user = User(email=email, password_hash=password_hash, is_verified=False)
            await self._repo.add(user, NO_ACTOR)
        else:
            user.password_hash = password_hash
            await self._repo.save(user, NO_ACTOR)
        await self._repo.commit()  # the account survives an SMTP failure; the user can resend

        await self._send_code_unless_recent(user, VERIFY_EMAIL)
        return email

    async def verify_email(self, raw_email: str, code: str) -> IssuedSession:
        user = await self._user_for_code(raw_email)
        if user is not None and user.is_verified:
            raise errors.already_verified()
        await self._consume_code(user, VERIFY_EMAIL, code)

        assert user is not None
        now = self._clock.now()
        user.is_verified = True
        user.verified_at = now
        await self._repo.save(user, NO_ACTOR)
        session = await self._issue_session(user, now)
        await self._repo.commit()
        return session

    async def resend_verification(self, raw_email: str) -> None:
        email = try_normalize_email(raw_email)
        user = await self._repo.get_user_by_email(email) if email else None
        if user is None:
            return  # no enumeration: unknown emails look like a successful resend
        if user.is_verified:
            raise errors.already_verified()
        wait = await self._seconds_until_resend(user.id, VERIFY_EMAIL)
        if wait > 0:
            raise errors.resend_too_soon(wait)
        await self._send_code(user, VERIFY_EMAIL)

    # ── sessions ─────────────────────────────────────────────────────────────

    async def login(self, raw_email: str, password: str) -> IssuedSession:
        email = try_normalize_email(raw_email)
        user = await self._repo.get_user_by_email(email) if email else None
        if user is None:
            await _verify_password(password, _dummy_hash())
            raise errors.invalid_credentials()
        if not await _verify_password(password, user.password_hash):
            raise errors.invalid_credentials()
        if not user.is_verified:
            email = user.email
            try:
                await self._send_code_unless_recent(user, VERIFY_EMAIL)
            except AppError:
                pass  # a failed send still answers 403; the Verify screen can resend
            raise errors.email_not_verified(email)

        session = await self._issue_session(user, self._clock.now())
        await self._repo.commit()
        return session

    async def refresh(self, refresh_token: str) -> IssuedSession:
        now = self._clock.now()
        row = await self._repo.get_refresh_token(security.hash_token(refresh_token))
        if row is None or row.revoked_at is not None or row.expires_at <= now:
            raise errors.invalid_refresh_token()
        user = await self._repo.get_user_by_id(row.user_id)
        if user is None:
            raise errors.invalid_refresh_token()

        row.revoked_at = now
        await self._repo.save(row, NO_ACTOR)
        session = await self._issue_session(user, now)
        await self._repo.commit()
        return session

    async def logout(self, refresh_token: str) -> None:
        """Idempotent: unknown or already-revoked tokens are fine."""
        row = await self._repo.get_refresh_token(security.hash_token(refresh_token))
        if row is not None and row.revoked_at is None:
            row.revoked_at = self._clock.now()
            await self._repo.save(row, NO_ACTOR)
            await self._repo.commit()

    async def current_user(self, user_id: uuid.UUID) -> User:
        user = await self._repo.get_user_by_id(user_id)
        if user is None:
            raise errors.invalid_token()
        return user

    # ── password reset ───────────────────────────────────────────────────────

    async def forgot_password(self, raw_email: str) -> None:
        """Same outcome for known and unknown emails; only known ones get a code (at most one per 60 s)."""
        email = normalize_email(raw_email)
        user = await self._repo.get_user_by_email(email)
        if user is not None:
            await self._send_code_unless_recent(user, RESET_PASSWORD)

    async def verify_reset_code(self, raw_email: str, code: str) -> IssuedResetToken:
        user = await self._user_for_code(raw_email)
        await self._consume_code(user, RESET_PASSWORD, code)

        assert user is not None
        token = security.generate_token()
        reset = PasswordResetToken(
            user_id=user.id,
            token_hash=security.hash_token(token),
            expires_at=self._clock.now() + RESET_TOKEN_TTL,
        )
        await self._repo.add(reset, NO_ACTOR)
        await self._repo.commit()
        return IssuedResetToken(reset_token=token, expires_in=int(RESET_TOKEN_TTL.total_seconds()))

    async def reset_password(self, reset_token: str, new_password: str) -> None:
        check_password(new_password)  # a policy failure leaves the token usable
        now = self._clock.now()
        row = await self._repo.get_reset_token(security.hash_token(reset_token))
        if row is None or row.used_at is not None or row.expires_at <= now:
            raise errors.invalid_reset_token()
        user = await self._repo.get_user_by_id(row.user_id)
        if user is None:
            raise errors.invalid_reset_token()

        user.password_hash = await _hash_password(new_password)
        if not user.is_verified:
            user.is_verified = True
            user.verified_at = now
        await self._repo.save(user, NO_ACTOR)
        row.used_at = now
        await self._repo.save(row, NO_ACTOR)
        await self._repo.revoke_all_refresh_tokens(user.id, now, NO_ACTOR)
        await self._repo.commit()

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _user_for_code(self, raw_email: str) -> User | None:
        email = try_normalize_email(raw_email)
        return await self._repo.get_user_by_email(email) if email else None

    async def _consume_code(self, user: User | None, purpose: CodePurpose, code: str) -> None:
        """Shared code rules: 3 wrong attempts lock the code, 10 min expiry, single use. Raises on failure."""
        row = await self._repo.get_code(user.id, purpose) if user is not None else None
        if row is None or row.consumed_at is not None:
            raise errors.code_invalid(MAX_CODE_ATTEMPTS - 1)
        if row.failed_attempts >= MAX_CODE_ATTEMPTS:
            raise errors.code_locked()
        now = self._clock.now()
        if row.expires_at <= now:
            raise errors.code_expired()
        if not security.code_matches(code.strip(), row.code_hash, self._config.code_hash_secret):
            row.failed_attempts += 1
            await self._repo.save(row, NO_ACTOR)
            await self._repo.commit()
            if row.failed_attempts >= MAX_CODE_ATTEMPTS:
                raise errors.code_locked()
            raise errors.code_invalid(MAX_CODE_ATTEMPTS - row.failed_attempts)
        row.consumed_at = now
        await self._repo.save(row, NO_ACTOR)

    async def _seconds_until_resend(self, user_id: uuid.UUID, purpose: CodePurpose) -> int:
        row = await self._repo.get_code(user_id, purpose)
        if row is None:
            return 0
        remaining = (row.sent_at + RESEND_INTERVAL - self._clock.now()).total_seconds()
        return max(0, math.ceil(remaining))

    async def _send_code_unless_recent(self, user: User, purpose: CodePurpose) -> None:
        if await self._seconds_until_resend(user.id, purpose) == 0:
            await self._send_code(user, purpose)

    async def _send_code(self, user: User, purpose: CodePurpose) -> None:
        """Write a fresh code (replacing the old one) and email it; nothing is saved if sending fails."""
        code = security.generate_code()
        now = self._clock.now()
        code_hash = security.hash_code(code, self._config.code_hash_secret)
        row = await self._repo.get_code(user.id, purpose)
        if row is None:
            row = EmailCode(
                user_id=user.id, purpose=purpose, code_hash=code_hash, expires_at=now + CODE_TTL, sent_at=now
            )
            await self._repo.add(row, NO_ACTOR)
        else:
            row.code_hash = code_hash
            row.expires_at = now + CODE_TTL
            row.sent_at = now
            row.failed_attempts = 0
            row.consumed_at = None
            await self._repo.save(row, NO_ACTOR)

        message = CodeEmail(
            to=user.email,
            purpose=purpose,
            code=code,
            subject=EMAIL_SUBJECTS[purpose],
            body=EMAIL_BODIES[purpose].format(code=code),
        )
        try:
            await self._mailer.send_code(message)
        except EmailSendError as exc:
            await self._repo.rollback()
            raise errors.email_send_failed() from exc
        await self._repo.commit()

    async def _issue_session(self, user: User, now: datetime) -> IssuedSession:
        token = security.generate_token()
        await self._repo.add(
            RefreshToken(
                user_id=user.id,
                token_hash=security.hash_token(token),
                expires_at=now + self._config.refresh_token_ttl,
            ),
            NO_ACTOR,
        )
        access = security.create_access_token(user.id, now, self._config.access_token_ttl, self._config.jwt_secret)
        return IssuedSession(
            access_token=access,
            refresh_token=token,
            expires_in=int(self._config.access_token_ttl.total_seconds()),
            user=user,
        )
