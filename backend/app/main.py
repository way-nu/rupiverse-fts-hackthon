"""create_app(): settings check, logging, middleware, error handlers, routers. Nothing else."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import Settings, get_settings
from app.core.errors import install_error_handlers
from app.core.logging import setup_logging
from app.modules.auth.router import me_router
from app.modules.auth.router import router as auth_router
from app.modules.profile.router import router as profile_router


class UnsafeConfigError(RuntimeError):
    pass


def check_settings(settings: Settings) -> None:
    """Refuse to start with test-only switches on in production (Spec §8, AC13)."""
    if settings.test_outbox_enabled and settings.is_production:
        raise UnsafeConfigError("TEST_OUTBOX_ENABLED=true is not allowed with APP_ENV=production")


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    check_settings(settings)
    setup_logging()

    app = FastAPI(title="Rupiverse API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_methods=["GET", "POST", "PUT", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    install_error_handlers(app)

    @app.get("/")
    def read_root() -> dict[str, str]:
        return {"message": "Welcome to the Rupiverse API"}

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(auth_router)
    app.include_router(me_router)
    app.include_router(profile_router)
    if settings.test_outbox_enabled:
        from app.modules.outbox.router import router as outbox_router

        app.include_router(outbox_router)
    return app


app = create_app()
