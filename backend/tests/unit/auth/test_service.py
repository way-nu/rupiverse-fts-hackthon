from datetime import timedelta
from typing import Any

import pytest

from app.core import security
from app.core.errors import AppError
from app.modules.auth.models import RefreshToken
from app.modules.auth.service import AuthConfig, AuthService
from tests.unit.auth.fakes import FakeClock, FakeMailer, FakeRepo

PASSWORD = "Rupi@2026x"
EMAIL = "someone@example.com"


@pytest.fixture
def env() -> tuple[AuthService, FakeRepo, FakeMailer, FakeClock]:
    clock = FakeClock()
    repo = FakeRepo(clock)
    mailer = FakeMailer()
    config = AuthConfig("j" * 32, "c" * 32, timedelta(minutes=15), timedelta(days=30))
    return AuthService(repo, mailer, clock, config), repo, mailer, clock  # type: ignore[arg-type]


async def raises(code: str, awaitable: Any) -> AppError:
    with pytest.raises(AppError) as info:
        await awaitable
    assert info.value.code == code, info.value.body()
    return info.value


async def test_signup_sends_one_code_and_stores_only_its_hash(env: Any) -> None:
    service, repo, mailer, _ = env
    assert await service.signup("  Someone@Example.com ", PASSWORD) == EMAIL
    assert len(mailer.sent) == 1 and mailer.sent[0].purpose == "verify_email"
    code = mailer.sent[0].code
    row = await repo.get_code((await repo.get_user_by_email(EMAIL)).id, "verify_email")
    assert row.code_hash != code and security.code_matches(code, row.code_hash, "c" * 32)


async def test_three_wrong_codes_lock_until_resend(env: Any) -> None:
    service, _, mailer, clock = env
    await service.signup(EMAIL, PASSWORD)
    code = mailer.sent[-1].code
    wrong = f"{(int(code) + 1) % 1_000_000:06d}"
    assert (await raises("code_invalid", service.verify_email(EMAIL, wrong))).extra == {"attempts_remaining": 2}
    assert (await raises("code_invalid", service.verify_email(EMAIL, wrong))).extra == {"attempts_remaining": 1}
    await raises("code_locked", service.verify_email(EMAIL, wrong))
    await raises("code_locked", service.verify_email(EMAIL, code))

    await raises("resend_too_soon", service.resend_verification(EMAIL))
    clock.advance(60)
    await service.resend_verification(EMAIL)
    session = await service.verify_email(EMAIL, mailer.sent[-1].code)
    assert session.user.is_verified and session.expires_in == 900


async def test_code_expires_after_ten_minutes(env: Any) -> None:
    service, _, mailer, clock = env
    await service.signup(EMAIL, PASSWORD)
    clock.advance(600)
    await raises("code_expired", service.verify_email(EMAIL, mailer.sent[-1].code))


async def test_resend_too_soon_reports_seconds_left(env: Any) -> None:
    service, _, _, clock = env
    await service.signup(EMAIL, PASSWORD)
    clock.advance(20.5)
    error = await raises("resend_too_soon", service.resend_verification(EMAIL))
    assert error.extra == {"retry_after_seconds": 40}


async def test_send_failure_is_502_and_saves_no_code(env: Any) -> None:
    service, repo, mailer, _ = env
    mailer.fail = True
    await raises("email_send_failed", service.signup(EMAIL, PASSWORD))
    assert await repo.get_user_by_email(EMAIL) is not None


async def test_login_unverified_is_403_and_wrong_password_401(env: Any) -> None:
    service, _, _, _ = env
    await service.signup(EMAIL, PASSWORD)
    assert (await raises("email_not_verified", service.login(EMAIL, PASSWORD))).extra == {"email": EMAIL}
    await raises("invalid_credentials", service.login(EMAIL, "Wrong@Pass1"))
    await raises("invalid_credentials", service.login("ghost@example.com", PASSWORD))


async def test_refresh_rotates_and_logout_is_idempotent(env: Any) -> None:
    service, _, mailer, _ = env
    await service.signup(EMAIL, PASSWORD)
    first = await service.verify_email(EMAIL, mailer.sent[-1].code)
    second = await service.refresh(first.refresh_token)
    await raises("invalid_refresh_token", service.refresh(first.refresh_token))
    await service.logout(second.refresh_token)
    await service.logout(second.refresh_token)
    await raises("invalid_refresh_token", service.refresh(second.refresh_token))


async def test_reset_flow_revokes_sessions_and_verifies(env: Any) -> None:
    service, repo, mailer, clock = env
    await service.signup(EMAIL, PASSWORD)
    await service.forgot_password(EMAIL)
    await service.forgot_password(EMAIL)  # within 60 s: nothing new
    assert [m.purpose for m in mailer.sent] == ["verify_email", "reset_password"]
    issued = await service.verify_reset_code(EMAIL, mailer.sent[-1].code)
    assert issued.expires_in == 600

    await raises("password_too_weak", service.reset_password(issued.reset_token, "weakpassword"))
    await service.reset_password(issued.reset_token, "Verse#2027y")
    await raises("invalid_reset_token", service.reset_password(issued.reset_token, "Verse#2027y"))
    user = await repo.get_user_by_email(EMAIL)
    assert user.is_verified and user.verified_at == clock.now()
    assert all(t.revoked_at is not None for t in repo.rows if isinstance(t, RefreshToken))
    assert (await service.login(EMAIL, "Verse#2027y")).user.id == user.id


async def test_forgot_unknown_email_sends_nothing(env: Any) -> None:
    service, _, mailer, _ = env
    await service.forgot_password("ghost@example.com")
    assert mailer.sent == []


async def test_by_columns_name_the_identified_user(env: Any) -> None:
    service, repo, mailer, _ = env
    await service.signup(EMAIL, PASSWORD)
    user = await repo.get_user_by_email(EMAIL)
    assert user.created_by is None and user.updated_by is None  # brand-new signup: nobody is acting yet
    session = await service.verify_email(EMAIL, mailer.sent[-1].code)
    assert user.updated_by == user.id
    await service.refresh(session.refresh_token)
    others = [r for r in repo.rows if r is not user]
    assert others and all(r.created_by == user.id and r.updated_by == user.id for r in others)
