"""Gmail SMTP sender (STARTTLS + app password). Runs the blocking smtplib call in a worker thread."""

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.modules.auth.ports import CodeEmail, EmailSendError

logger = logging.getLogger(__name__)

SMTP_TIMEOUT_SECONDS = 15


class SmtpEmailSender:
    def __init__(self, host: str, port: int, user: str, password: str, sender: str) -> None:
        self._host = host
        self._port = port
        self._user = user
        self._password = password
        self._sender = sender or user

    async def send_code(self, email: CodeEmail) -> None:
        message = EmailMessage()
        message["From"] = self._sender
        message["To"] = email.to
        message["Subject"] = email.subject
        message.set_content(email.body)
        try:
            await asyncio.to_thread(self._send, message)
        except (OSError, smtplib.SMTPException) as exc:
            logger.warning("SMTP send failed (%s, purpose=%s)", type(exc).__name__, email.purpose)
            raise EmailSendError from exc

    def _send(self, message: EmailMessage) -> None:
        with smtplib.SMTP(self._host, self._port, timeout=SMTP_TIMEOUT_SECONDS) as smtp:
            smtp.starttls()
            if self._user:
                smtp.login(self._user, self._password)
            smtp.send_message(message)
