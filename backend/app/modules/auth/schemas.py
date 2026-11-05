"""Request and response models for /auth and /me (Spec §8). These names feed the frontend's generated types."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class SignupRequest(BaseModel):
    email: str
    password: str


class VerifyRequest(BaseModel):
    email: str
    code: str


class EmailRequest(BaseModel):
    email: str


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ResetCodeVerifyRequest(BaseModel):
    email: str
    code: str


class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str


class VerificationSentResponse(BaseModel):
    status: Literal["verification_sent"] = "verification_sent"
    email: str


class ResendResponse(BaseModel):
    status: Literal["verification_sent"] = "verification_sent"
    retry_after_seconds: int


class ResetCodeSentResponse(BaseModel):
    status: Literal["reset_code_sent"] = "reset_code_sent"
    retry_after_seconds: int


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: str
    is_verified: bool
    created_at: datetime


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    expires_in: int
    user: UserOut


class ResetTokenResponse(BaseModel):
    reset_token: str
    expires_in: int


class ErrorResponse(BaseModel):
    """Every error body. Extra fields (attempts_remaining, retry_after_seconds, email, fields) appear where listed."""

    error: str
    detail: str
    attempts_remaining: int | None = None
    retry_after_seconds: int | None = None
    email: str | None = None
    fields: list[str] | None = None
