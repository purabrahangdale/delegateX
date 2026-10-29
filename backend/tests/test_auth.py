"""Console sign-in: the API and WebSockets are closed to anyone without a valid session token."""

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.auth import routes as auth_routes
from app.main import app

pytestmark = pytest.mark.real_auth

EMAIL = "sparshmagicautomation@gmail.com"
PASSWORD = "SparshMagicAutomation@2026"


@pytest.fixture
def client(monkeypatch):
    # Test the built-in account, not one configured in backend/.env.
    for name in ("ADMIN_EMAIL", "ADMIN_PASSWORD", "ADMIN_PASSWORD_HASH"):
        monkeypatch.delenv(name, raising=False)
    auth_routes._failures.clear()
    return TestClient(app)


def sign_in(client, email=EMAIL, password=PASSWORD, **extra):
    return client.post("/api/auth/login", json={"email": email, "password": password, **extra})


def test_api_requires_sign_in(client):
    assert client.get("/api/whatsapp/auto-reply").status_code == 401
    assert client.get("/notifications").status_code == 401
    assert client.get("/api/whatsapp/auto-reply", headers={"Authorization": "Bearer forged.token"}).status_code == 401


def test_public_paths_stay_open(client):
    assert client.get("/").status_code == 200
    # Meta's verification handshake must not need a session (it fails here only on the wrong verify token).
    assert client.get("/api/whatsapp/webhook", params={"hub.mode": "subscribe"}).status_code != 401


def test_sign_in_with_default_credentials(client):
    r = sign_in(client, email="  SparshMagicAutomation@gmail.com ")
    assert r.status_code == 200
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/auth/me", headers=headers).json() == {"email": EMAIL}
    assert client.get("/api/whatsapp/auto-reply", headers=headers).status_code != 401


def test_wrong_credentials_rejected(client):
    assert sign_in(client, password="admin123").status_code == 401
    assert sign_in(client, email="admin@delegatex.com").status_code == 401


def test_repeated_failures_are_throttled(client):
    for _ in range(auth_routes.MAX_FAILURES):
        assert sign_in(client, password="wrong").status_code == 401
    assert sign_in(client).status_code == 429


def test_expired_and_tampered_tokens_rejected(client):
    expired, _ = auth_routes.issue_token(EMAIL, -1)
    assert auth_routes.verify_token(expired) is None
    valid, _ = auth_routes.issue_token(EMAIL, 60)
    body, signature = valid.split(".")
    assert auth_routes.verify_token(f"{body}x.{signature}") is None
    assert auth_routes.verify_token(valid) == EMAIL


def test_password_from_environment(client, monkeypatch):
    monkeypatch.setenv("ADMIN_PASSWORD_HASH", auth_routes.hash_password("another-secret"))
    assert sign_in(client).status_code == 401
    assert sign_in(client, password="another-secret").status_code == 200


def test_signed_in_account_administers_whatsapp():
    from app.whatsapp import numbers
    assert numbers.is_admin(EMAIL)


def test_websocket_requires_token(client):
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/whatsapp"):
            pass
    token = sign_in(client).json()["token"]
    with client.websocket_connect(f"/ws/whatsapp?token={token}"):
        pass
