"""
Console sign-in.

* One administrator account. Email and password come from ADMIN_EMAIL and ADMIN_PASSWORD (or
  ADMIN_PASSWORD_HASH) in the environment; without them the built-in account below applies.
* A successful sign-in returns a signed bearer token. The HTTP middleware in app.main requires it on
  every API route except sign-in and the Meta webhook; WebSockets pass it as ?token=.
* Tokens are HMAC-SHA256 signed with AUTH_SECRET_KEY, or with a key generated once into
  backend/.secrets/auth_secret.key. Changing the key signs everybody out.
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import threading
import time
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, WebSocket
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])

DEFAULT_ADMIN_EMAIL = "sparshmagicautomation@gmail.com"
# PBKDF2 hash of the default password; set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH to change it.
DEFAULT_ADMIN_PASSWORD_HASH = "pbkdf2_sha256$390000$uzq82Js05eUNdVA0NNcRtA==$JnAytPz1gHCvsBs8DhN7cZobhgTFehnC0d+UuLZT/G4="

SESSION_SECONDS = 12 * 3600
REMEMBER_SECONDS = 30 * 24 * 3600

SECRET_FILE = Path(__file__).resolve().parents[2] / ".secrets" / "auth_secret.key"
_secret_lock = threading.Lock()
_secret: Optional[bytes] = None

# Failed sign-ins per client IP: at most MAX_FAILURES within FAILURE_WINDOW seconds.
MAX_FAILURES = 10
FAILURE_WINDOW = 15 * 60
_failures: dict = {}
_failures_lock = threading.Lock()


def admin_email() -> str:
    return (os.getenv("ADMIN_EMAIL") or DEFAULT_ADMIN_EMAIL).strip().lower()


def hash_password(password: str, iterations: int = 390000) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, iterations)
    return f"pbkdf2_sha256${iterations}${base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"


def _password_matches(password: str) -> bool:
    plain = os.getenv("ADMIN_PASSWORD")
    if plain:
        return hmac.compare_digest(password.encode(), plain.encode())
    stored = os.getenv("ADMIN_PASSWORD_HASH") or DEFAULT_ADMIN_PASSWORD_HASH
    try:
        _, iterations, salt, expected = stored.split("$")
        digest = hashlib.pbkdf2_hmac("sha256", password.encode(), base64.b64decode(salt), int(iterations))
        return hmac.compare_digest(digest, base64.b64decode(expected))
    except ValueError:
        logger.error("[Auth] ADMIN_PASSWORD_HASH is malformed; nobody can sign in")
        return False


def _signing_key() -> bytes:
    global _secret
    if _secret is None:
        with _secret_lock:
            if _secret is None:
                env_key = os.getenv("AUTH_SECRET_KEY")
                if env_key:
                    _secret = env_key.encode()
                elif SECRET_FILE.exists():
                    _secret = SECRET_FILE.read_text().strip().encode()
                else:
                    key = secrets.token_urlsafe(48)
                    SECRET_FILE.parent.mkdir(parents=True, exist_ok=True)
                    SECRET_FILE.write_text(key)
                    try:
                        os.chmod(SECRET_FILE, 0o600)
                    except OSError:
                        pass
                    logger.warning(f"[Auth] Generated session signing key at {SECRET_FILE}")
                    _secret = key.encode()
    return _secret


def _b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _unb64(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def issue_token(email: str, lifetime: int) -> tuple:
    expires_at = int(time.time()) + lifetime
    body = _b64(json.dumps({"sub": email, "exp": expires_at}, separators=(",", ":")).encode())
    signature = _b64(hmac.new(_signing_key(), body.encode(), hashlib.sha256).digest())
    return f"{body}.{signature}", expires_at


def verify_token(token: Optional[str]) -> Optional[str]:
    """Email of the signed-in user, or None for a missing, forged or expired token."""
    if not token or token.count(".") != 1:
        return None
    body, signature = token.split(".")
    expected = _b64(hmac.new(_signing_key(), body.encode(), hashlib.sha256).digest())
    if not hmac.compare_digest(signature, expected):
        return None
    try:
        payload = json.loads(_unb64(body))
    except ValueError:
        return None
    if not isinstance(payload, dict) or payload.get("exp", 0) < time.time():
        return None
    # Only the current administrator: changing ADMIN_EMAIL ends the old account's sessions.
    return payload.get("sub") if payload.get("sub") == admin_email() else None


def bearer_token(authorization: Optional[str]) -> Optional[str]:
    if authorization and authorization[:7].lower() == "bearer ":
        return authorization[7:].strip()
    return None


async def accept_signed_in(websocket: WebSocket) -> bool:
    """Accept a WebSocket only with a valid ?token= (browsers cannot set headers on WebSockets)."""
    if verify_token(websocket.query_params.get("token")):
        return True
    await websocket.close(code=1008)
    return False


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _recent_failures(ip: str, now: float) -> list:
    attempts = [t for t in _failures.get(ip, []) if now - t < FAILURE_WINDOW]
    _failures[ip] = attempts
    return attempts


class LoginRequest(BaseModel):
    email: str
    password: str
    remember: bool = False


@router.post("/login")
def login(payload: LoginRequest, request: Request):
    ip = _client_ip(request)
    now = time.time()
    with _failures_lock:
        if len(_recent_failures(ip, now)) >= MAX_FAILURES:
            raise HTTPException(status_code=429, detail="Too many failed sign-in attempts. Try again in 15 minutes.")

    email = payload.email.strip().lower()
    if not (hmac.compare_digest(email.encode(), admin_email().encode()) and _password_matches(payload.password)):
        with _failures_lock:
            _failures.setdefault(ip, []).append(now)
        logger.warning(f"[Auth] Failed sign-in for {email!r} from {ip}")
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    with _failures_lock:
        _failures.pop(ip, None)
    token, expires_at = issue_token(email, REMEMBER_SECONDS if payload.remember else SESSION_SECONDS)
    return {"token": token, "email": email, "expires_at": expires_at}


@router.get("/me")
def me(request: Request):
    # The middleware has already rejected requests without a valid token.
    return {"email": verify_token(bearer_token(request.headers.get("Authorization")))}
