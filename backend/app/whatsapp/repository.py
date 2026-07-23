"""
WhatsApp Automation — Repository Layer
Database CRUD operations for all WhatsApp collections.
Clean separation from business logic.
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from bson import ObjectId

from app.config.database import (
    whatsapp_message_collection,
    whatsapp_template_collection,
    automation_log_collection,
    automation_settings_collection,
)


def _serialize_doc(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serializable dict."""
    if doc and "_id" in doc:
        doc["_id"] = str(doc["_id"])
    return doc


# ═══════════════════════════════════════════════════════════════════
# MESSAGE REPOSITORY
# ═══════════════════════════════════════════════════════════════════

class MessageRepository:

    @staticmethod
    def create(message_data: dict) -> dict:
        now = datetime.utcnow().isoformat()
        message_data.setdefault("created_at", now)
        message_data.setdefault("updated_at", now)
        result = whatsapp_message_collection.insert_one(message_data)
        message_data["_id"] = str(result.inserted_id)
        return message_data

    @staticmethod
    def find_by_id(message_id: str) -> Optional[dict]:
        doc = whatsapp_message_collection.find_one({"_id": ObjectId(message_id)})
        return _serialize_doc(doc) if doc else None

    @staticmethod
    def find_by_conversation(conversation_id: str) -> List[dict]:
        docs = whatsapp_message_collection.find(
            {"conversation_id": conversation_id}
        ).sort("created_at", 1)
        return [_serialize_doc(d) for d in docs]

    @staticmethod
    def get_conversations() -> List[dict]:
        """Get the latest message per conversation for the sidebar list."""
        pipeline = [
            {"$sort": {"created_at": -1}},
            {"$group": {
                "_id": "$conversation_id",
                "last_message": {"$first": "$$ROOT"},
                "unread_count": {
                    "$sum": {"$cond": [
                        {"$and": [
                            {"$eq": ["$direction", "inbound"]},
                            {"$ne": ["$status", "read"]}
                        ]},
                        1, 0
                    ]}
                },
                "message_count": {"$sum": 1}
            }},
            {"$sort": {"last_message.created_at": -1}},
            {"$limit": 100}
        ]
        results = list(whatsapp_message_collection.aggregate(pipeline))
        conversations = []
        for r in results:
            msg = r["last_message"]
            msg["_id"] = str(msg["_id"])
            conversations.append({
                "conversation_id": r["_id"],
                "last_message": msg,
                "unread_count": r["unread_count"],
                "message_count": r["message_count"],
                "recipient": msg.get("recipient", "Unknown"),
                "recipient_phone": msg.get("recipient_phone", ""),
                "updated_at": msg.get("created_at", ""),
            })
        return conversations

    @staticmethod
    def update_status(message_id: str, status: str, timestamp_field: str = None) -> bool:
        update_data = {
            "status": status,
            "updated_at": datetime.utcnow().isoformat(),
        }
        if timestamp_field:
            update_data[timestamp_field] = datetime.utcnow().isoformat()

        result = whatsapp_message_collection.update_one(
            {"_id": ObjectId(message_id)},
            {"$set": update_data}
        )
        return result.modified_count > 0

    @staticmethod
    def get_all(limit: int = 200, skip: int = 0, filters: dict = None) -> List[dict]:
        query = filters or {}
        docs = whatsapp_message_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
        return [_serialize_doc(d) for d in docs]

    @staticmethod
    def count(filters: dict = None) -> int:
        return whatsapp_message_collection.count_documents(filters or {})

    @staticmethod
    def count_today() -> int:
        today = datetime.utcnow().strftime("%Y-%m-%d")
        return whatsapp_message_collection.count_documents({
            "created_at": {"$regex": f"^{today}"},
            "direction": "outbound"
        })

    @staticmethod
    def count_by_status(status: str) -> int:
        return whatsapp_message_collection.count_documents({"status": status})


# ═══════════════════════════════════════════════════════════════════
# TEMPLATE REPOSITORY
# ═══════════════════════════════════════════════════════════════════

class TemplateRepository:

    @staticmethod
    def create(template_data: dict) -> dict:
        now = datetime.utcnow().isoformat()
        template_data.setdefault("created_at", now)
        template_data.setdefault("updated_at", now)
        template_data.setdefault("is_active", True)
        result = whatsapp_template_collection.insert_one(template_data)
        template_data["_id"] = str(result.inserted_id)
        return template_data

    @staticmethod
    def find_by_id(template_id: str) -> Optional[dict]:
        doc = whatsapp_template_collection.find_one({"_id": ObjectId(template_id)})
        return _serialize_doc(doc) if doc else None

    @staticmethod
    def find_by_name(name: str) -> Optional[dict]:
        doc = whatsapp_template_collection.find_one({"name": name})
        return _serialize_doc(doc) if doc else None

    @staticmethod
    def get_all(active_only: bool = False) -> List[dict]:
        query = {"is_active": True} if active_only else {}
        docs = whatsapp_template_collection.find(query).sort("created_at", -1)
        return [_serialize_doc(d) for d in docs]

    @staticmethod
    def update(template_id: str, update_data: dict) -> Optional[dict]:
        update_data["updated_at"] = datetime.utcnow().isoformat()
        whatsapp_template_collection.update_one(
            {"_id": ObjectId(template_id)},
            {"$set": update_data}
        )
        return TemplateRepository.find_by_id(template_id)

    @staticmethod
    def delete(template_id: str) -> bool:
        result = whatsapp_template_collection.delete_one({"_id": ObjectId(template_id)})
        return result.deleted_count > 0

    @staticmethod
    def count() -> int:
        return whatsapp_template_collection.count_documents({})


# ═══════════════════════════════════════════════════════════════════
# AUTOMATION LOG REPOSITORY
# ═══════════════════════════════════════════════════════════════════

class AutomationLogRepository:

    @staticmethod
    def create(log_data: dict) -> dict:
        now = datetime.utcnow().isoformat()
        log_data.setdefault("execution_time", now)
        log_data.setdefault("created_at", now)
        result = automation_log_collection.insert_one(log_data)
        log_data["_id"] = str(result.inserted_id)
        return log_data

    @staticmethod
    def get_all(limit: int = 100, skip: int = 0, filters: dict = None) -> List[dict]:
        query = filters or {}
        docs = automation_log_collection.find(query).sort("execution_time", -1).skip(skip).limit(limit)
        return [_serialize_doc(d) for d in docs]

    @staticmethod
    def count(filters: dict = None) -> int:
        return automation_log_collection.count_documents(filters or {})

    @staticmethod
    def get_latest(n: int = 10) -> List[dict]:
        docs = automation_log_collection.find().sort("execution_time", -1).limit(n)
        return [_serialize_doc(d) for d in docs]

    @staticmethod
    def count_by_status(status: str) -> int:
        return automation_log_collection.count_documents({"status": status})


# ═══════════════════════════════════════════════════════════════════
# SETTINGS REPOSITORY
# ═══════════════════════════════════════════════════════════════════

class SettingsRepository:

    @staticmethod
    def get() -> dict:
        doc = automation_settings_collection.find_one()
        if not doc:
            # Seed default settings
            default = {
                "provider": "simulation",
                "webhook_url": "",
                "api_url": "",
                "api_key": "",
                "phone_number_id": "",
                "business_account_id": "",
                "is_active": True,
                "configured_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
            automation_settings_collection.insert_one(default)
            doc = automation_settings_collection.find_one()
        return _serialize_doc(doc)

    @staticmethod
    def update(update_data: dict) -> dict:
        update_data["updated_at"] = datetime.utcnow().isoformat()
        settings = automation_settings_collection.find_one()
        if settings:
            automation_settings_collection.update_one(
                {"_id": settings["_id"]},
                {"$set": update_data}
            )
        else:
            update_data["configured_at"] = datetime.utcnow().isoformat()
            automation_settings_collection.insert_one(update_data)
        
        return SettingsRepository.get()
