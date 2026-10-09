"""
WhatsApp Automation — Meta Graph API client
Single place for every call to the WhatsApp Cloud API / WABA management endpoints.

Credentials are per business number (app.whatsapp.numbers.config_for). load_config() resolves the
shared Meta app settings (verify token, app secret, app ID) and the legacy single-number settings,
which are only used to migrate them into the number registry. Access tokens are never logged or
returned to callers.
"""

import os
import re
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("whatsapp.meta_api")

DEFAULT_GRAPH_VERSION = "v22.0"
GRAPH_BASE = "https://graph.facebook.com"

# Meta error codes that are safe to retry later (rate limits / transient platform issues).
# Everything else is treated as permanent and is never retried automatically.
RETRYABLE_ERROR_CODES = {
    1,       # API unknown (transient)
    2,       # API service temporarily unavailable
    4,       # Application request limit reached
    80007,   # WABA rate limit
    130429,  # Cloud API throughput reached
    131000,  # Something went wrong (generic, transient)
    131016,  # Service unavailable
    131056,  # Business/consumer pair rate limit
    133004,  # Server temporarily unavailable
}

# Codes that mean the recipient has opted out of marketing messages.
OPT_OUT_ERROR_CODES = {131050}


@dataclass
class MetaConfig:
    access_token: str = ""
    phone_number_id: str = ""
    waba_id: str = ""
    graph_version: str = DEFAULT_GRAPH_VERSION
    app_id: str = ""
    app_secret: str = ""
    verify_token: str = ""

    @property
    def base_url(self) -> str:
        return f"{GRAPH_BASE}/{self.graph_version}"

    def missing(self, *fields: str) -> List[str]:
        return [f for f in fields if not getattr(self, f)]


@dataclass
class MetaApiError(Exception):
    message: str
    http_status: Optional[int] = None
    code: Optional[int] = None
    subcode: Optional[int] = None
    details: str = ""
    fbtrace_id: str = ""
    retryable: bool = False
    # True when the request may have reached Meta (read timeout etc.), so the outcome is unknown.
    ambiguous: bool = False
    raw: Dict[str, Any] = field(default_factory=dict)

    def __str__(self) -> str:
        parts = [self.message]
        if self.code is not None:
            parts.append(f"(code {self.code}" + (f", subcode {self.subcode})" if self.subcode else ")"))
        if self.details and self.details != self.message:
            parts.append(f"— {self.details}")
        return " ".join(parts)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "message": self.message,
            "http_status": self.http_status,
            "code": self.code,
            "subcode": self.subcode,
            "details": self.details,
            "fbtrace_id": self.fbtrace_id,
            "retryable": self.retryable,
            "ambiguous": self.ambiguous,
        }


def _version_from_url(url: str) -> Optional[str]:
    match = re.search(r"/(v\d+\.\d+)", url or "")
    return match.group(1) if match else None


def load_config() -> MetaConfig:
    """Resolve Meta configuration from the settings document and environment."""
    db_settings: Dict[str, Any] = {}
    try:
        from app.config.database import automation_settings_collection
        db_settings = automation_settings_collection.find_one() or {}
    except Exception as e:  # pragma: no cover - DB outage
        logger.warning(f"[MetaAPI] Could not read automation settings: {e}")

    def pick(db_key: str, env_key: str) -> str:
        value = (db_settings.get(db_key) or "").strip() if isinstance(db_settings.get(db_key), str) else ""
        return value or os.getenv(env_key, "").strip()

    api_url = pick("api_url", "META_WHATSAPP_API_URL")
    version = (
        os.getenv("META_GRAPH_API_VERSION", "").strip()
        or _version_from_url(api_url)
        or DEFAULT_GRAPH_VERSION
    )
    return MetaConfig(
        access_token=pick("api_key", "META_WHATSAPP_API_TOKEN"),
        phone_number_id=pick("phone_number_id", "META_WHATSAPP_PHONE_NUMBER_ID"),
        waba_id=pick("business_account_id", "META_WHATSAPP_BUSINESS_ACCOUNT_ID"),
        graph_version=version,
        app_id=os.getenv("META_APP_ID", "").strip(),
        app_secret=os.getenv("META_APP_SECRET", "").strip(),
        verify_token=(os.getenv("META_WHATSAPP_VERIFY_TOKEN", "").strip() or (db_settings.get("verify_token") or "").strip()),
    )


def _parse_error(resp: httpx.Response) -> MetaApiError:
    try:
        data = resp.json()
    except ValueError:
        data = {}
    err = data.get("error", {}) if isinstance(data, dict) else {}
    code = err.get("code")
    details = (err.get("error_data") or {}).get("details", "") if isinstance(err.get("error_data"), dict) else ""
    retryable = resp.status_code == 429 or resp.status_code >= 500 or code in RETRYABLE_ERROR_CODES
    return MetaApiError(
        message=err.get("error_user_msg") or err.get("message") or f"HTTP {resp.status_code}",
        http_status=resp.status_code,
        code=code,
        subcode=err.get("error_subcode"),
        details=details or err.get("error_user_title", ""),
        fbtrace_id=err.get("fbtrace_id", ""),
        retryable=retryable,
        raw=err,
    )


class MetaClient:
    def __init__(self, config: MetaConfig, timeout: float = 20.0):
        # Always the configuration of one specific business number (see app.whatsapp.numbers.config_for);
        # there is deliberately no implicit global default, so a call can never use the wrong number.
        if config is None:
            raise MetaApiError(message="No WhatsApp business number configuration was provided.")
        self.config = config
        self.timeout = timeout

    def _headers(self) -> Dict[str, str]:
        return {"Authorization": f"Bearer {self.config.access_token}"}

    def _require(self, *fields: str):
        missing = self.config.missing(*fields)
        if missing:
            labels = {
                "access_token": "access token (META_WHATSAPP_API_TOKEN)",
                "phone_number_id": "phone number ID (META_WHATSAPP_PHONE_NUMBER_ID)",
                "waba_id": "WhatsApp Business Account ID (META_WHATSAPP_BUSINESS_ACCOUNT_ID)",
                "app_id": "Meta App ID (META_APP_ID)",
            }
            raise MetaApiError(
                message="Meta WhatsApp configuration incomplete: missing " + ", ".join(labels.get(m, m) for m in missing),
                retryable=False,
            )

    async def _request(self, method: str, path: str, *, params=None, json=None, content=None, headers=None) -> Dict[str, Any]:
        url = path if path.startswith("http") else f"{self.config.base_url}/{path.lstrip('/')}"
        all_headers = {**self._headers(), **(headers or {})}
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.request(method, url, params=params, json=json, content=content, headers=all_headers)
        except (httpx.ConnectError, httpx.ConnectTimeout) as e:
            # Request never reached Meta: safe to retry.
            raise MetaApiError(message=f"Could not connect to Meta Graph API: {type(e).__name__}", retryable=True)
        except httpx.TimeoutException as e:
            # Request may have been processed by Meta; outcome unknown.
            raise MetaApiError(message=f"Meta Graph API timed out: {type(e).__name__}", retryable=False, ambiguous=True)
        except httpx.HTTPError as e:
            raise MetaApiError(message=f"Meta Graph API transport error: {type(e).__name__}", retryable=False, ambiguous=True)

        if resp.status_code >= 400:
            error = _parse_error(resp)
            logger.warning(
                f"[MetaAPI] {method} {path.split('?')[0]} failed: HTTP {resp.status_code} code={error.code} "
                f"subcode={error.subcode} fbtrace={error.fbtrace_id}"
            )
            raise error
        try:
            return resp.json()
        except ValueError:
            return {}

    # ── Messages ───────────────────────────────────────────────────

    async def send_message(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """POST /{phone_number_id}/messages. Returns {'wamid', 'wa_id', 'raw'}."""
        self._require("access_token", "phone_number_id")
        body = {"messaging_product": "whatsapp", "recipient_type": "individual", **payload}
        data = await self._request("POST", f"{self.config.phone_number_id}/messages", json=body)
        messages = data.get("messages") or []
        contacts = data.get("contacts") or []
        wamid = messages[0].get("id") if messages else None
        if not wamid:
            raise MetaApiError(message="Meta accepted the request but returned no message ID", ambiguous=True, raw=data)
        return {
            "wamid": wamid,
            "message_status": messages[0].get("message_status"),
            "wa_id": contacts[0].get("wa_id") if contacts else None,
        }

    # ── Templates ──────────────────────────────────────────────────

    async def list_templates(self) -> List[Dict[str, Any]]:
        self._require("access_token", "waba_id")
        fields = "id,name,status,category,language,components,rejected_reason,quality_score,parameter_format"
        results: List[Dict[str, Any]] = []
        data = await self._request("GET", f"{self.config.waba_id}/message_templates", params={"fields": fields, "limit": 100})
        while True:
            results.extend(data.get("data", []))
            next_url = (data.get("paging") or {}).get("next")
            if not next_url:
                break
            data = await self._request("GET", next_url)
        return results

    async def get_template(self, template_id: str) -> Dict[str, Any]:
        self._require("access_token")
        fields = "id,name,status,category,language,components,rejected_reason,quality_score,parameter_format"
        return await self._request("GET", template_id, params={"fields": fields})

    async def create_template(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """POST /{waba_id}/message_templates → {'id', 'status', 'category'}."""
        self._require("access_token", "waba_id")
        return await self._request("POST", f"{self.config.waba_id}/message_templates", json=payload)

    async def edit_template(self, template_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """POST /{template_id} — Meta only allows editing components/category of existing templates."""
        self._require("access_token")
        return await self._request("POST", template_id, json=payload)

    async def delete_template(self, name: str, template_id: Optional[str] = None) -> Dict[str, Any]:
        self._require("access_token", "waba_id")
        params = {"name": name}
        if template_id:
            params["hsm_id"] = template_id
        return await self._request("DELETE", f"{self.config.waba_id}/message_templates", params=params)

    async def upload_sample_media(self, file_bytes: bytes, mime_type: str) -> str:
        """Resumable Upload API → header_handle used as example for media headers."""
        self._require("access_token", "app_id")
        session = await self._request(
            "POST", f"{self.config.app_id}/uploads",
            params={"file_length": len(file_bytes), "file_type": mime_type},
        )
        session_id = session.get("id")
        if not session_id:
            raise MetaApiError(message="Meta did not return an upload session ID")
        result = await self._request(
            "POST", session_id, content=file_bytes,
            headers={"Authorization": f"OAuth {self.config.access_token}", "file_offset": "0"},
        )
        handle = result.get("h")
        if not handle:
            raise MetaApiError(message="Meta did not return a media handle for the sample file")
        return handle

    # ── Diagnostics ────────────────────────────────────────────────

    async def get_phone_number(self) -> Dict[str, Any]:
        self._require("access_token", "phone_number_id")
        return await self._request(
            "GET", self.config.phone_number_id,
            params={"fields": "id,display_phone_number,verified_name,quality_rating,messaging_limit_tier,code_verification_status,name_status"},
        )

    async def get_token_identity(self) -> Dict[str, Any]:
        """GET /me — proves the access token is valid (system user or user token)."""
        self._require("access_token")
        return await self._request("GET", "me", params={"fields": "id,name"})

    async def get_token_permissions(self) -> List[Dict[str, Any]]:
        """GET /me/permissions → [{'permission', 'status'}] granted to the token."""
        self._require("access_token")
        data = await self._request("GET", "me/permissions")
        return data.get("data", [])

    async def get_waba(self, fields: str = "id,name") -> Dict[str, Any]:
        self._require("access_token", "waba_id")
        return await self._request("GET", self.config.waba_id, params={"fields": fields})

    async def list_phone_numbers(self) -> List[Dict[str, Any]]:
        self._require("access_token", "waba_id")
        data = await self._request(
            "GET", f"{self.config.waba_id}/phone_numbers",
            params={"fields": "id,display_phone_number,verified_name,quality_rating"},
        )
        return data.get("data", [])

    async def get_subscribed_apps(self) -> List[Dict[str, Any]]:
        self._require("access_token", "waba_id")
        data = await self._request("GET", f"{self.config.waba_id}/subscribed_apps")
        return data.get("data", [])

    async def subscribe_app(self) -> Dict[str, Any]:
        self._require("access_token", "waba_id")
        return await self._request("POST", f"{self.config.waba_id}/subscribed_apps")
