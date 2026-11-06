"""Profile error codes (Spec §8). `fields` names keys only; submitted values are never echoed."""

from app.core.errors import AppError


def invalid_profile(fields: list[str]) -> AppError:
    return AppError("invalid_profile", 422, "Some profile fields are not valid.", fields=fields)
