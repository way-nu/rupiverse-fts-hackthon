"""AppError and the global handlers: every error leaves as {"error": "<code>", "detail": "<text>", ...extras}."""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    """A business error with a stable code. Extra keyword fields are sent at the top level of the body."""

    def __init__(self, code: str, status: int, detail: str, **extra: Any) -> None:
        super().__init__(code)
        self.code = code
        self.status = status
        self.detail = detail
        self.extra = extra

    def body(self) -> dict[str, Any]:
        return {"error": self.code, "detail": self.detail, **self.extra}


def error_response(code: str, status: int, detail: str, **extra: Any) -> JSONResponse:
    return JSONResponse(status_code=status, content={"error": code, "detail": detail, **extra})


async def _app_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    return JSONResponse(status_code=exc.status, content=exc.body())


async def _validation_error(_: Request, exc: Exception) -> JSONResponse:
    """Request-body problems. Never echoes the submitted values (they may be passwords)."""
    assert isinstance(exc, RequestValidationError)
    fields = sorted({str(err["loc"][-1]) for err in exc.errors() if err.get("loc") and len(err["loc"]) > 1})
    return error_response(
        "invalid_request", 422, "The request body is missing fields or has the wrong types.", fields=fields
    )


async def _http_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    code = {404: "not_found", 405: "method_not_allowed"}.get(exc.status_code, "http_error")
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": code, "detail": str(exc.detail)},
        headers=exc.headers,
    )


async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled error: %s", type(exc).__name__)
    return error_response("internal_error", 500, "Something went wrong.")


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error)
    app.add_exception_handler(RequestValidationError, _validation_error)
    app.add_exception_handler(StarletteHTTPException, _http_error)
    app.add_exception_handler(Exception, _unhandled)
