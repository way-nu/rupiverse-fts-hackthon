"""Pure input rules: email normalisation and the password policy (Spec §5)."""

from email_validator import EmailNotValidError, validate_email

from app.modules.auth import errors
from app.modules.auth.constants import PASSWORD_MAX_BYTES, PASSWORD_MIN_BYTES


def normalize_email(raw: str) -> str:
    """Trim + lowercase, then check the format. Raises invalid_email."""
    email = raw.strip().lower()
    if not email or len(email) > 254:
        raise errors.invalid_email()
    try:
        validate_email(email, check_deliverability=False)
    except EmailNotValidError as exc:
        raise errors.invalid_email() from exc
    return email


def try_normalize_email(raw: str) -> str | None:
    """Like normalize_email, but None for a malformed address (for endpoints that must not reveal anything)."""
    try:
        return normalize_email(raw)
    except Exception:
        return None


def missing_password_rules(password: str) -> list[str]:
    missing = []
    if not any(ch.isupper() for ch in password):
        missing.append("one uppercase letter")
    if not any(ch.islower() for ch in password):
        missing.append("one lowercase letter")
    if not any(ch.isdigit() for ch in password):
        missing.append("one number")
    if not any(not ch.isalnum() for ch in password):
        missing.append("one special character")
    return missing


def check_password(password: str) -> None:
    """8–72 bytes of UTF-8 (never truncated) with upper, lower, digit and special. Raises the matching error."""
    size = len(password.encode())
    if size < PASSWORD_MIN_BYTES:
        raise errors.password_too_short()
    if size > PASSWORD_MAX_BYTES:
        raise errors.password_too_long()
    missing = missing_password_rules(password)
    if missing:
        raise errors.password_too_weak(missing)
