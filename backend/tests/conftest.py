"""
Test setup for the WhatsApp module.

* MongoDB is replaced by mongomock BEFORE app modules are imported, so tests never touch the real
  database configured in backend/.env.
* Meta configuration is overridden with test values; Meta HTTP calls are faked per test, so no
  request ever reaches graph.facebook.com.
"""

import os
import sys

TEST_ENV = {
    "DATABASE_URL": "mongodb://localhost:27017/whatsapp_tests",
    "MONGO_URL": "mongodb://localhost:27017/whatsapp_tests",
    "META_WHATSAPP_API_TOKEN": "test-token",
    "META_WHATSAPP_PHONE_NUMBER_ID": "111111",
    "META_WHATSAPP_BUSINESS_ACCOUNT_ID": "222222",
    "META_WHATSAPP_VERIFY_TOKEN": "verify-me",
    "META_WHATSAPP_API_URL": "https://graph.facebook.com/v22.0",
    "META_APP_SECRET": "test-app-secret",
    "META_APP_ID": "333333",
    "WHATSAPP_DEFAULT_COUNTRY_CODE": "91",
    "WHATSAPP_WORKER_ENABLED": "false",
    "WHATSAPP_SEND_RATE_PER_SECOND": "1000",
    # Test-only key so tests never create the server key file.
    "WHATSAPP_TOKEN_ENCRYPTION_KEY": "ZSgGZoBIOoernc6K4EhasCCquDnIVLZ26B2nzv8-LzU=",
    "WHATSAPP_ADMIN_EMAILS": "admin@delegatex.com",
}
os.environ.update(TEST_ENV)

import mongomock  # noqa: E402
import pymongo  # noqa: E402

pymongo.MongoClient = mongomock.MongoClient

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pytest  # noqa: E402


@pytest.fixture(autouse=True)
def clean_db():
    from app.config import database
    for name in database.db.list_collection_names():
        database.db.drop_collection(name)
    # Unique indexes the code relies on for idempotency (partial indexes are not emulated by mongomock).
    database.whatsapp_campaign_recipient_collection.create_index("idempotency_key", unique=True)
    database.whatsapp_webhook_event_collection.create_index("dedupe_key", unique=True)
    database.whatsapp_automation_run_collection.create_index("idempotency_key", unique=True)
    from app.whatsapp.services import campaign_service
    campaign_service._template_cache.clear()
    # The pre-multi-number configuration (env above) becomes the default "legacy" number, as on upgrade.
    from app.whatsapp import numbers
    numbers.run_startup_migration()
    yield


@pytest.fixture
def legacy_number():
    from app.whatsapp import numbers
    return numbers.default_number()
