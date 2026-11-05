import re
import uuid
from datetime import UTC, datetime, timedelta

import pytest

from app.core import security

KEY = "k" * 32
OTHER_KEY = "o" * 32


def test_code_is_six_zero_padded_digits() -> None:
    for _ in range(200):
        assert re.fullmatch(r"\d{6}", security.generate_code())


def test_code_hash_is_keyed() -> None:
    assert security.hash_code("012345", "a") != security.hash_code("012345", "b")
    assert security.code_matches("012345", security.hash_code("012345", "a"), "a")
    assert not security.code_matches("012346", security.hash_code("012345", "a"), "a")


def test_token_hash_is_sha256_hex() -> None:
    token = security.generate_token()
    assert re.fullmatch(r"[0-9a-f]{64}", security.hash_token(token))
    assert security.generate_token() != token


def test_bcrypt_round_trip() -> None:
    hashed = security.hash_password("Rupi@2026x")
    assert hashed.startswith("$2")
    assert security.verify_password("Rupi@2026x", hashed)
    assert not security.verify_password("Rupi@2026y", hashed)
    assert not security.verify_password("x" * 73, hashed)


def test_access_token_round_trip_and_lifetime() -> None:
    user_id = uuid.uuid4()
    now = datetime.now(UTC)
    token = security.create_access_token(user_id, now, timedelta(minutes=15), KEY)
    claims = security.decode_access_token(token, KEY)
    assert claims.user_id == user_id
    assert (claims.expires_at - claims.issued_at) == timedelta(minutes=15)


def test_access_token_expired_and_tampered() -> None:
    user_id = uuid.uuid4()
    old = datetime.now(UTC) - timedelta(hours=1)
    with pytest.raises(security.TokenExpiredError):
        security.decode_access_token(security.create_access_token(user_id, old, timedelta(minutes=15), KEY), KEY)
    good = security.create_access_token(user_id, datetime.now(UTC), timedelta(minutes=15), KEY)
    with pytest.raises(security.TokenInvalidError):
        security.decode_access_token(good, OTHER_KEY)
    with pytest.raises(security.TokenInvalidError):
        security.decode_access_token("not.a.jwt", KEY)
