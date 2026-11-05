"""TEST-ONLY in-memory outbox. Replaces SMTP when TEST_OUTBOX_ENABLED=true; never used in production."""

from dataclasses import dataclass
from datetime import datetime

from app.modules.auth.ports import Clock, CodeEmail


@dataclass(frozen=True)
class OutboxEntry:
    email: str
    purpose: str
    code: str
    sent_at: datetime


class Outbox:
    """Latest message per (email, purpose), kept in process memory only."""

    def __init__(self) -> None:
        self._latest: dict[tuple[str, str], OutboxEntry] = {}

    def record(self, entry: OutboxEntry) -> None:
        self._latest[(entry.email, entry.purpose)] = entry

    def latest(self, email: str, purpose: str) -> OutboxEntry | None:
        return self._latest.get((email, purpose))


OUTBOX = Outbox()


class OutboxEmailSender:
    def __init__(self, outbox: Outbox, clock: Clock) -> None:
        self._outbox = outbox
        self._clock = clock

    async def send_code(self, email: CodeEmail) -> None:
        self._outbox.record(
            OutboxEntry(email=email.to, purpose=email.purpose, code=email.code, sent_at=self._clock.now())
        )
