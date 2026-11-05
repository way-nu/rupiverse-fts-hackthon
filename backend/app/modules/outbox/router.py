"""TEST-ONLY: read the latest code sent to an address. Mounted only when TEST_OUTBOX_ENABLED=true outside production."""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from app.adapters.email.outbox import OUTBOX
from app.core.errors import AppError


class OutboxMessage(BaseModel):
    email: str
    purpose: str
    code: str
    sent_at: datetime


router = APIRouter(prefix="/test/outbox", tags=["test-only"])


@router.get("/latest", response_model=OutboxMessage)
async def latest(email: str, purpose: Literal["verify_email", "reset_password"] = "verify_email") -> OutboxMessage:
    entry = OUTBOX.latest(email.strip().lower(), purpose)
    if entry is None:
        raise AppError("not_found", 404, "Nothing has been sent to that address.")
    return OutboxMessage(email=entry.email, purpose=entry.purpose, code=entry.code, sent_at=entry.sent_at)
