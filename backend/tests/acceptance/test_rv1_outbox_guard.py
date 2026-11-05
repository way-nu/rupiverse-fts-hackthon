"""RV1 acceptance · test outbox switch and production guard: AC13."""

import socket
import subprocess
import sys
import time
from collections.abc import Iterator

import httpx
import pytest

from tests.acceptance.conftest import BACKEND_DIR, HOST, Server, server_env, start_server, stop_server


@pytest.fixture(scope="module", params=["unset", "false"])
def server(database_url: str, request: pytest.FixtureRequest) -> Iterator[Server]:
    """Outbox off: once with TEST_OUTBOX_ENABLED absent (the default), once with it explicitly false."""
    value = None if request.param == "unset" else "false"
    srv = start_server(server_env(database_url, TEST_OUTBOX_ENABLED=value), f"outbox-{request.param}")
    yield srv
    stop_server(srv.process)


@pytest.mark.parametrize("purpose", ["verify_email", "reset_password"])
def test_ac13_outbox_is_404_unless_enabled(server: Server, purpose: str) -> None:
    """AC13: /test/outbox/* → 404 when TEST_OUTBOX_ENABLED is not true (off by default)."""
    response = httpx.get(
        f"{server.base_url}/test/outbox/latest", params={"email": "someone@example.com", "purpose": purpose}
    )
    assert response.status_code == 404, response.text


def test_ac13_outbox_not_in_openapi_when_disabled(server: Server) -> None:
    """AC13: the test route is not mounted at all when disabled (absent from the OpenAPI schema)."""
    response = httpx.get(f"{server.base_url}/openapi.json")
    if response.status_code == 200:
        assert not any(path.startswith("/test/") for path in response.json().get("paths", {}))


def test_ac13_app_refuses_to_start_with_outbox_in_production(database_url: str) -> None:
    """AC13: TEST_OUTBOX_ENABLED=true + APP_ENV=production → the app refuses to start (non-zero exit, never serves)."""
    env = server_env(database_url, TEST_OUTBOX_ENABLED="true", APP_ENV="production")
    # A port of its own: this module's outbox-off server may still be listening on PORT.
    with socket.socket() as sock:
        sock.bind((HOST, 0))
        port = sock.getsockname()[1]
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
                httpx.get(f"http://{HOST}:{port}/test/outbox/latest", params={"email": "a@example.com"}, timeout=0.5)
                served = True
                break
            except httpx.TransportError:
                time.sleep(0.2)
    finally:
        if process.poll() is None:
            process.kill()
        output = process.communicate(timeout=10)[0].decode(errors="replace")
    assert not served, "the app served requests with the outbox enabled in production"
    assert process.returncode not in (None, 0), f"expected a non-zero exit, got {process.returncode}:\n{output}"
