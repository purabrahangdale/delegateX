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
    whatsapp_dnd_collection,
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
        try:
            import hashlib, re
            cleaned_phone = re.sub(r"\D", "", conversation_id or "")
            or_conditions = [{"conversation_id": conversation_id}]
            
            if cleaned_phone:
                hashed_id = hashlib.md5(cleaned_phone.encode()).hexdigest()[:16]
                or_conditions.append({"conversation_id": hashed_id})
                or_conditions.append({"recipient_phone": {"$regex": cleaned_phone}})
                or_conditions.append({"sender_phone": {"$regex": cleaned_phone}})
                
            docs = whatsapp_message_collection.find({"$or": or_conditions}).sort("created_at", 1)
            return [_serialize_doc(d) for d in docs]
        except Exception as e:
            print(f"[MongoDB Error] find_by_conversation failed: {e}", flush=True)
            return []

    @staticmethod
    def get_conversations() -> List[dict]:
        """Get the latest message per conversation for the sidebar list."""
        try:
            from app.whatsapp.services.message_service import seed_default_conversations_if_empty
            seed_default_conversations_if_empty()
        except Exception:
            pass

        try:
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
        except Exception as e:
            print(f"[MongoDB Error] get_conversations failed: {e}", flush=True)
            return []

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
        try:
            doc = whatsapp_template_collection.find_one({"_id": ObjectId(template_id)})
            return _serialize_doc(doc) if doc else None
        except Exception:
            return None

    @staticmethod
    def find_by_name(name: str) -> Optional[dict]:
        try:
            doc = whatsapp_template_collection.find_one({"name": name})
            return _serialize_doc(doc) if doc else None
        except Exception:
            return None

    @staticmethod
    def get_all(active_only: bool = False, filters: dict = None) -> List[dict]:
        try:
            query = {"is_active": True} if active_only else {}
            if filters:
                if "content_types" in filters and filters["content_types"]:
                    query["content_type"] = {"$in": filters["content_types"]}
                if "categories" in filters and filters["categories"]:
                    query["category"] = {"$in": filters["categories"]}
                if "names" in filters and filters["names"]:
                    query["name"] = {"$in": filters["names"]}
                if "search" in filters and filters["search"]:
                    q = filters["search"]
                    query["$or"] = [
                        {"name": {"$regex": q, "$options": "i"}},
                        {"category": {"$regex": q, "$options": "i"}},
                        {"content": {"$regex": q, "$options": "i"}},
                    ]
            docs = whatsapp_template_collection.find(query).sort("created_at", -1)
            return [_serialize_doc(d) for d in docs]
        except Exception as e:
            print(f"[MongoDB Error] TemplateRepository.get_all failed: {e}", flush=True)
            return []

    @staticmethod
    def get_template_names() -> List[str]:
        try:
            names = whatsapp_template_collection.distinct("name")
            return sorted([n for n in names if n])
        except Exception:
            return []

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


# ═══════════════════════════════════════════════════════════════════
# GLOBAL DND REPOSITORY
# ═══════════════════════════════════════════════════════════════════

class DNDRepository:

    @staticmethod
    def _normalize_phone(phone: str) -> str:
        """Strip non-digits and standardize phone number format."""
        import re
        cleaned = re.sub(r"\D", "", phone.strip())
        return cleaned

    @staticmethod
    def add_dnd_number(dnd_data: dict) -> dict:
        """Add a single phone number to DND collection (upsert)."""
        raw_phone = dnd_data.get("phone_number", "")
        clean_phone = DNDRepository._normalize_phone(raw_phone)
        if not clean_phone:
            raise ValueError("Invalid phone number")

        now = datetime.utcnow().isoformat()
        filter_query = {"clean_phone": clean_phone}
        update_doc = {
            "$set": {
                "phone_number": raw_phone.strip(),
                "clean_phone": clean_phone,
                "country_code": dnd_data.get("country_code", "+91"),
                "reason": dnd_data.get("reason", "User Opt-out"),
                "source": dnd_data.get("source", "Manual Entry"),
                "notes": dnd_data.get("notes"),
                "is_active": True,
                "updated_at": now,
            },
            "$setOnInsert": {
                "created_at": now,
            }
        }
        whatsapp_dnd_collection.update_one(filter_query, update_doc, upsert=True)
        doc = whatsapp_dnd_collection.find_one(filter_query)
        return _serialize_doc(doc)

    @staticmethod
    def add_bulk_dnd_numbers(items: List[dict]) -> int:
        """Bulk add or update DND numbers."""
        added_count = 0
        for item in items:
            try:
                DNDRepository.add_dnd_number(item)
                added_count += 1
            except Exception:
                continue
        return added_count

    @staticmethod
    def is_dnd(phone_number: str) -> bool:
        """Check if a phone number is currently in DND list."""
        clean_phone = DNDRepository._normalize_phone(phone_number)
        if not clean_phone:
            return False
        doc = whatsapp_dnd_collection.find_one({"clean_phone": clean_phone, "is_active": True})
        return doc is not None

    @staticmethod
    def get_dnd_list(search: Optional[str] = None, reason: Optional[str] = None, source: Optional[str] = None, skip: int = 0, limit: int = 100) -> Dict[str, Any]:
        """Fetch list of DND numbers with optional search and filters."""
        query = {"is_active": True}
        if reason and reason.lower() != "all":
            query["reason"] = reason
        if source and source.lower() != "all":
            query["source"] = source
        if search and search.strip():
            s = search.strip()
            query["$or"] = [
                {"phone_number": {"$regex": s, "$options": "i"}},
                {"clean_phone": {"$regex": s, "$options": "i"}},
                {"notes": {"$regex": s, "$options": "i"}},
            ]

        total = whatsapp_dnd_collection.count_documents(query)
        docs = whatsapp_dnd_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
        items = [_serialize_doc(d) for d in docs]
        
        # Calculate summary statistics
        total_optouts = whatsapp_dnd_collection.count_documents({"is_active": True, "source": "Inbox Keyword"})
        total_manual = whatsapp_dnd_collection.count_documents({"is_active": True, "source": "Manual Entry"})
        total_csv = whatsapp_dnd_collection.count_documents({"is_active": True, "source": "CSV Upload"})

        return {
            "items": items,
            "total": total,
            "summary": {
                "total_dnd": total,
                "total_optouts": total_optouts,
                "total_manual": total_manual,
                "total_csv": total_csv,
            }
        }

    @staticmethod
    def remove_dnd(phone_number: str) -> bool:
        """Remove (soft-delete or deactivate) a number from DND list."""
        clean_phone = DNDRepository._normalize_phone(phone_number)
        if not clean_phone:
            return False
        result = whatsapp_dnd_collection.update_one(
            {"clean_phone": clean_phone},
            {"$set": {"is_active": False, "updated_at": datetime.utcnow().isoformat()}}
        )
        return result.modified_count > 0

    @staticmethod
    def check_batch(phone_numbers: List[str]) -> Dict[str, Any]:
        """Batch verify a list of numbers against DND database."""
        clean_map = {DNDRepository._normalize_phone(p): p for p in phone_numbers if p}
        clean_phones = list(clean_map.keys())
        
        dnd_docs = whatsapp_dnd_collection.find({"clean_phone": {"$in": clean_phones}, "is_active": True})
        blocked_cleans = {doc["clean_phone"] for doc in dnd_docs}

        blocked = [clean_map[cp] for cp in blocked_cleans if cp in clean_map]
        deliverable = [p for p in phone_numbers if DNDRepository._normalize_phone(p) not in blocked_cleans]

        return {
            "total_target": len(phone_numbers),
            "blocked_count": len(blocked),
            "deliverable_count": len(deliverable),
            "blocked_numbers": blocked,
            "deliverable_numbers": deliverable,
        }

