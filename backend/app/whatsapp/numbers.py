"""
WhatsApp Automation — Business number registry (multiple numbers, same or different WABAs)

Each configured WhatsApp Business phone number is one document in `whatsapp_numbers`. Its `_id`
(the internal `number_id`) is stamped on every number-scoped record: messages, campaigns, send jobs,
automation runs and logs, chat access logs and webhook events. Templates belong to a WABA and are
shared by all numbers of that WABA (`waba_id` on the template).

Rules enforced here:
  * A request names its number with the `X-WhatsApp-Number-Id` header. Without it, the number marked
    default is used. An unknown, removed or inaccessible number is an error — there is never a
    fallback to some other number.
  * Sending requires an active number with credentials. Background jobs resolve the number stamped
    on the job, never the one currently selected in the UI.
  * Access tokens (and optional per-number app secrets) are encrypted at rest and never returned.
  * Numbers are soft-deleted so their history stays attached; re-adding the same phone number ID
    restores the original record.
"""

import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from bson import ObjectId
from pymongo import ReturnDocument

from app.config.database import whatsapp_number_collection as numbers
from app.whatsapp.meta_api import DEFAULT_GRAPH_VERSION, MetaApiError, MetaClient, MetaConfig, load_config

logger = logging.getLogger("whatsapp.numbers")

GRAPH_VERSION_RE = re.compile(r"^v\d{1,3}\.\d{1,2}$")
META_ID_RE = re.compile(r"^\d{5,25}$")
PHONE_RE = re.compile(r"^\+?[\d\s\-()]{8,20}$")
PURPOSES = ["Marketing", "Customer Support", "Sales", "Transactional", "Operations", "Other"]

# Collections whose records carry `number_id`.
SCOPED_COLLECTIONS = ["whatsapp_messages", "whatsapp_campaigns", "whatsapp_campaign_recipients",
                      "whatsapp_automation_runs", "automation_logs", "chat_access_logs"]


class NumberError(Exception):
    def __init__(self, message: str, status_code: int = 400, code: str = "number_error"):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code

    def to_detail(self) -> dict:
        return {"message": self.message, "code": self.code}


def _now() -> str:
    return datetime.utcnow().isoformat()


# ═══════════════════════════════════════════════════════════════════
# SECRET ENCRYPTION
# ═══════════════════════════════════════════════════════════════════

KEY_FILE = Path(__file__).resolve().parents[2] / ".secrets" / "whatsapp_token.key"
ENC_PREFIX = "enc:v1:"


def _fernet():
    from cryptography.fernet import Fernet
    key = os.getenv("WHATSAPP_TOKEN_ENCRYPTION_KEY", "").strip()
    if not key:
        # No key configured: keep one on the server's disk (never in the database), so a database
        # leak alone does not expose tokens. Set WHATSAPP_TOKEN_ENCRYPTION_KEY to manage it yourself.
        if KEY_FILE.exists():
            key = KEY_FILE.read_text().strip()
        else:
            KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
            key = Fernet.generate_key().decode()
            KEY_FILE.write_text(key)
            try:
                os.chmod(KEY_FILE, 0o600)
            except OSError:
                pass
            logger.warning(f"[WhatsApp Numbers] Generated token encryption key at {KEY_FILE}. Back it up — tokens cannot be decrypted without it.")
    return Fernet(key.encode())


def encrypt_secret(value: str) -> str:
    return ENC_PREFIX + _fernet().encrypt(value.encode()).decode()


def decrypt_secret(value: Optional[str]) -> str:
    if not value:
        return ""
    if not value.startswith(ENC_PREFIX):
        return value
    try:
        return _fernet().decrypt(value[len(ENC_PREFIX):].encode()).decode()
    except Exception:
        logger.error("[WhatsApp Numbers] Could not decrypt a stored credential (encryption key changed?)")
        return ""


def _hint(secret: str) -> str:
    return "••••••••" + secret[-4:] if len(secret) > 8 else ("••••" if secret else "")


# ═══════════════════════════════════════════════════════════════════
# ACCESS CONTROL
# ═══════════════════════════════════════════════════════════════════

def admin_emails() -> set:
    raw = os.getenv("WHATSAPP_ADMIN_EMAILS", "admin@delegatex.com")
    return {e.strip().lower() for e in raw.split(",") if e.strip()}


def is_admin(user: Optional[str]) -> bool:
    return bool(user) and user.strip().lower() in admin_emails()


def can_access(doc: dict, user: Optional[str]) -> bool:
    allowed = [u.lower() for u in (doc.get("allowed_users") or [])]
    return not allowed or is_admin(user) or (bool(user) and user.strip().lower() in allowed)


def require_admin(user: Optional[str]):
    if not is_admin(user):
        raise NumberError("Only WhatsApp administrators can manage business numbers.", 403, "forbidden")


# ═══════════════════════════════════════════════════════════════════
# LOOKUPS
# ═══════════════════════════════════════════════════════════════════

ACTIVE_QUERY = {"deleted_at": None}


def get_number(number_id: Optional[str], include_deleted: bool = False) -> Optional[dict]:
    if not number_id or not ObjectId.is_valid(str(number_id)):
        return None
    query = {"_id": ObjectId(str(number_id))}
    if not include_deleted:
        query.update(ACTIVE_QUERY)
    return numbers.find_one(query)


def get_by_phone_number_id(phone_number_id: str) -> Optional[dict]:
    if not phone_number_id:
        return None
    return numbers.find_one({"phone_number_id": str(phone_number_id), **ACTIVE_QUERY})


def numbers_for_waba(waba_id: str) -> List[dict]:
    if not waba_id:
        return []
    return list(numbers.find({"waba_id": str(waba_id), **ACTIVE_QUERY}))


def all_numbers(active_only: bool = False) -> List[dict]:
    query = dict(ACTIVE_QUERY)
    if active_only:
        query["is_active"] = True
    return list(numbers.find(query).sort([("is_default", -1), ("created_at", 1)]))


def count_numbers() -> int:
    return numbers.count_documents(ACTIVE_QUERY)


def default_number() -> Optional[dict]:
    return numbers.find_one({"is_default": True, "is_active": True, **ACTIVE_QUERY})


def config_for(doc: dict) -> MetaConfig:
    """Meta configuration for one number. Raises NumberError if its token cannot be resolved."""
    if doc.get("token_source") == "env":
        token = os.getenv("META_WHATSAPP_API_TOKEN", "").strip()
    else:
        token = decrypt_secret(doc.get("access_token_enc"))
    base = load_config()  # verify token / app credentials shared by the Meta app
    app_secret = decrypt_secret(doc.get("app_secret_enc")) or base.app_secret
    return MetaConfig(
        access_token=token,
        phone_number_id=doc.get("phone_number_id") or "",
        waba_id=doc.get("waba_id") or "",
        graph_version=doc.get("graph_api_version") or DEFAULT_GRAPH_VERSION,
        app_id=(doc.get("app_id") or "").strip() or base.app_id,
        app_secret=app_secret,
        verify_token=base.verify_token,
    )


def graph_api_url(doc: dict) -> str:
    version = doc.get("graph_api_version") or DEFAULT_GRAPH_VERSION
    return f"https://graph.facebook.com/{version}/{doc.get('phone_number_id') or ''}".rstrip("/")


def serialize(doc: dict) -> dict:
    """Public view of a number. Credentials are reduced to configured/hint flags."""
    if doc.get("token_source") == "env":
        token = os.getenv("META_WHATSAPP_API_TOKEN", "").strip()
    else:
        token = decrypt_secret(doc.get("access_token_enc"))
    return {
        "_id": str(doc["_id"]),
        "id": str(doc["_id"]),
        "display_name": doc.get("display_name") or "",
        "phone_number": doc.get("phone_number") or "",
        "phone_number_id": doc.get("phone_number_id") or "",
        "waba_id": doc.get("waba_id") or "",
        "waba_name": doc.get("waba_name") or "",
        "business_portfolio_id": doc.get("business_portfolio_id") or "",
        "purpose": doc.get("purpose") or "",
        "graph_api_version": doc.get("graph_api_version") or DEFAULT_GRAPH_VERSION,
        "graph_api_url": graph_api_url(doc),
        "app_id": doc.get("app_id") or "",
        "is_active": bool(doc.get("is_active")),
        "is_default": bool(doc.get("is_default")),
        "legacy": bool(doc.get("legacy")),
        "token_configured": bool(token),
        "token_source": doc.get("token_source") or "stored",
        "token_hint": _hint(token),
        "app_secret_configured": bool(doc.get("app_secret_enc")),
        "allowed_users": doc.get("allowed_users") or [],
        "connection": doc.get("connection") or {"status": "unverified"},
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


# ═══════════════════════════════════════════════════════════════════
# REQUEST SCOPE
# ═══════════════════════════════════════════════════════════════════

@dataclass
class NumberScope:
    """The number a request (or background job) operates on. `number` is None only when no numbers
    are configured at all — then only records without a number (legacy / simulation) are visible."""
    number: Optional[dict]

    @property
    def id(self) -> Optional[str]:
        return str(self.number["_id"]) if self.number else None

    @property
    def waba_id(self) -> Optional[str]:
        return (self.number or {}).get("waba_id") or None

    @property
    def phone_number_id(self) -> Optional[str]:
        return (self.number or {}).get("phone_number_id") or None

    def match(self) -> dict:
        """Mongo filter for number-scoped collections (None also matches a missing field)."""
        return {"number_id": self.id}

    def template_match(self) -> dict:
        return {"waba_id": self.waba_id}

    def stamp(self) -> dict:
        """Fields written on new number-scoped records."""
        return {"number_id": self.id, "phone_number_id": self.phone_number_id}

    def config(self) -> MetaConfig:
        if not self.number:
            raise NumberError("No WhatsApp business number is configured. Add one in WhatsApp Settings.", 409, "no_number")
        return config_for(self.number)


def resolve_scope(requested_id: Optional[str], user: Optional[str]) -> NumberScope:
    if count_numbers() == 0:
        if requested_id:
            raise NumberError("The selected WhatsApp number no longer exists. Select another number.", 404, "number_not_found")
        return NumberScope(None)
    if requested_id:
        doc = get_number(requested_id)
        if not doc:
            raise NumberError("The selected WhatsApp number no longer exists. Select another number.", 404, "number_not_found")
    else:
        doc = default_number()
        if not doc:
            raise NumberError("No default WhatsApp number is set. Select a number to continue.", 409, "no_default_number")
    if not can_access(doc, user):
        raise NumberError("You do not have access to this WhatsApp number.", 403, "number_forbidden")
    return NumberScope(doc)


def scope_for_record(record: dict) -> NumberScope:
    """Scope of an existing record (job, message, run). Never substitutes another number."""
    nid = record.get("number_id")
    doc = get_number(nid, include_deleted=True) if nid else None
    if not doc and not nid and record.get("phone_number_id"):
        doc = get_by_phone_number_id(record["phone_number_id"])
    return NumberScope(doc)


def sending_problem(doc: Optional[dict]) -> Optional[str]:
    """Why this number cannot send right now (None when it can). Simulation mode is checked by callers."""
    if not doc:
        return "No WhatsApp business number is selected for this message."
    name = doc.get("display_name") or doc.get("phone_number_id")
    if doc.get("deleted_at"):
        return f"WhatsApp number '{name}' has been removed. The message was not sent through any other number."
    if not doc.get("is_active"):
        return f"WhatsApp number '{name}' is deactivated. Reactivate it in WhatsApp Settings to send messages."
    if (doc.get("connection") or {}).get("status") == "error":
        return f"WhatsApp number '{name}' is disconnected (last connection test failed). Fix its credentials and test the connection again."
    cfg = config_for(doc)
    missing = cfg.missing("access_token", "phone_number_id")
    if missing:
        return f"WhatsApp number '{name}' is missing: {', '.join(missing)}."
    return None


def ensure_can_send(doc: Optional[dict]):
    problem = sending_problem(doc)
    if problem:
        raise NumberError(problem, 409, "number_unavailable")


def mark_auth_failure(number_id: Optional[str], error: MetaApiError):
    """Meta rejected the token (code 190): flag the number as disconnected so it is not used again silently."""
    if number_id and error.code == 190 and ObjectId.is_valid(str(number_id)):
        numbers.update_one({"_id": ObjectId(str(number_id))}, {"$set": {"connection": {
            "status": "error", "checked_at": _now(), "message": f"Meta rejected the access token: {error}"}}})


# ═══════════════════════════════════════════════════════════════════
# CRUD
# ═══════════════════════════════════════════════════════════════════

TEXT_FIELDS = ["display_name", "phone_number", "phone_number_id", "waba_id", "waba_name", "business_portfolio_id",
               "purpose", "graph_api_version", "app_id"]


def _clean(data: dict) -> dict:
    out = {}
    for k in TEXT_FIELDS:
        if k in data and data[k] is not None:
            out[k] = str(data[k]).strip()
    if "graph_api_version" in out and out["graph_api_version"] and not out["graph_api_version"].startswith("v"):
        out["graph_api_version"] = "v" + out["graph_api_version"]
    if "allowed_users" in data and data["allowed_users"] is not None:
        out["allowed_users"] = sorted({str(u).strip().lower() for u in data["allowed_users"] if str(u).strip()})
    return out


def _validate(doc: dict, token_available: bool, exclude_id=None) -> List[str]:
    errors = []
    if not doc.get("display_name"):
        errors.append("Display name is required.")
    if not doc.get("phone_number"):
        errors.append("WhatsApp business phone number is required.")
    elif not PHONE_RE.match(doc["phone_number"]):
        errors.append("Phone number must include the country code, e.g. +91 98765 43210.")
    if not META_ID_RE.match(doc.get("phone_number_id") or ""):
        errors.append("WhatsApp Phone Number ID must be the numeric ID from WhatsApp Manager → API Setup.")
    if not META_ID_RE.match(doc.get("waba_id") or ""):
        errors.append("WhatsApp Business Account ID (WABA ID) must be numeric.")
    if doc.get("business_portfolio_id") and not META_ID_RE.match(doc["business_portfolio_id"]):
        errors.append("Meta Business Portfolio ID must be numeric.")
    if doc.get("app_id") and not META_ID_RE.match(doc["app_id"]):
        errors.append("Meta App ID must be numeric.")
    if not GRAPH_VERSION_RE.match(doc.get("graph_api_version") or ""):
        errors.append("Graph API version must look like v22.0.")
    if not token_available:
        errors.append("Access token (System User Token) is required.")
    if doc.get("phone_number_id"):
        query = {"phone_number_id": doc["phone_number_id"], **ACTIVE_QUERY}
        if exclude_id:
            query["_id"] = {"$ne": exclude_id}
        if numbers.find_one(query):
            errors.append(f"Phone Number ID {doc['phone_number_id']} is already configured.")
    return errors


def _has_records(number_id: str) -> bool:
    from app.config.database import db
    return any(db[name].count_documents({"number_id": number_id}, limit=1) for name in SCOPED_COLLECTIONS)


def _is_masked(value: Optional[str]) -> bool:
    return bool(value) and "•" in value


def create_number(data: dict, user: Optional[str], verification: Optional[dict] = None) -> dict:
    """Persist a new number. `verification` is the result of verify_configuration for these exact values;
    its outcome becomes the stored connection status."""
    require_admin(user)
    doc = _clean(data)
    if verification and not doc.get("waba_name") and (verification.get("meta") or {}).get("waba_name"):
        doc["waba_name"] = verification["meta"]["waba_name"]
    doc.setdefault("graph_api_version", DEFAULT_GRAPH_VERSION)
    token = (data.get("access_token") or "").strip()
    copy_from = get_number(data.get("copy_token_from")) if data.get("copy_token_from") else None
    if data.get("copy_token_from") and not copy_from:
        raise NumberError("The number to copy the access token from was not found.")
    errors = _validate(doc, bool(token) or bool(copy_from))
    if errors:
        raise NumberError(" ".join(errors), 400, "validation")

    now = _now()
    if token:
        doc.update(access_token_enc=encrypt_secret(token), token_source="stored")
    elif copy_from.get("token_source") == "env":
        doc["token_source"] = "env"
    else:
        doc.update(access_token_enc=copy_from.get("access_token_enc"), token_source="stored")
    if (data.get("app_secret") or "").strip():
        doc["app_secret_enc"] = encrypt_secret(data["app_secret"].strip())
    is_first = count_numbers() == 0
    doc.update({
        "is_active": True,
        "is_default": is_first or bool(data.get("is_default")),
        "connection": connection_from_verification(verification) if verification
        else {"status": "unverified", "message": "Connection not tested yet."},
        "deleted_at": None,
        "updated_at": now,
        "updated_by": user,
    })
    doc.setdefault("allowed_users", [])
    if doc["is_default"]:
        numbers.update_many({"is_default": True}, {"$set": {"is_default": False}})

    # Re-adding a removed number restores the original record so its history re-attaches.
    revived = numbers.find_one_and_update(
        {"phone_number_id": doc["phone_number_id"], "deleted_at": {"$ne": None}},
        {"$set": doc}, return_document=ReturnDocument.AFTER,
    )
    if revived:
        return revived
    doc.update({"created_at": now, "created_by": user, "legacy": False})
    doc["_id"] = numbers.insert_one(doc).inserted_id
    return doc


def update_number(number_id: str, data: dict, user: Optional[str]) -> dict:
    require_admin(user)
    existing = get_number(number_id)
    if not existing:
        raise NumberError("WhatsApp number not found.", 404, "number_not_found")
    changes = _clean(data)
    merged = {**existing, **changes}
    for key in ("phone_number_id", "waba_id"):
        if key in changes and changes[key] != existing.get(key) and _has_records(number_id):
            label = "Phone Number ID" if key == "phone_number_id" else "WABA ID"
            raise NumberError(f"{label} cannot be changed because this number already has messages or campaigns. "
                              "Add the new phone number as a separate configuration instead.", 400, "validation")

    token = (data.get("access_token") or "").strip()
    if _is_masked(token):
        token = ""
    has_token = bool(token) or bool(config_for(existing).access_token)
    errors = _validate(merged, has_token, exclude_id=existing["_id"])
    if errors:
        raise NumberError(" ".join(errors), 400, "validation")

    update = {**changes, "updated_at": _now(), "updated_by": user}
    if token:
        update.update(access_token_enc=encrypt_secret(token), token_source="stored")
    secret = (data.get("app_secret") or "").strip()
    if secret and not _is_masked(secret):
        update["app_secret_enc"] = encrypt_secret(secret)
    credential_keys = {"phone_number_id", "waba_id", "graph_api_version"}
    if token or any(changes.get(k) != existing.get(k) for k in credential_keys if k in changes):
        update["connection"] = {"status": "unverified", "message": "Configuration changed — test the connection again."}
    return numbers.find_one_and_update({"_id": existing["_id"]}, {"$set": update}, return_document=ReturnDocument.AFTER)


def set_active(number_id: str, active: bool, user: Optional[str]) -> dict:
    require_admin(user)
    doc = get_number(number_id)
    if not doc:
        raise NumberError("WhatsApp number not found.", 404, "number_not_found")
    update = {"is_active": active, "updated_at": _now(), "updated_by": user}
    if not active:
        update["is_default"] = False  # the default must always be usable; the admin picks a new one
    return numbers.find_one_and_update({"_id": doc["_id"]}, {"$set": update}, return_document=ReturnDocument.AFTER)


def set_default(number_id: str, user: Optional[str]) -> dict:
    require_admin(user)
    doc = get_number(number_id)
    if not doc:
        raise NumberError("WhatsApp number not found.", 404, "number_not_found")
    if not doc.get("is_active"):
        raise NumberError("Activate this number before making it the default.", 400, "validation")
    numbers.update_many({"is_default": True, "_id": {"$ne": doc["_id"]}}, {"$set": {"is_default": False}})
    return numbers.find_one_and_update({"_id": doc["_id"]}, {"$set": {"is_default": True, "updated_at": _now()}},
                                       return_document=ReturnDocument.AFTER)


def remove_number(number_id: str, user: Optional[str]) -> dict:
    """Soft delete: configuration is hidden and unusable; its records are kept, never reassigned."""
    require_admin(user)
    from app.config.database import whatsapp_campaign_recipient_collection as jobs
    doc = get_number(number_id)
    if not doc:
        raise NumberError("WhatsApp number not found.", 404, "number_not_found")
    pending = jobs.count_documents({"number_id": number_id, "state": {"$in": ["queued", "scheduled", "paused", "sending"]}})
    if pending:
        raise NumberError(f"{pending} message(s) are still queued or scheduled for this number. Cancel those campaigns before removing it.", 409, "number_busy")
    numbers.update_one({"_id": doc["_id"]}, {"$set": {
        "deleted_at": _now(), "deleted_by": user, "is_active": False, "is_default": False}})
    return {"removed": True, "id": number_id}


async def test_connection(number_id: str, user: Optional[str]) -> dict:
    """Real validation against the Meta Graph API. The stored status is exactly what Meta answered."""
    doc = get_number(number_id)
    if not doc:
        raise NumberError("WhatsApp number not found.", 404, "number_not_found")
    if not can_access(doc, user):
        raise NumberError("You do not have access to this WhatsApp number.", 403, "number_forbidden")
    client = MetaClient(config_for(doc))
    checks: List[dict] = []
    connection: Dict[str, Any] = {"checked_at": _now()}
    phone_info = None
    try:
        phone_info = await client.get_phone_number()
        checks.append({"key": "phone", "ok": True, "detail": f"{phone_info.get('display_phone_number')} — {phone_info.get('verified_name')}"})
        connection.update({
            "display_phone_number": phone_info.get("display_phone_number"),
            "verified_name": phone_info.get("verified_name"),
            "quality_rating": phone_info.get("quality_rating"),
            "messaging_limit_tier": phone_info.get("messaging_limit_tier"),
        })
    except MetaApiError as e:
        checks.append({"key": "phone", "ok": False, "detail": str(e)})

    in_waba = None
    try:
        listed = await client.list_phone_numbers()
        in_waba = any(str(n.get("id")) == doc.get("phone_number_id") for n in listed)
        checks.append({"key": "waba", "ok": in_waba, "detail": "Phone number belongs to this WABA." if in_waba
                       else f"Phone Number ID {doc.get('phone_number_id')} was not found on WABA {doc.get('waba_id')}."})
    except MetaApiError as e:
        checks.append({"key": "waba", "ok": False, "detail": str(e)})

    try:
        apps = await client.get_subscribed_apps()
        connection["webhook_subscribed"] = bool(apps)
        checks.append({"key": "webhook", "ok": bool(apps), "detail": "App is subscribed to this WABA's webhooks." if apps
                       else "No app is subscribed to this WABA — incoming messages and delivery statuses will not arrive."})
    except MetaApiError as e:
        connection["webhook_subscribed"] = None
        checks.append({"key": "webhook", "ok": False, "detail": str(e)})

    ok = bool(phone_info) and in_waba is True
    connection["status"] = "connected" if ok else "error"
    connection["in_waba"] = in_waba
    connection["message"] = "Connected to Meta Graph API." if ok else next(c["detail"] for c in checks if not c["ok"])
    update: Dict[str, Any] = {"connection": connection}
    if phone_info and not doc.get("phone_number"):
        update["phone_number"] = phone_info.get("display_phone_number")
    updated = numbers.find_one_and_update({"_id": doc["_id"]}, {"$set": update}, return_document=ReturnDocument.AFTER)
    return {"ok": ok, "checks": checks, "number": serialize(updated)}


# ═══════════════════════════════════════════════════════════════════
# PRE-SAVE VERIFICATION (real Meta Graph API calls, nothing is stored)
# ═══════════════════════════════════════════════════════════════════

REQUIRED_PERMISSIONS = ("whatsapp_business_messaging", "whatsapp_business_management")


def _digits(value: Optional[str]) -> str:
    return re.sub(r"\D", "", value or "")


def classify_meta_error(e: MetaApiError) -> str:
    """Map a Meta error onto a verification status shown to the user."""
    if e.http_status is None or e.ambiguous or e.retryable or (e.http_status or 0) >= 500:
        return "network"
    if e.code in (190, 102, 2500):
        return "invalid_credentials"
    if e.code in (3, 10) or (e.code is not None and 200 <= e.code <= 299):
        return "permission"
    if e.code in (100, 803):
        return "inaccessible"
    return "failed"


def _candidate(data: dict, number_id: Optional[str]) -> tuple:
    """The configuration to verify: submitted fields merged over the saved number (when editing).
    Returns (doc, token, validation_errors)."""
    existing = None
    if number_id:
        existing = get_number(number_id)
        if not existing:
            raise NumberError("WhatsApp number not found.", 404, "number_not_found")
    doc = {**(existing or {}), **_clean(data)}
    if not doc.get("graph_api_version"):
        doc["graph_api_version"] = DEFAULT_GRAPH_VERSION
    token = (data.get("access_token") or "").strip()
    if _is_masked(token):
        token = ""
    if not token and data.get("copy_token_from"):
        source = get_number(data["copy_token_from"])
        if not source:
            raise NumberError("The number to copy the access token from was not found.")
        token = config_for(source).access_token
    if not token and existing:
        token = config_for(existing).access_token
    errors = _validate(doc, bool(token), exclude_id=existing["_id"] if existing else None)
    return doc, token, errors


async def verify_configuration(data: dict, user: Optional[str], number_id: Optional[str] = None) -> dict:
    """
    Check a number configuration against the Meta Graph API before it is saved.
    `ok` is True only when Meta confirmed the token, the phone number, the WABA and that the
    phone number belongs to that WABA. Sending and receiving messages are not exercised here.
    """
    require_admin(user)
    doc, token, errors = _candidate(data, number_id)
    result: Dict[str, Any] = {"ok": False, "checked_at": _now(), "checks": [], "meta": {}}
    if errors:
        duplicate = any("already configured" in e for e in errors)
        result.update(status="duplicate" if duplicate else "incomplete", message=" ".join(errors), errors=errors)
        return result

    base = load_config()
    client = MetaClient(MetaConfig(access_token=token, phone_number_id=doc["phone_number_id"], waba_id=doc["waba_id"],
                                   graph_version=doc["graph_api_version"], app_id=base.app_id), timeout=15.0)
    checks: List[dict] = result["checks"]
    meta: Dict[str, Any] = result["meta"]
    failure: Optional[tuple] = None  # (status, message) of the first failed required check

    def check(key: str, label: str, ok: Optional[bool], detail: str, required: bool = True, status: str = "failed"):
        nonlocal failure
        checks.append({"key": key, "label": label, "ok": ok, "detail": detail, "required": required})
        if required and ok is False and failure is None:
            failure = (status, f"{label}: {detail}")

    def meta_failed(key: str, label: str, e: MetaApiError, required: bool = True):
        check(key, label, False, str(e), required, classify_meta_error(e))

    # 1. Token — if Meta rejects it, every other call would fail the same way.
    try:
        identity = await client.get_token_identity()
        check("token", "Access token", True, f"Valid token for '{identity.get('name') or identity.get('id')}'.")
    except MetaApiError as e:
        meta_failed("token", "Access token", e)
        result.update(status=failure[0], message=failure[1])
        return result

    # 2. Permissions granted to the token (needed to send messages and manage templates / numbers).
    try:
        granted = {p.get("permission") for p in await client.get_token_permissions() if p.get("status") == "granted"}
        missing = [p for p in REQUIRED_PERMISSIONS if p not in granted]
        check("permissions", "Token permissions", not missing,
              "whatsapp_business_messaging and whatsapp_business_management are granted." if not missing
              else f"Missing permission(s): {', '.join(missing)}. Grant them to the System User in Meta Business Settings.",
              status="permission")
    except MetaApiError as e:
        check("permissions", "Token permissions", None, f"Could not be read ({e.message}); continuing with direct checks.", required=False)

    # 3. Phone Number ID
    phone_info = None
    try:
        phone_info = await client.get_phone_number()
        meta.update({k: phone_info.get(k) for k in ("display_phone_number", "verified_name", "quality_rating",
                                                     "messaging_limit_tier", "code_verification_status", "name_status")})
        check("phone", "Phone Number ID", True, f"{phone_info.get('display_phone_number')} — {phone_info.get('verified_name')}")
    except MetaApiError as e:
        meta_failed("phone", "Phone Number ID", e)

    if phone_info:
        entered, actual = _digits(doc.get("phone_number")), _digits(phone_info.get("display_phone_number"))
        matches = bool(actual) and (entered == actual or (len(entered) >= 8 and actual.endswith(entered)))
        check("phone_match", "Business phone number", matches,
              "Matches the number registered on Meta." if matches
              else f"Meta reports {phone_info.get('display_phone_number')} for this Phone Number ID, not {doc.get('phone_number')}.")

    # 4. WABA access and membership
    waba_ok = False
    try:
        waba = await client.get_waba("id,name")
        meta["waba_name"] = waba.get("name")
        waba_ok = True
        check("waba", "WhatsApp Business Account", True, f"Accessible: {waba.get('name') or doc['waba_id']}.")
    except MetaApiError as e:
        meta_failed("waba", "WhatsApp Business Account", e)

    if waba_ok:
        try:
            listed = await client.list_phone_numbers()
            in_waba = any(str(n.get("id")) == doc["phone_number_id"] for n in listed)
            check("in_waba", "Phone number belongs to WABA", in_waba,
                  "Phone number is registered on this WABA." if in_waba
                  else f"Phone Number ID {doc['phone_number_id']} is not registered on WABA {doc['waba_id']}.", status="inaccessible")
        except MetaApiError as e:
            meta_failed("in_waba", "Phone number belongs to WABA", e)

    # 5. Business Portfolio (only when given; may need business_management to read)
    if doc.get("business_portfolio_id") and waba_ok:
        try:
            owner = (await client.get_waba("owner_business_info")).get("owner_business_info") or {}
            same = str(owner.get("id") or "") == doc["business_portfolio_id"]
            meta["business_name"] = owner.get("name")
            check("portfolio", "Business Portfolio", same,
                  f"WABA is owned by portfolio {owner.get('name') or owner.get('id')}." if same
                  else f"WABA {doc['waba_id']} is owned by portfolio {owner.get('id') or 'unknown'}, not {doc['business_portfolio_id']}.")
        except MetaApiError as e:
            check("portfolio", "Business Portfolio", None, f"Ownership could not be verified ({e.message}).", required=False)

    # 6. Webhook subscription — informational; receipt of events is not tested here.
    if waba_ok:
        try:
            apps = await client.get_subscribed_apps()
            meta["webhook_subscribed"] = bool(apps)
            check("webhook", "Webhook subscription", bool(apps),
                  "An app is subscribed to this WABA's webhooks." if apps
                  else "No app is subscribed to this WABA — incoming messages and delivery statuses will not arrive until it is.",
                  required=False)
        except MetaApiError as e:
            check("webhook", "Webhook subscription", None, f"Could not be read ({e.message}).", required=False)

    others = [n for n in numbers_for_waba(doc["waba_id"]) if str(n["_id"]) != str(number_id)]
    result["same_waba_numbers"] = [n.get("display_name") for n in others]
    if failure:
        result.update(status=failure[0], message=failure[1])
    else:
        result.update(ok=True, status="verified", message="Verified with the Meta Graph API.")
    return result


def connection_from_verification(verification: dict) -> dict:
    meta = verification.get("meta") or {}
    return {
        "status": "connected" if verification.get("ok") else "error",
        "checked_at": verification.get("checked_at") or _now(),
        "message": "Verified with the Meta Graph API before saving." if verification.get("ok") else verification.get("message"),
        "in_waba": True if verification.get("ok") else None,
        "webhook_subscribed": meta.get("webhook_subscribed"),
        **{k: meta.get(k) for k in ("display_phone_number", "verified_name", "quality_rating", "messaging_limit_tier")},
    }


def save_bindings(number_id: str, workflow_key: str, binding: dict):
    numbers.update_one({"_id": ObjectId(number_id)}, {"$set": {f"automation_bindings.{workflow_key}": binding}})


# ═══════════════════════════════════════════════════════════════════
# LEGACY MIGRATION (idempotent, additive)
# ═══════════════════════════════════════════════════════════════════

def migrate_legacy_configuration() -> Optional[dict]:
    """
    Turn the pre-existing single Meta configuration (automation_settings document or environment) into
    the first number. Runs only while no number exists. The original settings document is not modified.
    """
    if numbers.count_documents({}) > 0:
        return None
    from app.config.database import automation_settings_collection
    settings = automation_settings_collection.find_one() or {}
    phone_number_id = (settings.get("phone_number_id") or "").strip() or os.getenv("META_WHATSAPP_PHONE_NUMBER_ID", "").strip()
    if not phone_number_id:
        return None
    waba_id = (settings.get("business_account_id") or "").strip() or os.getenv("META_WHATSAPP_BUSINESS_ACCOUNT_ID", "").strip()
    base = load_config()
    now = _now()
    doc = {
        "display_name": "Primary number",
        "phone_number": "",
        "phone_number_id": phone_number_id,
        "waba_id": waba_id,
        "business_portfolio_id": "",
        "purpose": "",
        "graph_api_version": base.graph_version,
        "is_active": True,
        "is_default": True,
        "legacy": True,
        "allowed_users": [],
        "automation_bindings": settings.get("automation_bindings") or {},
        "last_template_sync": settings.get("last_template_sync"),
        "connection": {"status": "unverified", "message": "Migrated from the previous single-number settings. Test the connection to verify."},
        "deleted_at": None,
        "created_at": now,
        "updated_at": now,
        "created_by": "migration",
    }
    db_token = (settings.get("api_key") or "").strip() if isinstance(settings.get("api_key"), str) else ""
    if db_token and not _is_masked(db_token):
        doc.update(access_token_enc=encrypt_secret(db_token), token_source="stored")
    else:
        doc["token_source"] = "env"
    doc["_id"] = numbers.insert_one(doc).inserted_id
    logger.info(f"[WhatsApp Numbers] Migrated legacy configuration as number {doc['_id']} (phone_number_id {phone_number_id})")
    return doc


def backfill_number_ids() -> dict:
    """
    Attach `number_id` to existing records only where the owning number is provable:
    an explicit Meta phone_number_id on the record, its send job, or its webhook event.
    Everything else stays unassigned until an administrator assigns it explicitly.
    """
    from app.config.database import (
        whatsapp_campaign_collection as campaigns, whatsapp_campaign_recipient_collection as jobs,
        whatsapp_message_collection as messages, whatsapp_webhook_event_collection as events,
        whatsapp_automation_run_collection as runs, automation_log_collection as logs,
    )
    by_pnid = {d["phone_number_id"]: str(d["_id"]) for d in numbers.find({}, {"phone_number_id": 1}) if d.get("phone_number_id")}
    counts = {}
    if not by_pnid:
        return counts
    unassigned = {"$or": [{"number_id": {"$exists": False}}, {"number_id": None}]}

    for name, coll in (("campaigns", campaigns), ("send_jobs", jobs), ("webhook_events", events)):
        n = 0
        for pnid, nid in by_pnid.items():
            n += coll.update_many({**unassigned, "phone_number_id": pnid}, {"$set": {"number_id": nid}}).modified_count
        counts[name] = n

    # Messages: via their send job, or the webhook event that carried them / their status.
    n = 0
    for msg in messages.find({**unassigned, "wamid": {"$nin": [None, ""]}}, {"_id": 1, "wamid": 1, "campaign_recipient_id": 1}):
        nid = None
        job = jobs.find_one({"wamid": msg["wamid"], "number_id": {"$nin": [None]}}, {"number_id": 1})
        if job:
            nid = job["number_id"]
        else:
            ev = events.find_one({"wamid": msg["wamid"], "phone_number_id": {"$in": list(by_pnid)}}, {"phone_number_id": 1})
            nid = by_pnid.get(ev["phone_number_id"]) if ev else None
        if nid:
            doc = numbers.find_one({"_id": ObjectId(nid)}, {"phone_number_id": 1})
            messages.update_one({"_id": msg["_id"]}, {"$set": {"number_id": nid, "phone_number_id": doc.get("phone_number_id")}})
            n += 1
    counts["messages"] = n

    n = 0
    for run in runs.find({**unassigned, "job_id": {"$nin": [None, ""]}}, {"_id": 1, "job_id": 1}):
        if ObjectId.is_valid(run["job_id"]):
            job = jobs.find_one({"_id": ObjectId(run["job_id"]), "number_id": {"$nin": [None]}}, {"number_id": 1})
            if job:
                runs.update_one({"_id": run["_id"]}, {"$set": {"number_id": job["number_id"]}})
                n += 1
    counts["automation_runs"] = n

    n = 0
    for log in logs.find({**unassigned, "metadata.automation_run_id": {"$exists": True}}, {"_id": 1, "metadata.automation_run_id": 1}):
        rid = (log.get("metadata") or {}).get("automation_run_id")
        if rid and ObjectId.is_valid(rid):
            run = runs.find_one({"_id": ObjectId(rid), "number_id": {"$nin": [None]}}, {"number_id": 1})
            if run:
                logs.update_one({"_id": log["_id"]}, {"$set": {"number_id": run["number_id"]}})
                n += 1
    counts["automation_logs"] = n
    return counts


def unassigned_counts() -> dict:
    from app.config.database import db, whatsapp_template_collection
    unassigned = {"$or": [{"number_id": {"$exists": False}}, {"number_id": None}]}
    out = {name: db[name].count_documents(unassigned) for name in SCOPED_COLLECTIONS}
    out["whatsapp_templates"] = whatsapp_template_collection.count_documents({"$or": [{"waba_id": {"$exists": False}}, {"waba_id": None}, {"waba_id": ""}]})
    out["total"] = sum(out.values())
    return out


def assign_unassigned_records(number_id: str, user: Optional[str]) -> dict:
    """Explicit administrator decision: attach all records that have no number to this number."""
    require_admin(user)
    from app.config.database import db, whatsapp_template_collection
    doc = get_number(number_id)
    if not doc:
        raise NumberError("WhatsApp number not found.", 404, "number_not_found")
    unassigned = {"$or": [{"number_id": {"$exists": False}}, {"number_id": None}]}
    result = {}
    for name in SCOPED_COLLECTIONS:
        result[name] = db[name].update_many(unassigned, {"$set": {"number_id": number_id, "number_assigned_by": user,
                                                                  "number_assigned_at": _now()}}).modified_count
    if doc.get("waba_id"):
        result["whatsapp_templates"] = whatsapp_template_collection.update_many(
            {"$or": [{"waba_id": {"$exists": False}}, {"waba_id": None}, {"waba_id": ""}]},
            {"$set": {"waba_id": doc["waba_id"]}}).modified_count
    return result


def run_startup_migration() -> dict:
    migrated = migrate_legacy_configuration()
    counts = backfill_number_ids()
    return {"migrated_number": str(migrated["_id"]) if migrated else None, "backfilled": counts}
