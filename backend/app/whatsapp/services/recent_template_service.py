"""
WhatsApp Automation — Recently used templates

Data model
  whatsapp_recent_templates   one entry per (number_id, user, template_id): a reference to the local
                              template record plus `last_used_at` / `use_count`. Template content is
                              never copied — it is read from whatsapp_templates when listed.

An entry is written only when Meta accepted a template message (the send worker got a wamid), so
selecting a template, or a send that fails, never changes the history. Using a template again moves it
to the top (same entry, newer timestamp). Listing returns only templates that are still approved in
the selected number's WhatsApp Business Account.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from app.config.database import whatsapp_recent_template_collection as recent
from app.whatsapp.services import template_service

logger = logging.getLogger("whatsapp.recent_templates")

RECENT_LIMIT = 10
# Entries read before filtering out templates that are no longer sendable.
_SCAN_LIMIT = 50


def _user_key(user: Optional[str]) -> str:
    return (user or "").strip().lower()


def record_template_use(*, template_id: str, number_id: Optional[str], user: Optional[str], used_at: Optional[str] = None) -> None:
    """Mark `template_id` as just used by `user` on `number_id`. Never raises — tracking must not affect sending."""
    if not template_id or not number_id:
        return
    used_at = used_at or datetime.now(timezone.utc).isoformat()
    key = {"number_id": str(number_id), "user": _user_key(user), "template_id": str(template_id)}
    update = {
        "$max": {"last_used_at": used_at},
        "$inc": {"use_count": 1},
        "$setOnInsert": {"created_at": used_at},
    }
    try:
        try:
            recent.update_one(key, update, upsert=True)
        except DuplicateKeyError:
            # Two workers inserted the same entry at once; the other insert won, so update it.
            recent.update_one(key, update)
    except Exception as e:
        logger.warning(f"[Recent Templates] Could not record template {template_id} for number {number_id}: {e}")


def get_recent_templates(number: Optional[dict], user: Optional[str], limit: int = RECENT_LIMIT) -> List[dict]:
    """The user's most recently used templates on `number` that are still approved, newest first."""
    if not number:
        return []
    entries = list(
        recent.find({"number_id": str(number["_id"]), "user": _user_key(user)}, {"_id": 0, "template_id": 1, "last_used_at": 1, "use_count": 1})
        .sort("last_used_at", -1)
        .limit(_SCAN_LIMIT)
    )
    ids = [ObjectId(e["template_id"]) for e in entries if ObjectId.is_valid(e["template_id"])]
    if not ids:
        return []
    sendable = {
        str(d["_id"])
        for d in template_service.get_collection().find(
            {"_id": {"$in": ids}, **template_service.waba_match(number),
             "meta_template_id": {"$nin": [None, ""]}, "status": {"$in": list(template_service.SENDABLE_STATUSES)}},
            {"_id": 1},
        )
    }
    return [e for e in entries if e["template_id"] in sendable][:limit]
