"""Password hashing, JWT access tokens, one-time codes and opaque-token hashing."""

import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta

import bcrypt
import jwt

JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_TYPE = "access"
BCRYPT_ROUNDS = 12


# ── passwords ────────────────────────────────────────────────────────────────


def hash_password(password: str) -> str:
    """bcrypt. Callers validate the 72-byte limit first, so nothing is ever truncated."""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(BCRYPT_ROUNDS)).decode()


def verify_password(password: str, password_hash: str) -> bool:
    encoded = password.encode()
    if len(encoded) > 72:
        return False
    try:
        return bcrypt.checkpw(encoded, password_hash.encode())
    except ValueError:
        return False


# ── one-time codes and opaque tokens ─────────────────────────────────────────


def generate_code() -> str:
    """A 6-digit, zero-padded code from the CSPRNG."""
    return f"{secrets.randbelow(1_000_000):06d}"


def hash_code(code: str, secret: str) -> str:
    """Keyed HMAC-SHA256 (hex) so a leaked table can't be brute-forced without the secret."""
    return hmac.new(secret.encode(), code.encode(), hashlib.sha256).hexdigest()


def code_matches(code: str, code_hash: str, secret: str) -> bool:
    return hmac.compare_digest(hash_code(code, secret), code_hash)


def generate_token() -> str:
    """An opaque random token (refresh / reset), 256 bits."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """SHA-256 (hex) of an opaque token; the token itself is never stored."""
    return hashlib.sha256(token.encode()).hexdigest()


# ── JWT access tokens ────────────────────────────────────────────────────────


class TokenExpiredError(Exception):
    pass


class TokenInvalidError(Exception):
    pass


@dataclass(frozen=True)
class AccessClaims:
    user_id: uuid.UUID
    issued_at: datetime
    expires_at: datetime


def create_access_token(user_id: uuid.UUID, now: datetime, ttl: timedelta, secret: str) -> str:
    claims = {
        "sub": str(user_id),
        "type": ACCESS_TOKEN_TYPE,
        "iat": int(now.timestamp()),
        "exp": int((now + ttl).timestamp()),
    }
    return jwt.encode(claims, secret, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str, secret: str) -> AccessClaims:
    """Raises TokenExpiredError or TokenInvalidError; only `type: access` tokens pass."""
    try:
        claims = jwt.decode(
            token, secret, algorithms=[JWT_ALGORITHM], options={"require": ["sub", "type", "iat", "exp"]}
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenExpiredError from exc
    except jwt.PyJWTError as exc:
        raise TokenInvalidError from exc
    if claims.get("type") != ACCESS_TOKEN_TYPE:
        raise TokenInvalidError
    try:
        user_id = uuid.UUID(str(claims["sub"]))
    except ValueError as exc:
        raise TokenInvalidError from exc
    return AccessClaims(
        user_id=user_id,
        issued_at=datetime.fromtimestamp(claims["iat"]).astimezone(),
        expires_at=datetime.fromtimestamp(claims["exp"]).astimezone(),
    )
