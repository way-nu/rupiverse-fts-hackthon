"""In-memory fakes for the auth service's repository, mailer and clock (no DB, no network)."""

import uuid
from datetime import UTC, datetime, timedelta

from app.db.base import AuditMixin
from app.modules.auth.models import EmailCode, PasswordResetToken, RefreshToken, User
from app.modules.auth.ports import CodeEmail, EmailSendError


class FakeClock:
    def __init__(self) -> None:
        self.current = datetime(2026, 11, 5, 12, 0, tzinfo=UTC)

    def now(self) -> datetime:
        return self.current

    def advance(self, seconds: float) -> None:
        self.current += timedelta(seconds=seconds)


class FakeMailer:
    def __init__(self) -> None:
        self.sent: list[CodeEmail] = []
        self.fail = False

    async def send_code(self, email: CodeEmail) -> None:
        if self.fail:
            raise EmailSendError
        self.sent.append(email)


class FakeRepo:
    def __init__(self, clock: FakeClock) -> None:
        self.clock = clock
        self.rows: list[AuditMixin] = []
        self.commits = 0

    async def commit(self) -> None:
        self.commits += 1

    async def rollback(self) -> None:
        pass

    async def add(self, row: AuditMixin, actor_id: uuid.UUID | None) -> None:
        row.id = uuid.uuid4()
        row.created_at = row.updated_at = self.clock.now()
        row.created_by = row.updated_by = actor_id
        if isinstance(row, EmailCode):
            row.failed_attempts = row.failed_attempts or 0
        self.rows.append(row)

    async def save(self, row: AuditMixin, actor_id: uuid.UUID | None) -> None:
        row.updated_by = actor_id

    def _live(self, kind: type) -> list:  # type: ignore[type-arg]
        return [r for r in self.rows if isinstance(r, kind) and r.deleted_at is None]

    async def get_user_by_email(self, email: str) -> User | None:
        return next((u for u in self._live(User) if u.email == email), None)

    async def get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        return next((u for u in self._live(User) if u.id == user_id), None)

    async def get_code(self, user_id: uuid.UUID, purpose: str) -> EmailCode | None:
        return next((c for c in self._live(EmailCode) if c.user_id == user_id and c.purpose == purpose), None)

    async def get_refresh_token(self, token_hash: str) -> RefreshToken | None:
        return next((t for t in self._live(RefreshToken) if t.token_hash == token_hash), None)

    async def revoke_all_refresh_tokens(self, user_id: uuid.UUID, now: datetime, actor_id: uuid.UUID | None) -> None:
        for token in self._live(RefreshToken):
            if token.user_id == user_id and token.revoked_at is None:
                token.revoked_at = now

    async def get_reset_token(self, token_hash: str) -> PasswordResetToken | None:
        return next((t for t in self._live(PasswordResetToken) if t.token_hash == token_hash), None)
