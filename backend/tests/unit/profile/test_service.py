"""ProfileService rules (Spec §8) with a fake repository and a fake account reader: no DB, no HTTP."""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import pytest

from app.core.errors import AppError
from app.modules.profile.models import UserProfile
from app.modules.profile.repository import ProfileValues
from app.modules.profile.service import ProfileService, ProfileUpdateInput

USER = uuid.uuid4()
NOW = datetime(2026, 11, 6, 12, 0, tzinfo=UTC)
VALID: dict[str, Any] = {"full_name": "Venu Gopal", "age": 29, "gender": "male", "phone": "9876543210"}


@dataclass
class FakeAccount:
    email: str


class FakeAccounts:
    def __init__(self) -> None:
        self.users = {USER: FakeAccount("Venu@Example.com")}

    async def current_user(self, user_id: uuid.UUID) -> FakeAccount:
        if user_id not in self.users:
            raise AppError("invalid_token", 401, "Your session is not valid.")
        return self.users[user_id]


class FakeRepo:
    def __init__(self) -> None:
        self.rows: dict[uuid.UUID, UserProfile] = {}
        self.upserts: list[tuple[uuid.UUID, ProfileValues, uuid.UUID]] = []
        self.commits = 0

    async def commit(self) -> None:
        self.commits += 1

    async def get(self, user_id: uuid.UUID) -> UserProfile | None:
        return self.rows.get(user_id)

    async def upsert(self, user_id: uuid.UUID, values: ProfileValues, actor_id: uuid.UUID) -> UserProfile:
        self.upserts.append((user_id, values, actor_id))
        row = self.rows.get(user_id)
        if row is None:
            row = UserProfile(user_id=user_id, created_by=actor_id, created_at=NOW)
            self.rows[user_id] = row
        row.full_name, row.age, row.gender, row.phone = values.full_name, values.age, values.gender, values.phone
        row.updated_by = actor_id
        row.updated_at = NOW
        return row


@pytest.fixture
def repo() -> FakeRepo:
    return FakeRepo()


@pytest.fixture
def service(repo: FakeRepo) -> ProfileService:
    return ProfileService(repo, FakeAccounts())  # type: ignore[arg-type]


def update(**overrides: Any) -> ProfileUpdateInput:
    return ProfileUpdateInput(**{**VALID, **overrides})


async def bad_fields(service: ProfileService, **overrides: Any) -> list[str]:
    with pytest.raises(AppError) as exc:
        await service.update_profile(USER, update(**overrides))
    assert exc.value.code == "invalid_profile" and exc.value.status == 422
    assert exc.value.detail == "Some profile fields are not valid."
    fields: list[str] = exc.value.extra["fields"]
    return fields


# ── read ─────────────────────────────────────────────────────────────────────


async def test_get_without_row_is_empty_with_lowercased_email(service: ProfileService, repo: FakeRepo) -> None:
    profile = await service.get_profile(USER)
    assert profile.email == "venu@example.com"
    assert (profile.full_name, profile.age, profile.gender, profile.phone, profile.updated_at) == (None,) * 5
    assert repo.upserts == [] and repo.commits == 0


async def test_unknown_user_is_invalid_token_on_both(service: ProfileService, repo: FakeRepo) -> None:
    for call in (service.get_profile(uuid.uuid4()), service.update_profile(uuid.uuid4(), update())):
        with pytest.raises(AppError) as exc:
            await call
        assert exc.value.code == "invalid_token"
    assert repo.upserts == []


async def test_unknown_user_wins_over_bad_values(service: ProfileService) -> None:
    with pytest.raises(AppError) as exc:
        await service.update_profile(uuid.uuid4(), update(age=5))
    assert exc.value.code == "invalid_token"


# ── save ─────────────────────────────────────────────────────────────────────


async def test_save_stamps_actor_and_commits_once(service: ProfileService, repo: FakeRepo) -> None:
    profile = await service.update_profile(USER, update())
    assert (profile.full_name, profile.age, profile.gender, profile.phone) == tuple(VALID.values())
    assert profile.updated_at == NOW
    assert repo.upserts == [(USER, ProfileValues(**VALID), USER)]
    assert repo.commits == 1


async def test_all_null_save_is_written(service: ProfileService, repo: FakeRepo) -> None:
    profile = await service.update_profile(USER, update(full_name=None, age=None, gender=None, phone=None))
    assert repo.upserts[0][1] == ProfileValues(None, None, None, None)
    assert profile.updated_at == NOW


@pytest.mark.parametrize("key", ["full_name", "age", "gender", "phone"])
async def test_empty_string_becomes_null(service: ProfileService, repo: FakeRepo, key: str) -> None:
    await service.update_profile(USER, update(**{key: ""}))
    assert getattr(repo.upserts[0][1], key) is None


@pytest.mark.parametrize("blank", ["   ", "\t \n", "　"])
async def test_whitespace_only_name_becomes_null(service: ProfileService, repo: FakeRepo, blank: str) -> None:
    await service.update_profile(USER, update(full_name=blank))
    assert repo.upserts[0][1].full_name is None


# ── name ─────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("sent", "stored"),
    [("Abc", "Abc"), ("  Abc  ", "Abc"), ("x" * 80, "x" * 80), (" " + "é" * 80 + " ", "é" * 80), ("R2-D2", "R2-D2")],
)
async def test_name_accepted(service: ProfileService, repo: FakeRepo, sent: str, stored: str) -> None:
    await service.update_profile(USER, update(full_name=sent))
    assert repo.upserts[0][1].full_name == stored


@pytest.mark.parametrize("name", ["ab", "  ab  ", "x" * 81, "é" * 81])
async def test_name_rejected(service: ProfileService, repo: FakeRepo, name: str) -> None:
    assert await bad_fields(service, full_name=name) == ["full_name"]
    assert repo.upserts == []


# ── age ──────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("age", [18, 120])
async def test_age_accepted(service: ProfileService, repo: FakeRepo, age: int) -> None:
    await service.update_profile(USER, update(age=age))
    assert repo.upserts[0][1].age == age


@pytest.mark.parametrize("age", [17, 121, 0, -1, 10**20])
async def test_age_rejected(service: ProfileService, age: int) -> None:
    assert await bad_fields(service, age=age) == ["age"]


@pytest.mark.parametrize("age", [True, "29", " "])
async def test_age_of_another_type_is_rejected_even_past_the_schema(service: ProfileService, age: object) -> None:
    assert await bad_fields(service, age=age) == ["age"]


# ── gender ───────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("gender", ["male", "female", "other"])
async def test_gender_accepted(service: ProfileService, repo: FakeRepo, gender: str) -> None:
    await service.update_profile(USER, update(gender=gender))
    assert repo.upserts[0][1].gender == gender


@pytest.mark.parametrize("gender", ["Male", "FEMALE", " male", "unknown", " "])
async def test_gender_rejected(service: ProfileService, gender: str) -> None:
    assert await bad_fields(service, gender=gender) == ["gender"]


# ── phone ────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize("phone", ["0000000000", "1234567890", "9876543210"])
async def test_phone_accepted(service: ProfileService, repo: FakeRepo, phone: str) -> None:
    await service.update_profile(USER, update(phone=phone))
    assert repo.upserts[0][1].phone == phone


@pytest.mark.parametrize(
    "phone",
    [
        "987654321",
        "98765432101",
        "+919876543210",
        "98765 43210",
        "98765-43210",
        "98765abcde",
        "９８７６５４３２１０",
        "   ",
    ],
)
async def test_phone_rejected(service: ProfileService, phone: str) -> None:
    assert await bad_fields(service, phone=phone) == ["phone"]


async def test_phone_with_trailing_newline_is_rejected(service: ProfileService) -> None:
    assert await bad_fields(service, phone="9876543210\n") == ["phone"]


# ── several bad fields ───────────────────────────────────────────────────────


async def test_every_bad_field_is_listed_in_order(service: ProfileService, repo: FakeRepo) -> None:
    fields = await bad_fields(service, phone="123", gender="x", age=5, full_name="ab")
    assert fields == ["full_name", "age", "gender", "phone"]
    assert repo.upserts == [] and repo.commits == 0


async def test_only_bad_fields_are_listed(service: ProfileService) -> None:
    assert await bad_fields(service, phone="1", full_name="ab") == ["full_name", "phone"]
    assert await bad_fields(service, gender="M", age=200) == ["age", "gender"]


async def test_error_never_contains_the_values(service: ProfileService) -> None:
    with pytest.raises(AppError) as exc:
        await service.update_profile(USER, update(full_name="Zq", age=4321, gender="Zzgender", phone="55511"))
    text = repr(exc.value.body())
    for value in ("Zq", "4321", "Zzgender", "55511"):
        assert value not in text
