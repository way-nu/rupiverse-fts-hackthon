"""HTTP only: parse -> call the service -> return a schema (Spec §8)."""

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Response, status

from app.core.deps import get_current_user_id
from app.modules.auth.constants import RESEND_INTERVAL_SECONDS
from app.modules.auth.deps import AuthServiceDep
from app.modules.auth.schemas import (
    EmailRequest,
    ErrorResponse,
    LoginRequest,
    RefreshRequest,
    ResendResponse,
    ResetCodeSentResponse,
    ResetCodeVerifyRequest,
    ResetPasswordRequest,
    ResetTokenResponse,
    SignupRequest,
    TokenPair,
    UserOut,
    VerificationSentResponse,
    VerifyRequest,
)
from app.modules.auth.service import IssuedSession


def _errors(*codes: int) -> dict[int | str, dict[str, Any]]:
    return {code: {"model": ErrorResponse} for code in codes}


def _token_pair(session: IssuedSession) -> TokenPair:
    return TokenPair(
        access_token=session.access_token,
        refresh_token=session.refresh_token,
        expires_in=session.expires_in,
        user=UserOut.model_validate(session.user),
    )


router = APIRouter(prefix="/auth", tags=["auth"])
me_router = APIRouter(tags=["auth"])


@router.post(
    "/signup",
    status_code=status.HTTP_201_CREATED,
    response_model=VerificationSentResponse,
    responses=_errors(409, 422, 502),
)
async def signup(body: SignupRequest, service: AuthServiceDep) -> VerificationSentResponse:
    email = await service.signup(body.email, body.password)
    return VerificationSentResponse(email=email)


@router.post("/verify", response_model=TokenPair, responses=_errors(400, 409, 422))
async def verify(body: VerifyRequest, service: AuthServiceDep) -> TokenPair:
    return _token_pair(await service.verify_email(body.email, body.code))


@router.post(
    "/resend",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=ResendResponse,
    responses=_errors(409, 422, 429, 502),
)
async def resend(body: EmailRequest, service: AuthServiceDep) -> ResendResponse:
    await service.resend_verification(body.email)
    return ResendResponse(retry_after_seconds=RESEND_INTERVAL_SECONDS)


@router.post("/login", response_model=TokenPair, responses=_errors(401, 403, 422))
async def login(body: LoginRequest, service: AuthServiceDep) -> TokenPair:
    return _token_pair(await service.login(body.email, body.password))


@router.post("/refresh", response_model=TokenPair, responses=_errors(401, 422))
async def refresh(body: RefreshRequest, service: AuthServiceDep) -> TokenPair:
    return _token_pair(await service.refresh(body.refresh_token))


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, responses=_errors(422))
async def logout(body: RefreshRequest, service: AuthServiceDep) -> Response:
    await service.logout(body.refresh_token)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/password/forgot",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=ResetCodeSentResponse,
    responses=_errors(422, 502),
)
async def forgot_password(body: EmailRequest, service: AuthServiceDep) -> ResetCodeSentResponse:
    await service.forgot_password(body.email)
    return ResetCodeSentResponse(retry_after_seconds=RESEND_INTERVAL_SECONDS)


@router.post("/password/verify-code", response_model=ResetTokenResponse, responses=_errors(400, 422))
async def verify_reset_code(body: ResetCodeVerifyRequest, service: AuthServiceDep) -> ResetTokenResponse:
    issued = await service.verify_reset_code(body.email, body.code)
    return ResetTokenResponse(reset_token=issued.reset_token, expires_in=issued.expires_in)


@router.post(
    "/password/reset", status_code=status.HTTP_204_NO_CONTENT, response_class=Response, responses=_errors(400, 422)
)
async def reset_password(body: ResetPasswordRequest, service: AuthServiceDep) -> Response:
    await service.reset_password(body.reset_token, body.new_password)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@me_router.get("/me", response_model=UserOut, responses=_errors(401))
async def me(user_id: Annotated[uuid.UUID, Depends(get_current_user_id)], service: AuthServiceDep) -> UserOut:
    return UserOut.model_validate(await service.current_user(user_id))
