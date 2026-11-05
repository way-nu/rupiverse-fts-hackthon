"""RV1 acceptance · startup guard for signing secrets: AC30 (the app refuses to start if JWT_SECRET or CODE_HASH_SECRET
is empty)."""

import socket
import subprocess
import sys
import time

import httpx
import pytest

from tests.acceptance.conftest import BACKEND_DIR, CODE_HASH_SECRET, HOST, JWT_SECRET, server_env


def _free_port() -> int:
    with socket.socket() as sock:
        sock.bind((HOST, 0))
        return sock.getsockname()[1]


def _start(env: dict[str, str]) -> tuple[bool, int | None, str]:
    """Start uvicorn on a free port; returns (served, exit code or None, output)."""
    port = _free_port()
    process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", HOST, "--port", str(port)],
        cwd=BACKEND_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )
    served = False
    deadline = time.monotonic() + 30
    try:
        while time.monotonic() < deadline and process.poll() is None:
            try:
                httpx.get(f"http://{HOST}:{port}/openapi.json", timeout=0.5)
                served = True
                break
            except httpx.TransportError:
                time.sleep(0.2)
    finally:
        if process.poll() is None:
            process.kill()
        output = process.communicate(timeout=10)[0].decode(errors="replace")
    return served, process.returncode, output


@pytest.mark.parametrize("key", ["JWT_SECRET", "CODE_HASH_SECRET"])
@pytest.mark.parametrize("app_env", ["test", "production"])
def test_ac30_app_refuses_to_start_with_an_empty_secret(database_url: str, key: str, app_env: str) -> None:
    """AC30: an empty JWT_SECRET or CODE_HASH_SECRET → the app exits non-zero and never serves (in any APP_ENV)."""
    env = server_env(database_url, APP_ENV=app_env, TEST_OUTBOX_ENABLED="false", **{key: ""})
    served, code, output = _start(env)
    assert not served, f"the app served requests with an empty {key}"
    assert code not in (None, 0), f"expected a non-zero exit with an empty {key}, got {code}:\n{output}"
    assert key in output, f"AC30: the startup error must name {key}:\n{output[-2000:]}"
    leaked = [v for v in (JWT_SECRET, CODE_HASH_SECRET, env["SMTP_APP_PASSWORD"], env["DATABASE_URL"]) if v in output]
    assert leaked == [], f"AC30: secret values appear in the startup output: {leaked}"


def test_ac30_app_starts_when_both_secrets_are_set(database_url: str) -> None:
    """AC30 control: with both secrets set (and the outbox off) the same command serves normally."""
    served, _, output = _start(server_env(database_url, APP_ENV="test", TEST_OUTBOX_ENABLED="false"))
    assert served, f"the app did not start with both secrets set:\n{output[-2000:]}"


def test_ac30_env_example_explains_env_staging() -> None:
    """AC30: backend/.env.example has a comment explaining the .env.staging file."""
    example = (BACKEND_DIR / ".env.example").read_text()
    comments = [line for line in example.splitlines() if line.lstrip().startswith("#")]
    assert any(".env.staging" in line for line in comments), "no comment in .env.example mentions .env.staging"
