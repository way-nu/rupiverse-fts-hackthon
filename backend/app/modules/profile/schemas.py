"""Request and response models for /profile (Spec §8). These names feed the frontend's generated types."""

from datetime import UTC, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, PlainSerializer, PlainValidator, WithJsonSchema


def _age_input(value: object) -> int | str | None:
    """A JSON integer, "" or null. `"29"`, `29.0`, `29.5` and `true` are wrong types (invalid_request)."""
    if value is None or value == "" or (isinstance(value, int) and not isinstance(value, bool)):
        return value
    raise ValueError("age must be an integer, an empty string or null")


def _utc_z(value: datetime) -> str:
    return value.astimezone(UTC).isoformat().replace("+00:00", "Z")


AgeInput = Annotated[
    int | Literal[""] | None,
    PlainValidator(_age_input),
    WithJsonSchema({"anyOf": [{"type": "integer"}, {"type": "string", "const": ""}, {"type": "null"}]}),
]
UtcTimestamp = Annotated[datetime, PlainSerializer(_utc_z, return_type=str, when_used="json")]


class ProfileUpdate(BaseModel):
    """Full replace: exactly these four keys, all required; unknown keys and loose types are rejected."""

    model_config = ConfigDict(extra="forbid", strict=True)

    full_name: str | None
    age: AgeInput
    gender: str | None
    phone: str | None


class ProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    email: str
    full_name: str | None
    age: int | None
    gender: Literal["male", "female", "other"] | None
    phone: str | None
    updated_at: UtcTimestamp | None
