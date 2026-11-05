"""What the auth module needs from the outside world. Adapters implement these; tests fake them."""

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from app.modules.auth.constants import CodePurpose


@dataclass(frozen=True)
class CodeEmail:
    to: str
    purpose: CodePurpose
    code: str
    subject: str
    body: str


class EmailSendError(Exception):
    """Raised by an EmailSender when the message could not be handed to the mail server."""


class EmailSender(Protocol):
    async def send_code(self, email: CodeEmail) -> None: ...


class Clock(Protocol):
    def now(self) -> datetime: ...
