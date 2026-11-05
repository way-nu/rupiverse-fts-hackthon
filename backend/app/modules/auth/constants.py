"""Auth rules and copy (Spec §5, §8)."""

from datetime import timedelta
from typing import Literal

CodePurpose = Literal["verify_email", "reset_password"]
VERIFY_EMAIL: CodePurpose = "verify_email"
RESET_PASSWORD: CodePurpose = "reset_password"

CODE_TTL = timedelta(minutes=10)
RESEND_INTERVAL = timedelta(seconds=60)
RESEND_INTERVAL_SECONDS = 60
MAX_CODE_ATTEMPTS = 3
RESET_TOKEN_TTL = timedelta(minutes=10)

PASSWORD_MIN_BYTES = 8
PASSWORD_MAX_BYTES = 72

EMAIL_SUBJECTS: dict[CodePurpose, str] = {
    VERIFY_EMAIL: "Your RupiVerse verification code",
    RESET_PASSWORD: "Your RupiVerse password reset code",
}
EMAIL_BODIES: dict[CodePurpose, str] = {
    VERIFY_EMAIL: (
        "Your RupiVerse verification code is {code}.\n\n"
        "Enter it in the app to confirm your email. It expires in 10 minutes.\n"
    ),
    RESET_PASSWORD: (
        "Your RupiVerse password reset code is {code}.\n\n"
        "Enter it in the app to set a new password. It expires in 10 minutes.\n\n"
        "If you didn't ask for this, ignore this email.\n"
    ),
}
