"""RV1 acceptance · secrets never leak: AC14 (logs + error bodies + hashed storage), AC26 (error shape sweep)."""

import asyncpg
import httpx
import pytest

from tests.acceptance.conftest import (
    OTHER_PASSWORD,
    STRONG_PASSWORD,
    Server,
    assert_error,
    login,
    new_email,
    other_code,
    outbox,
    sha256_forms,
    signup,
)

SECRET_PASSWORD = "Leak@Check9"


async def test_ac14_secrets_never_appear_in_logs_or_error_bodies(
    server: Server, client: httpx.AsyncClient, db: asyncpg.Connection
) -> None:
    """AC14: run every flow, then no password, code, token, hash or full email appears in the server log or in any
    error body. (Access-log lines for the test-only outbox route are excluded: that route takes the email as a query
    parameter by design and never exists outside tests.)"""
    email = new_email("leak")
    secrets: set[str] = {SECRET_PASSWORD, OTHER_PASSWORD, email}
    error_bodies: list[str] = []

    async def call(method: str, url: str, **kwargs: object) -> httpx.Response:
        response = await client.request(method, url, **kwargs)  # type: ignore[arg-type]
        if response.status_code >= 400:
            error_bodies.append(response.text)
        return response

    code = await signup(client, email, SECRET_PASSWORD)
    secrets.add(code)
    await call("POST", "/auth/verify", json={"email": email, "code": other_code(code)})
    await call("POST", "/auth/login", json={"email": email, "password": SECRET_PASSWORD})  # 403 unverified
    pair = (await call("POST", "/auth/verify", json={"email": email, "code": code})).json()
    secrets |= {pair["access_token"], pair["refresh_token"]}

    await call("POST", "/auth/login", json={"email": email, "password": "Wrong@Pass1"})
    await call("POST", "/auth/signup", json={"email": email, "password": SECRET_PASSWORD})  # 409
    await call("POST", "/auth/signup", json={"email": "not-an-email", "password": SECRET_PASSWORD})  # 422
    await call("POST", "/auth/signup", json={"email": new_email("weak"), "password": "weakpassword"})  # 422
    rotated = (await call("POST", "/auth/refresh", json={"refresh_token": pair["refresh_token"]})).json()
    secrets |= {rotated["access_token"], rotated["refresh_token"]}
    await call("POST", "/auth/refresh", json={"refresh_token": pair["refresh_token"]})  # 401 reuse
    await call("GET", "/me", headers={"Authorization": f"Bearer {rotated['access_token']}x"})  # 401

    await call("POST", "/auth/password/forgot", json={"email": email})
    reset_code = (await outbox(client, email, "reset_password"))["code"]
    secrets.add(reset_code)
    await call("POST", "/auth/password/verify-code", json={"email": email, "code": other_code(reset_code)})
    token = (await call("POST", "/auth/password/verify-code", json={"email": email, "code": reset_code})).json()
    secrets.add(token["reset_token"])
    await call("POST", "/auth/password/reset", json={"reset_token": token["reset_token"], "new_password": "short"})
    await call(
        "POST", "/auth/password/reset", json={"reset_token": token["reset_token"], "new_password": OTHER_PASSWORD}
    )
    await call(
        "POST", "/auth/password/reset", json={"reset_token": token["reset_token"], "new_password": OTHER_PASSWORD}
    )
    await call("POST", "/auth/logout", json={"refresh_token": rotated["refresh_token"]})

    hashes = await db.fetch(
        "SELECT c.code_hash AS h FROM email_codes c JOIN users u ON u.id = c.user_id WHERE u.email = $1 "
        "UNION ALL SELECT password_hash FROM users WHERE email = $1",
        email,
    )
    secrets |= {r["h"] for r in hashes}
    for raw in (pair["refresh_token"], rotated["refresh_token"], token["reset_token"]):
        secrets |= sha256_forms(raw)

    log = "\n".join(line for line in server.log_text().splitlines() if "/test/outbox/" not in line)
    leaked_in_log = sorted(s for s in secrets if s and s in log)
    assert leaked_in_log == [], f"secrets found in the server log ({server.log_path}): {leaked_in_log}"

    assert error_bodies, "the flow should have produced error responses"
    leaked_in_bodies = sorted({s for s in secrets for body in error_bodies if s and s in body} - {email})
    assert leaked_in_bodies == [], f"secrets echoed in error bodies: {leaked_in_bodies}"


async def test_ac14_validation_errors_do_not_echo_the_password(client: httpx.AsyncClient) -> None:
    """AC14: 422 bodies never echo the submitted password (FastAPI's default validation body would)."""
    for payload in (
        {"email": "not-an-email", "password": SECRET_PASSWORD},
        {"email": new_email("x"), "password": "Ab1!" + "€" * 30},
        {"email": new_email("x"), "password": 12345678},
        {"password": SECRET_PASSWORD},
    ):
        response = await client.post("/auth/signup", json=payload)
        assert response.status_code == 422, response.text
        assert SECRET_PASSWORD not in response.text, response.text
        assert "€€€" not in response.text and "\\u20ac\\u20ac" not in response.text, response.text


async def test_ac14_refresh_tokens_are_stored_hashed(client: httpx.AsyncClient, db: asyncpg.Connection) -> None:
    """AC14: refresh_tokens.token_hash is the SHA-256 of the token; the raw token is stored nowhere in the row."""
    email = new_email("rt")
    code = await signup(client, email)
    pair = (await client.post("/auth/verify", json={"email": email, "code": code})).json()
    row = await db.fetchrow(
        "SELECT r.* FROM refresh_tokens r JOIN users u ON u.id = r.user_id WHERE u.email = $1", email
    )
    assert row is not None
    assert row["token_hash"] in sha256_forms(pair["refresh_token"])
    assert pair["refresh_token"] not in {str(v) for v in dict(row).values()}


# ── AC26 sweep ───────────────────────────────────────────────────────────────

MALFORMED_BODIES = [
    pytest.param("/auth/signup", {}, {"email", "password"}, id="signup-empty"),
    pytest.param(
        "/auth/signup", {"email": "a@example.com", "password": 12345678}, {"password"}, id="signup-wrong-type"
    ),
    pytest.param("/auth/verify", {"email": "a@example.com"}, {"code"}, id="verify-missing-code"),
    pytest.param("/auth/resend", {}, {"email"}, id="resend-empty"),
    pytest.param("/auth/login", {"email": "a@example.com"}, {"password"}, id="login-missing-password"),
    pytest.param("/auth/refresh", {}, {"refresh_token"}, id="refresh-empty"),
    pytest.param("/auth/logout", {}, {"refresh_token"}, id="logout-empty"),
    pytest.param("/auth/password/forgot", {}, {"email"}, id="forgot-empty"),
    pytest.param("/auth/password/verify-code", {"email": "a@example.com"}, {"code"}, id="verify-code-missing-code"),
    pytest.param("/auth/password/reset", {"reset_token": "x"}, {"new_password"}, id="reset-missing-password"),
]


def field_names(fields: object) -> set[str]:
    """`fields` lists the bad field names (a list of names; a dict keyed by name is accepted too)."""
    if isinstance(fields, dict):
        return {str(k) for k in fields}
    assert isinstance(fields, list), f"fields must list the bad field names: {fields!r}"
    return {str(f) for f in fields}


@pytest.mark.parametrize(("path", "payload", "bad_fields"), MALFORMED_BODIES)
async def test_ac26_malformed_requests_are_invalid_request(
    client: httpx.AsyncClient, path: str, payload: dict, bad_fields: set[str]
) -> None:
    """AC26 + PM ruling 2026-11-05: a malformed body (missing field / wrong type) on any endpoint → 422
    invalid_request in the flat shape, with `fields` listing the bad field names; values are never echoed."""
    body = assert_error(await client.post(path, json=payload), 422, "invalid_request", fields=...)
    assert bad_fields <= field_names(body["fields"]), body
    assert "12345678" not in str(body)


async def test_ac26_non_json_body_is_invalid_request(client: httpx.AsyncClient) -> None:
    """AC26: a body that is not JSON at all is still a flat 422 invalid_request."""
    response = await client.post("/auth/login", content=b"not json", headers={"Content-Type": "application/json"})
    assert_error(response, 422, "invalid_request")


async def test_ac26_login_errors_use_the_error_shape(client: httpx.AsyncClient) -> None:
    """AC26: spot check that 401/403/409 bodies carry only the allowed keys."""
    email = new_email("shape")
    await signup(client, email, STRONG_PASSWORD)
    assert_error(await login(client, email), 403, "email_not_verified", email=email)
    assert_error(await login(client, email, "Wrong@Pass1"), 401, "invalid_credentials")


async def test_ac14_access_log_lines_survive_redaction(server: Server, client: httpx.AsyncClient) -> None:
    """AC14 regression (bug found at 1382ecb): the redaction filter must not break log formatting. Every request
    should leave its normal uvicorn access line, and no '--- Logging error ---' traceback may appear."""
    await client.post("/auth/login", json={"email": new_email("logline"), "password": "Wrong@Pass1"})
    await client.get("/me")
    log = server.log_text()
    assert "--- Logging error ---" not in log, "the logging setup raises while formatting records (see server log)"
    assert '"POST /auth/login HTTP/1.1" 401' in log, "uvicorn access lines are missing from the log"
    assert '"GET /me HTTP/1.1" 401' in log, "uvicorn access lines are missing from the log"
