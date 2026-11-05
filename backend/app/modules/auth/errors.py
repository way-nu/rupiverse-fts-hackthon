"""Auth error codes (Spec §8). Detail text is for humans; the code and extra fields are the contract."""

from app.core.errors import AppError


def invalid_email() -> AppError:
    return AppError("invalid_email", 422, "Enter a valid email address.")


def password_too_short() -> AppError:
    return AppError("password_too_short", 422, "Password must be at least 8 bytes.")


def password_too_long() -> AppError:
    return AppError("password_too_long", 422, "Password is too long (max 72 bytes).")


def password_too_weak(missing: list[str]) -> AppError:
    return AppError("password_too_weak", 422, "Password needs at least " + ", ".join(missing) + ".")


def email_taken() -> AppError:
    return AppError("email_taken", 409, "An account with this email already exists.")


def email_send_failed() -> AppError:
    return AppError("email_send_failed", 502, "We couldn't send the email. Try again shortly.")


def already_verified() -> AppError:
    return AppError("already_verified", 409, "This email is already verified.")


def code_invalid(attempts_remaining: int) -> AppError:
    return AppError("code_invalid", 400, "That code is not right.", attempts_remaining=attempts_remaining)


def code_locked() -> AppError:
    return AppError("code_locked", 400, "Too many wrong attempts. Request a new code.")


def code_expired() -> AppError:
    return AppError("code_expired", 400, "This code has expired. Request a new code.")


def resend_too_soon(retry_after_seconds: int) -> AppError:
    return AppError(
        "resend_too_soon", 429, "Wait before requesting another code.", retry_after_seconds=retry_after_seconds
    )


def invalid_credentials() -> AppError:
    return AppError("invalid_credentials", 401, "Wrong email or password.")


def email_not_verified(email: str) -> AppError:
    return AppError("email_not_verified", 403, "Verify your email to continue.", email=email)


def invalid_refresh_token() -> AppError:
    return AppError("invalid_refresh_token", 401, "Your session has ended. Log in again.")


def invalid_token() -> AppError:
    return AppError("invalid_token", 401, "Your session is not valid.")


def invalid_reset_token() -> AppError:
    return AppError("invalid_reset_token", 400, "This reset link has expired. Start again.")
