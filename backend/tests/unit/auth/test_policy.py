import pytest

from app.core.errors import AppError
from app.modules.auth.policy import check_password, normalize_email, try_normalize_email


@pytest.mark.parametrize(
    ("password", "code"),
    [
        ("Ab1!xyz", "password_too_short"),  # 7 bytes
        ("Ab1!" + "x" * 69, "password_too_long"),  # 73 bytes
        ("Ab1!" + "€" * 23, "password_too_long"),  # 27 chars, 73 bytes
        ("ab1!abcd", "password_too_weak"),
        ("AB1!ABCD", "password_too_weak"),
        ("Abc!abcd", "password_too_weak"),
        ("Abc1abcd", "password_too_weak"),
    ],
)
def test_password_policy_rejects(password: str, code: str) -> None:
    with pytest.raises(AppError) as info:
        check_password(password)
    assert info.value.code == code


@pytest.mark.parametrize("password", ["Ab1!xyzw", "Ab1!" + "x" * 68, "Ab1!" + "€" * 22 + "xx"])
def test_password_policy_accepts_8_and_72_bytes(password: str) -> None:
    check_password(password)


def test_too_weak_detail_names_every_missing_rule() -> None:
    with pytest.raises(AppError) as info:
        check_password("abcdefgh")
    assert "uppercase" in info.value.detail and "number" in info.value.detail and "special" in info.value.detail


def test_email_is_trimmed_and_lowercased() -> None:
    assert normalize_email("  Someone@Example.COM ") == "someone@example.com"


@pytest.mark.parametrize("raw", ["", "not-an-email", "a@", "@example.com", "a b@example.com", "x" * 250 + "@a.io"])
def test_bad_emails_are_rejected(raw: str) -> None:
    with pytest.raises(AppError) as info:
        normalize_email(raw)
    assert info.value.code == "invalid_email"
    assert try_normalize_email(raw) is None
