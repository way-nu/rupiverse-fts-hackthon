"""HTTP only: parse -> call the service -> return a schema (Spec §8)."""

import json
import uuid
from collections.abc import Callable, Coroutine
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request, Response
from fastapi.routing import APIRoute

from app.core.deps import get_current_user_id
from app.modules.auth.schemas import ErrorResponse
from app.modules.profile.deps import ProfileServiceDep
from app.modules.profile.schemas import ProfileOut, ProfileUpdate
from app.modules.profile.service import ProfileUpdateInput


class _JsonAfterAuthRequest(Request):
    """Malformed JSON parses as `null` instead of failing before the dependencies run. FastAPI decodes the body
    before resolving dependencies, so without this a bad body would beat a bad token; with it, the Bearer check
    runs first and the body then fails validation as `invalid_request` (Spec §8: auth is checked first)."""

    async def json(self) -> Any:
        try:
            return await super().json()
        except json.JSONDecodeError:
            return None


class _AuthFirstRoute(APIRoute):
    def get_route_handler(self) -> Callable[[Request], Coroutine[Any, Any, Response]]:
        handler = super().get_route_handler()

        async def route_handler(request: Request) -> Response:
            return await handler(_JsonAfterAuthRequest(request.scope, request.receive))

        return route_handler


def _errors(*codes: int) -> dict[int | str, dict[str, Any]]:
    return {code: {"model": ErrorResponse} for code in codes}


router = APIRouter(prefix="/profile", tags=["profile"], route_class=_AuthFirstRoute)

CurrentUserId = Annotated[uuid.UUID, Depends(get_current_user_id)]


@router.get("", response_model=ProfileOut, responses=_errors(401))
async def get_profile(user_id: CurrentUserId, service: ProfileServiceDep) -> ProfileOut:
    return ProfileOut.model_validate(await service.get_profile(user_id))


@router.put("", response_model=ProfileOut, responses=_errors(401, 422))
async def update_profile(user_id: CurrentUserId, body: ProfileUpdate, service: ProfileServiceDep) -> ProfileOut:
    update = ProfileUpdateInput(full_name=body.full_name, age=body.age, gender=body.gender, phone=body.phone)
    return ProfileOut.model_validate(await service.update_profile(user_id, update))
