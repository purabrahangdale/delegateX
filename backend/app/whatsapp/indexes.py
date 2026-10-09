"""
WhatsApp Automation — MongoDB indexes (idempotent; safe to run on every startup).
Only additive: no collection is dropped or rewritten.
"""

import logging

from pymongo import ASCENDING, DESCENDING

from app.config.database import (
    whatsapp_template_collection,
    whatsapp_message_collection,
    whatsapp_campaign_collection,
    whatsapp_campaign_recipient_collection,
    whatsapp_webhook_event_collection,
    whatsapp_automation_run_collection,
    whatsapp_number_collection,
    automation_log_collection,
    chat_access_log_collection,
)

logger = logging.getLogger("whatsapp.indexes")

# Null / missing values are excluded from the unique indexes; empty strings are never stored for these keys.
NON_EMPTY_STRING = {"$type": "string"}

INDEXES = [
    # Templates: one local record per Meta template ID
    (whatsapp_template_collection, [("meta_template_id", ASCENDING)], {"name": "uniq_meta_template_id", "unique": True, "partialFilterExpression": {"meta_template_id": NON_EMPTY_STRING}}),
    (whatsapp_template_collection, [("meta_template_name", ASCENDING), ("language", ASCENDING)], {"name": "meta_name_language"}),
    (whatsapp_template_collection, [("status", ASCENDING)], {"name": "status"}),

    # Messages: status webhooks look up by wamid
    (whatsapp_message_collection, [("wamid", ASCENDING)], {"name": "wamid"}),
    (whatsapp_message_collection, [("campaign_id", ASCENDING)], {"name": "campaign_id", "sparse": True}),

    # Campaigns
    (whatsapp_campaign_collection, [("status", ASCENDING), ("schedule.scheduled_at", ASCENDING)], {"name": "status_schedule"}),
    (whatsapp_campaign_collection, [("created_at", DESCENDING)], {"name": "created_at"}),
    (whatsapp_campaign_collection, [("client_request_id", ASCENDING)], {"name": "uniq_client_request_id", "unique": True, "partialFilterExpression": {"client_request_id": NON_EMPTY_STRING}}),

    # Recipient send jobs
    (whatsapp_campaign_recipient_collection, [("idempotency_key", ASCENDING)], {"name": "uniq_idempotency_key", "unique": True}),
    (whatsapp_campaign_recipient_collection, [("wamid", ASCENDING)], {"name": "uniq_wamid", "unique": True, "partialFilterExpression": {"wamid": NON_EMPTY_STRING}}),
    (whatsapp_campaign_recipient_collection, [("state", ASCENDING), ("next_attempt_at", ASCENDING)], {"name": "claim_queue"}),
    (whatsapp_campaign_recipient_collection, [("campaign_id", ASCENDING), ("state", ASCENDING)], {"name": "campaign_state"}),
    (whatsapp_campaign_recipient_collection, [("automation_run_id", ASCENDING)], {"name": "automation_run", "sparse": True}),

    # Webhook events: dedupe + processing queue + retention
    (whatsapp_webhook_event_collection, [("dedupe_key", ASCENDING)], {"name": "uniq_dedupe_key", "unique": True}),
    (whatsapp_webhook_event_collection, [("processed", ASCENDING), ("next_attempt_at", ASCENDING)], {"name": "pending"}),
    (whatsapp_webhook_event_collection, [("wamid", ASCENDING)], {"name": "wamid", "sparse": True}),
    (whatsapp_webhook_event_collection, [("kind", ASCENDING), ("received_at", DESCENDING)], {"name": "kind_received"}),
    (whatsapp_webhook_event_collection, [("expire_at", ASCENDING)], {"name": "ttl_expire_at", "expireAfterSeconds": 0}),

    # Automation runs: one run per trigger idempotency key
    (whatsapp_automation_run_collection, [("idempotency_key", ASCENDING)], {"name": "uniq_idempotency_key", "unique": True}),
    (whatsapp_automation_run_collection, [("created_at", DESCENDING)], {"name": "created_at"}),

    # Business numbers (uniqueness of live phone number IDs is validated in app.whatsapp.numbers)
    (whatsapp_number_collection, [("phone_number_id", ASCENDING)], {"name": "phone_number_id"}),
    (whatsapp_number_collection, [("waba_id", ASCENDING)], {"name": "waba_id"}),

    # Number-scoped queries (inbox, dashboards, reports, logs)
    (whatsapp_message_collection, [("number_id", ASCENDING), ("conversation_id", ASCENDING), ("created_at", DESCENDING)], {"name": "number_conversation"}),
    (whatsapp_message_collection, [("number_id", ASCENDING), ("direction", ASCENDING), ("created_at", DESCENDING)], {"name": "number_direction_created"}),
    (whatsapp_template_collection, [("waba_id", ASCENDING), ("status", ASCENDING)], {"name": "waba_status"}),
    (whatsapp_campaign_collection, [("number_id", ASCENDING), ("created_at", DESCENDING)], {"name": "number_created_at"}),
    (whatsapp_campaign_recipient_collection, [("number_id", ASCENDING), ("state", ASCENDING)], {"name": "number_state"}),
    (whatsapp_webhook_event_collection, [("number_id", ASCENDING), ("kind", ASCENDING), ("received_at", DESCENDING)], {"name": "number_kind_received"}),
    (whatsapp_automation_run_collection, [("number_id", ASCENDING), ("created_at", DESCENDING)], {"name": "number_created_at"}),
    (automation_log_collection, [("number_id", ASCENDING), ("execution_time", DESCENDING)], {"name": "number_execution_time"}),
    (chat_access_log_collection, [("number_id", ASCENDING), ("chat_opened_at", DESCENDING)], {"name": "number_opened_at"}),
]


def ensure_indexes() -> list:
    """Create indexes; returns a list of failures (an index failing never blocks startup)."""
    failures = []
    for collection, keys, opts in INDEXES:
        try:
            collection.create_index(keys, **opts)
        except Exception as e:
            failures.append(f"{collection.name}.{opts.get('name')}: {e}")
            logger.warning(f"[WhatsApp Indexes] Could not create {collection.name}.{opts.get('name')}: {e}")
    return failures
