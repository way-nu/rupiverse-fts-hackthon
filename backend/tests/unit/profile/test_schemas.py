"""ProfileUpdate / ProfileOut shapes (Spec §8): strict JSON types, unknown keys rejected, updated_at ends in Z."""

from datetime import datetime, timedelta, timezone
from typing import Any

import pytest
from pydantic import ValidationError

from app.modules.profile.schemas import ProfileOut, ProfileUpdate

VALID: dict[str, Any] = {"full_name": "Venu Gopal", "age": 29, "gender": "male", "phone": "9876543210"}


def error_keys(payload: object) -> list[str]:
    with pytest.raises(ValidationError) as exc:
        ProfileUpdate.model_validate(payload)
    return sorted({str(e["loc"][-1]) for e in exc.value.errors() if e["loc"]})


@pytest.mark.parametrize("age", [29, "", None, 0, 10**6])
def test_age_accepts_int_empty_or_null(age: object) -> None:
    assert ProfileUpdate.model_validate({**VALID, "age": age}).age == age


@pytest.mark.parametrize("age", ["29", 29.0, 29.5, True, False, [29], {"v": 29}, " "])
def test_age_wrong_types_name_only_age(age: object) -> None:
    assert error_keys({**VALID, "age": age}) == ["age"]


@pytest.mark.parametrize("key", ["full_name", "gender", "phone"])
@pytest.mark.parametrize("value", [12345, True, ["x"], {"x": 1}, 1.5])
def test_string_fields_reject_other_types(key: str, value: object) -> None:
    assert error_keys({**VALID, key: value}) == [key]


@pytest.mark.parametrize("key", ["full_name", "age", "gender", "phone"])
def test_every_key_is_required(key: str) -> None:
    assert error_keys({k: v for k, v in VALID.items() if k != key}) == [key]


@pytest.mark.parametrize("extra", ["user_id", "email", "updated_at"])
def test_unknown_keys_are_rejected(extra: str) -> None:
    assert error_keys({**VALID, extra: "x"}) == [extra]


@pytest.mark.parametrize("payload", [[], "Venu", None, 5])
def test_non_object_is_rejected(payload: object) -> None:
    error_keys(payload)


def test_updated_at_is_utc_with_z() -> None:
    ist = timezone(timedelta(hours=5, minutes=30))
    out = ProfileOut(
        email="a@b.co",
        full_name=None,
        age=None,
        gender=None,
        phone=None,
        updated_at=datetime(2026, 11, 6, 17, 30, 0, 123456, tzinfo=ist),
    )
    assert out.model_dump(mode="json")["updated_at"] == "2026-11-06T12:00:00.123456Z"
    out = ProfileOut(email="a@b.co", full_name=None, age=None, gender=None, phone=None, updated_at=None)
    assert out.model_dump(mode="json")["updated_at"] is None
