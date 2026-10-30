"""
Offline tests for recently used WhatsApp templates: recorded only when Meta accepts a send, newest first,
one entry per template, scoped to the selected business number (and its WABA) and the acting user.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import database
from app.whatsapp.meta_api import MetaApiError
from app.whatsapp.services import campaign_service, recent_template_service

from test_whatsapp_multi_number import FakeMeta, ADMIN, MAPPING, add_number, drain, hdr, make_template, run

OTHER = {"X-User-Email": "agent@delegatex.com"}


@pytest.fixture
def meta(monkeypatch):
    return FakeMeta(monkeypatch)


@pytest.fixture(autouse=True)
def recent_state():
    database.whatsapp_recent_template_collection.create_index(
        [("number_id", 1), ("user", 1), ("template_id", 1)], unique=True)
    campaign_service._recent_use_recorded.clear()
    yield


@pytest.fixture
def client():
    from app.whatsapp.routes import router
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def send_campaign(number, template_id, user="admin@delegatex.com", phones=("9000000001",)):
    camp = campaign_service.create_campaign({
        "name": "Recent", "template_id": template_id, "variable_mapping": MAPPING,
        "recipients": [{"name": f"R{i}", "phone": p} for i, p in enumerate(phones)],
    }, user=user, number=number)
    campaign_service.launch_campaign(camp["_id"], {"confirm_consent": True}, user=user)
    run(drain())
    return camp


def recent_ids(number, user="admin@delegatex.com"):
    return [e["template_id"] for e in recent_template_service.get_recent_templates(number, user)]


def test_successful_send_is_recorded_once_per_campaign(meta, legacy_number):
    tid = make_template("222222", "m1", "welcome")
    send_campaign(legacy_number, tid, phones=("9000000001", "9000000002", "9000000003"))
    assert len(meta.sent) == 3
    entries = recent_template_service.get_recent_templates(legacy_number, "admin@delegatex.com")
    assert [e["template_id"] for e in entries] == [tid]
    assert entries[0]["use_count"] == 1 and entries[0]["last_used_at"]


def test_reuse_moves_template_to_top_without_duplicates(meta, legacy_number):
    a, b, c = (make_template("222222", f"m{i}", f"t{i}") for i in range(3))
    for tid in (a, b, c):
        send_campaign(legacy_number, tid)
    assert recent_ids(legacy_number) == [c, b, a]
    send_campaign(legacy_number, a)
    assert recent_ids(legacy_number) == [a, c, b]
    assert database.whatsapp_recent_template_collection.count_documents({"template_id": a}) == 1
    assert database.whatsapp_recent_template_collection.find_one({"template_id": a})["use_count"] == 2


def test_only_last_ten_are_returned(meta, legacy_number):
    tids = [make_template("222222", f"m{i}", f"t{i}") for i in range(12)]
    for tid in tids:
        send_campaign(legacy_number, tid)
    assert recent_ids(legacy_number) == list(reversed(tids))[:10]


def test_failed_or_unsent_templates_are_not_recorded(meta, legacy_number):
    failed = make_template("222222", "m1", "failed")
    meta.send_errors = [MetaApiError(message="Template param mismatch", code=132000, http_status=400, retryable=False)]
    send_campaign(legacy_number, failed)
    assert database.whatsapp_campaign_recipient_collection.find_one({})["state"] == "failed"
    # Selected for a draft but never launched.
    draft = make_template("222222", "m2", "draft")
    campaign_service.create_campaign({"name": "Draft", "template_id": draft, "variable_mapping": MAPPING,
                                      "recipients": [{"name": "X", "phone": "9000000009"}]}, user="admin@delegatex.com", number=legacy_number)
    run(drain())
    assert database.whatsapp_recent_template_collection.count_documents({}) == 0


def test_automation_triggers_are_not_recorded(meta, legacy_number):
    tid = make_template("222222", "m1")
    campaign_service.enqueue_single(template_id=tid, mapping=MAPPING, recipient={"name": "A", "phone": "9000000001"},
                                    idempotency_key="auto:1", workflow="Follow-up", number=legacy_number)
    run(drain())
    assert len(meta.sent) == 1
    assert database.whatsapp_recent_template_collection.count_documents({}) == 0


def test_history_is_per_number_and_waba(meta, legacy_number):
    other = add_number("Sales", "555555", "666666", "token-c", phone="+91 90000 00003", business_portfolio_id="777777")
    main_tid = make_template("222222", "m1", "main")
    sales_tid = make_template("666666", "m2", "sales")
    send_campaign(legacy_number, main_tid)
    send_campaign(other, sales_tid)
    assert recent_ids(legacy_number) == [main_tid]
    assert recent_ids(other) == [sales_tid]
    # An entry pointing at another WABA's template is never shown.
    recent_template_service.record_template_use(template_id=sales_tid, number_id=str(legacy_number["_id"]), user="admin@delegatex.com")
    assert recent_ids(legacy_number) == [main_tid]


def test_templates_no_longer_approved_are_hidden(meta, legacy_number):
    a, b = make_template("222222", "m1", "a"), make_template("222222", "m2", "b")
    send_campaign(legacy_number, a)
    send_campaign(legacy_number, b)
    from bson import ObjectId
    database.whatsapp_template_collection.update_one({"_id": ObjectId(b)}, {"$set": {"status": "PAUSED"}})
    assert recent_ids(legacy_number) == [a]


def test_recent_endpoint_is_scoped_to_user_and_number(meta, legacy_number, client):
    tid = make_template("222222", "m1")
    send_campaign(legacy_number, tid, user="admin@delegatex.com")
    r = client.get("/api/whatsapp/templates/recent", headers=hdr(legacy_number))
    assert r.status_code == 200
    assert [e["template_id"] for e in r.json()["recent"]] == [tid]
    # Another user has their own (empty) history; the template is still searchable via /templates/sendable.
    other = client.get("/api/whatsapp/templates/recent", headers={**OTHER, "X-WhatsApp-Number-Id": str(legacy_number["_id"])})
    assert other.status_code == 200 and other.json()["recent"] == []
    sendable = client.get("/api/whatsapp/templates/sendable", headers={**OTHER, "X-WhatsApp-Number-Id": str(legacy_number["_id"])})
    assert tid in [t["_id"] for t in sendable.json()["templates"]]


def test_test_message_is_recorded_for_requesting_user(meta, legacy_number, client):
    tid = make_template("222222", "m1")
    r = client.post("/api/whatsapp/diagnostics/test-message", headers=hdr(legacy_number),
                    json={"phone": "9000000001", "template_id": tid, "variable_mapping": MAPPING})
    assert r.status_code == 200
    assert recent_ids(legacy_number, ADMIN["X-User-Email"]) == []  # queued, not yet accepted by Meta
    run(drain())
    assert recent_ids(legacy_number, ADMIN["X-User-Email"]) == [tid]
