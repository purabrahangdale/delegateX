"""
Offline tests for the WhatsApp template → campaign → send → webhook → reporting pipeline.
Meta API calls are replaced with fakes; nothing here proves the live Meta integration works.
"""

import asyncio
import hashlib
import hmac
import json
from datetime import datetime, timedelta

import pytest
from bson import ObjectId

from app.config import database
from app.whatsapp.meta_api import MetaApiError, MetaClient
from app.whatsapp.services import campaign_service, template_service, webhook_service, automation_service
from app.whatsapp import numbers


def N():
    """The default number migrated from the legacy single-number env configuration (see conftest)."""
    return numbers.default_number()

APPROVED_COMPONENTS = [
    {"type": "HEADER", "format": "TEXT", "text": "Hello {{1}}", "example": {"header_text": ["John"]}},
    {"type": "BODY", "text": "Hi {{1}}, your project {{2}} is ready.", "example": {"body_text": [["John", "Villa"]]}},
    {"type": "FOOTER", "text": "DelegateX"},
    {"type": "BUTTONS", "buttons": [{"type": "URL", "text": "Open", "url": "https://x.com/p/{{1}}", "example": ["https://x.com/p/1"]}]},
]


def run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


def make_template(status="APPROVED", meta_id="9001", **extra):
    doc = {
        "name": "Project Ready",
        "content": "Hi {{client_name}}, your project {{project_type}} is ready.",
        "meta_template_name": "project_ready",
        "language": "en_US",
        "meta_category": "UTILITY",
        "status": status,
        "meta_template_id": meta_id,
        "meta_components": APPROVED_COMPONENTS,
        "body_param_names": ["client_name", "project_type"],
        "header_param_names": ["client_name"],
        "created_at": datetime.utcnow().isoformat(),
        "waba_id": "222222",
        **extra,
    }
    if meta_id is None:
        doc.pop("meta_template_id")
    return str(database.whatsapp_template_collection.insert_one(doc).inserted_id)


MAPPING = {
    "header.1": {"source": "field", "value": "name"},
    "body.1": {"source": "field", "value": "name"},
    "body.2": {"source": "field", "value": "project_type"},
    "button.0.url": {"source": "static", "value": "abc"},
}


class FakeMeta:
    """Replaces MetaClient network methods; records sent payloads."""

    def __init__(self, monkeypatch):
        self.sent = []
        self.send_errors = []  # queue of MetaApiError to raise on next sends
        self.templates = []
        self.created = []
        counter = {"n": 0}
        fake = self

        async def send_message(self_client, payload):
            if fake.send_errors:
                raise fake.send_errors.pop(0)
            counter["n"] += 1
            fake.sent.append(payload)
            return {"wamid": f"wamid.TEST{counter['n']}", "wa_id": payload["to"]}

        async def list_templates(self_client):
            return fake.templates

        async def create_template(self_client, payload):
            fake.created.append(payload)
            return {"id": "7777", "status": "PENDING", "category": payload["category"]}

        async def get_template(self_client, template_id):
            return {"id": template_id, "name": fake.created[-1]["name"], "language": fake.created[-1]["language"],
                    "status": "PENDING", "category": fake.created[-1]["category"], "components": fake.created[-1]["components"]}

        monkeypatch.setattr(MetaClient, "send_message", send_message)
        monkeypatch.setattr(MetaClient, "list_templates", list_templates)
        monkeypatch.setattr(MetaClient, "create_template", create_template)
        monkeypatch.setattr(MetaClient, "get_template", get_template)


@pytest.fixture
def meta(monkeypatch):
    return FakeMeta(monkeypatch)


async def drain_worker(max_jobs=100):
    """Run the worker's claim/process steps synchronously until the queue is empty."""
    for _ in range(max_jobs):
        job = campaign_service._claim_job()
        if not job:
            break
        await campaign_service._process_job(job)
    campaign_service._finalize_campaigns()


# ═══════════════════════════════════════════════════════════════════
# TEMPLATES
# ═══════════════════════════════════════════════════════════════════

def test_template_draft_never_auto_approved():
    t = template_service.create_template({
        "name": "Welcome Lead", "content": "Hello {{client_name}}, welcome aboard!",
        "variable_examples": {"client_name": "John"}, "status": "APPROVED",
    }, N())
    assert t["status"] == "DRAFT"
    assert t["meta_template_name"] == "welcome_lead"
    assert not template_service.is_sendable(t)


def test_build_submission_converts_named_vars_and_requires_examples():
    tmpl = {"name": "x", "meta_template_name": "x_tpl", "language": "en_US", "meta_category": "UTILITY",
            "content": "Dear {{client_name}}, meeting on {{meeting_date}} for {{client_name}}.",
            "variable_examples": {"client_name": "John", "meeting_date": "5 May"}}
    payload, derived, errors = template_service.build_submission(tmpl)
    assert errors == []
    body = next(c for c in payload["components"] if c["type"] == "BODY")
    assert body["text"] == "Dear {{1}}, meeting on {{2}} for {{1}}."
    assert body["example"] == {"body_text": [["John", "5 May"]]}
    assert derived["body_param_names"] == ["client_name", "meeting_date"]

    tmpl["variable_examples"] = {}
    _, _, errors = template_service.build_submission(tmpl)
    assert any("Example values required" in e for e in errors)


def test_build_submission_rejects_invalid_structures():
    tmpl = {"name": "x", "meta_template_name": "x", "language": "english", "meta_category": "PROMO",
            "content": "{{client_name}} hello", "variable_examples": {"client_name": "J"},
            "response_buttons": [{"type": "share_contact", "text": "Share"}]}
    _, _, errors = template_service.build_submission(tmpl)
    joined = " | ".join(errors)
    assert "Invalid language code" in joined
    assert "Meta category" in joined
    assert "start or end with a variable" in joined
    assert "not supported" in joined


def test_submit_records_meta_id_and_pending_status(meta):
    t = template_service.create_template({"name": "Order Update", "content": "Hi {{client_name}}, your order shipped.",
                                          "variable_examples": {"client_name": "John"}}, N())
    result = run(template_service.submit_template(t["_id"], N()))
    assert result["meta_template_id"] == "7777"
    assert result["status"] == "PENDING"          # Meta's answer — not APPROVED
    assert result["meta_components"]
    assert not result["is_sendable"]
    assert meta.created[0]["name"] == "order_update"


def test_sync_links_without_duplicates_and_resets_fake_approvals(meta):
    legacy_fake = str(database.whatsapp_template_collection.insert_one(
        {"name": "Old", "content": "x", "status": "APPROVED", "meta_template_name": "old_never_on_meta", "waba_id": "222222"}).inserted_id)
    draft = str(database.whatsapp_template_collection.insert_one(
        {"name": "Project Ready", "content": "x", "status": "DRAFT", "meta_template_name": "project_ready", "language": "en_US", "waba_id": "222222"}).inserted_id)
    meta.templates = [
        {"id": "9001", "name": "project_ready", "language": "en_US", "status": "APPROVED", "category": "UTILITY", "components": APPROVED_COMPONENTS},
        {"id": "9002", "name": "hello_world", "language": "en_US", "status": "APPROVED", "category": "UTILITY",
         "components": [{"type": "BODY", "text": "Hello World"}]},
    ]
    s1 = run(template_service.sync_templates_from_meta(N()))
    s2 = run(template_service.sync_templates_from_meta(N()))
    coll = database.whatsapp_template_collection
    assert coll.count_documents({}) == 3
    assert coll.find_one({"_id": ObjectId(draft)})["status"] == "APPROVED"
    assert coll.find_one({"_id": ObjectId(draft)})["meta_template_id"] == "9001"
    assert coll.find_one({"_id": ObjectId(legacy_fake)})["status"] == "DRAFT"
    assert s1["created"] == 1 and s2["created"] == 0

    meta.templates = meta.templates[1:]  # project_ready removed on Meta
    run(template_service.sync_templates_from_meta(N()))
    assert coll.find_one({"_id": ObjectId(draft)})["status"] == "DELETED"


def test_only_approved_templates_are_sendable():
    approved = make_template()
    make_template(status="PENDING", meta_id="9101")
    make_template(status="REJECTED", meta_id="9102")
    make_template(status="PAUSED", meta_id="9103")
    ids = [t["_id"] for t in template_service.get_sendable_templates(N())]
    assert ids == [approved]
    pending = database.whatsapp_template_collection.find_one({"status": "PENDING"})
    with pytest.raises(ValueError, match="PENDING"):
        campaign_service.create_campaign({"name": "C", "template_id": str(pending["_id"]), "recipients": [{"name": "A", "phone": "9876543210"}]}, number=N())


def test_send_components_match_template_structure():
    tmpl = template_service.TemplateRepository.find_by_id(make_template())
    values = campaign_service.resolve_slot_values(template_service.get_send_slots(tmpl), MAPPING,
                                                  {"name": "Asha", "phone": "91987", "fields": {"project_type": "Villa"}})
    components, missing = template_service.build_send_components(tmpl, values)
    assert missing == []
    assert components == [
        {"type": "header", "parameters": [{"type": "text", "text": "Asha"}]},
        {"type": "body", "parameters": [{"type": "text", "text": "Asha"}, {"type": "text", "text": "Villa"}]},
        {"type": "button", "sub_type": "url", "index": "0", "parameters": [{"type": "text", "text": "abc"}]},
    ]
    _, missing = template_service.build_send_components(tmpl, {k: v for k, v in values.items() if k != "body.2"})
    assert missing == ["project_type"]


def test_template_status_webhook_updates_status():
    tid = make_template(status="APPROVED")
    assert template_service.apply_template_status_webhook({"event": "PAUSED", "message_template_id": 9001, "reason": None})
    assert database.whatsapp_template_collection.find_one({"_id": ObjectId(tid)})["status"] == "PAUSED"


# ═══════════════════════════════════════════════════════════════════
# CAMPAIGNS & WORKER
# ═══════════════════════════════════════════════════════════════════

def _campaign(recipients, template_id=None, **kw):
    return campaign_service.create_campaign({
        "name": "Spring", "template_id": template_id or make_template(), "variable_mapping": MAPPING,
        "recipients": recipients, **kw,
    }, user="admin@test", number=N())


def test_phone_normalization():
    assert campaign_service.normalize_phone("98765 43210") == "919876543210"
    assert campaign_service.normalize_phone("+1 (415) 555-0100") == "14155550100"
    assert campaign_service.normalize_phone("098765 43210") == "919876543210"
    assert campaign_service.normalize_phone("12345") is None
    assert campaign_service.normalize_phone("") is None


def test_campaign_recipient_validation():
    from app.whatsapp.repository import DNDRepository
    DNDRepository.add_dnd_number({"phone_number": "9000000003"})
    camp = _campaign([
        {"name": "Ok", "phone": "9000000001", "project_type": "Villa"},
        {"name": "Dup", "phone": "+91 90000 00001", "project_type": "Villa"},
        {"name": "BadPhone", "phone": "123", "project_type": "Villa"},
        {"name": "Dnd", "phone": "+919000000003", "project_type": "Villa"},
        {"name": "NoVar", "phone": "9000000004"},
        {"name": "NoOptIn", "phone": "9000000005", "project_type": "Villa", "opt_in": False},
    ])
    c = camp["counts"]
    assert camp["status"] == "draft"
    assert camp["summary"]["duplicates_removed"] == 1
    assert (c["total"], c["eligible"], c["invalid"], c["skipped"]) == (5, 1, 2, 2)
    reasons = {r["name"]: r["reason"] for r in campaign_service.list_recipients(camp["_id"])["recipients"]}
    assert "Missing value for: project_type" in reasons["NoVar"]
    assert "Invalid phone" in reasons["BadPhone"]


def test_create_campaign_is_idempotent_per_client_request():
    a = _campaign([{"name": "A", "phone": "9000000001", "project_type": "V"}], client_request_id="req-1")
    b = _campaign([{"name": "A", "phone": "9000000001", "project_type": "V"}], client_request_id="req-1")
    assert a["_id"] == b["_id"]
    assert database.whatsapp_campaign_collection.count_documents({}) == 1


def test_launch_requires_consent_and_is_idempotent(meta):
    camp = _campaign([{"name": "A", "phone": "9000000001", "project_type": "V"}])
    with pytest.raises(ValueError, match="opted in"):
        campaign_service.launch_campaign(camp["_id"], {})
    first = campaign_service.launch_campaign(camp["_id"], {"confirm_consent": True})
    second = campaign_service.launch_campaign(camp["_id"], {"confirm_consent": True})
    assert first["status"] == second["status"] == "queued"
    assert database.whatsapp_campaign_recipient_collection.count_documents({"state": "queued"}) == 1


def test_end_to_end_send_and_webhook_reconciliation(meta):
    camp = _campaign([
        {"name": "A", "phone": "9000000001", "project_type": "Villa"},
        {"name": "B", "phone": "9000000002", "project_type": "Flat"},
        {"name": "C", "phone": "9000000003", "project_type": "Plot"},
        {"name": "Bad", "phone": "1"},
    ])
    campaign_service.launch_campaign(camp["_id"], {"confirm_consent": True})
    run(drain_worker())

    assert len(meta.sent) == 3
    p = meta.sent[0]
    assert p["type"] == "template" and p["template"]["name"] == "project_ready" and p["template"]["language"] == {"code": "en_US"}
    assert p["to"] == "919000000001"

    c = campaign_service.get_campaign(camp["_id"])
    assert c["status"] == "completed"
    assert (c["counts"]["accepted"], c["counts"]["delivered"], c["counts"]["awaiting_status"]) == (3, 0, 3)
    assert database.whatsapp_message_collection.count_documents({"campaign_id": camp["_id"], "status": "accepted"}) == 3

    def status(wamid, st, ts, errors=None):
        s = {"id": wamid, "status": st, "timestamp": str(ts), "recipient_id": "x"}
        if errors:
            s["errors"] = errors
        return s

    run(webhook_service.apply_status_event(status("wamid.TEST1", "sent", 1000)))
    run(webhook_service.apply_status_event(status("wamid.TEST1", "read", 1003)))
    run(webhook_service.apply_status_event(status("wamid.TEST1", "delivered", 1002)))  # out of order
    run(webhook_service.apply_status_event(status("wamid.TEST2", "delivered", 1002)))
    run(webhook_service.apply_status_event(status("wamid.TEST3", "failed", 1004, [{"code": 131026, "title": "Message undeliverable"}])))
    run(webhook_service.apply_status_event(status("wamid.TEST2", "failed", 1005, [{"code": 131026}])))  # after delivered: ignored

    c = campaign_service.get_campaign(camp["_id"])["counts"]
    assert c["read"] == 1 and c["delivered"] == 2 and c["failed"] == 1 and c["accepted"] == 3
    assert c["delivery_rate"] == round(2 / 3 * 100, 1)
    job1 = database.whatsapp_campaign_recipient_collection.find_one({"wamid": "wamid.TEST1"})
    assert job1["state"] == "read" and job1["delivered_at"]  # timestamp recorded although out of order
    job3 = database.whatsapp_campaign_recipient_collection.find_one({"wamid": "wamid.TEST3"})
    assert job3["error"]["code"] == 131026
    msg = database.whatsapp_message_collection.find_one({"wamid": "wamid.TEST1"})
    assert msg["status"] == "read"
    # Aggregates reconcile with recipient-level rows
    rows = campaign_service.list_recipients(camp["_id"])["recipients"]
    assert sum(1 for r in rows if r["state"] in ("delivered", "read")) == c["delivered"]


def test_retryable_error_backs_off_and_permanent_error_does_not_retry(meta):
    camp = _campaign([{"name": "A", "phone": "9000000001", "project_type": "V"},
                      {"name": "B", "phone": "9000000002", "project_type": "V"}])
    campaign_service.launch_campaign(camp["_id"], {"confirm_consent": True})
    meta.send_errors = [
        MetaApiError(message="Rate limit", code=130429, http_status=400, retryable=True),
        MetaApiError(message="Template param mismatch", code=132000, http_status=400, retryable=False),
    ]
    run(drain_worker())
    jobs = {j["name"]: j for j in database.whatsapp_campaign_recipient_collection.find({"campaign_id": camp["_id"]})}
    assert jobs["A"]["state"] == "queued" and jobs["A"]["next_attempt_at"] > datetime.utcnow().isoformat()
    assert jobs["B"]["state"] == "failed" and jobs["B"]["attempts"] == 1
    assert meta.sent == []
    # Retry becomes due → sent once, permanent failure untouched.
    database.whatsapp_campaign_recipient_collection.update_one({"_id": jobs["A"]["_id"]}, {"$set": {"next_attempt_at": "2000-01-01"}})
    run(drain_worker())
    assert len(meta.sent) == 1
    assert campaign_service.get_campaign(camp["_id"])["status"] == "partially_failed"


def test_ambiguous_timeout_and_crashed_worker_are_never_resent(meta):
    camp = _campaign([{"name": "A", "phone": "9000000001", "project_type": "V"},
                      {"name": "B", "phone": "9000000002", "project_type": "V"}])
    campaign_service.launch_campaign(camp["_id"], {"confirm_consent": True})
    meta.send_errors = [MetaApiError(message="timeout", ambiguous=True)]
    job = campaign_service._claim_job()
    run(campaign_service._process_job(job))
    # Simulate a worker that died after claiming the second job.
    crashed = campaign_service._claim_job()
    database.whatsapp_campaign_recipient_collection.update_one({"_id": crashed["_id"]}, {"$set": {"lease_until": "2000-01-01"}})
    campaign_service._recover_stale_leases()
    run(drain_worker())
    states = sorted(j["state"] for j in database.whatsapp_campaign_recipient_collection.find({"campaign_id": camp["_id"]}))
    assert states == ["unknown", "unknown"]
    assert meta.sent == []


def test_failed_jobs_without_wamid_can_be_requeued_once(meta):
    camp = _campaign([{"name": "A", "phone": "9000000001", "project_type": "V"}])
    campaign_service.launch_campaign(camp["_id"], {"confirm_consent": True})
    meta.send_errors = [MetaApiError(message="perm", code=100, retryable=False)]
    run(drain_worker())
    out = campaign_service.retry_failed(camp["_id"])
    assert out["requeued"] == 1
    run(drain_worker())
    assert len(meta.sent) == 1
    assert campaign_service.retry_failed(camp["_id"])["requeued"] == 0


def test_template_paused_after_launch_blocks_sending(meta):
    tid = make_template()
    camp = _campaign([{"name": "A", "phone": "9000000001", "project_type": "V"}], template_id=tid)
    campaign_service.launch_campaign(camp["_id"], {"confirm_consent": True})
    template_service.apply_template_status_webhook({"event": "PAUSED", "message_template_id": "9001"})
    run(drain_worker())
    assert meta.sent == []
    assert campaign_service.get_campaign(camp["_id"])["counts"]["failed"] == 1


def test_scheduled_campaign_waits_then_runs(meta):
    camp = _campaign([{"name": "A", "phone": "9000000001", "project_type": "V"}])
    future = (datetime.utcnow() + timedelta(hours=2)).isoformat() + "Z"
    c = campaign_service.launch_campaign(camp["_id"], {"confirm_consent": True, "scheduled_at": future})
    assert c["status"] == "scheduled"
    campaign_service._promote_scheduled()
    run(drain_worker())
    assert meta.sent == []
    database.whatsapp_campaign_collection.update_one({"_id": ObjectId(camp["_id"])}, {"$set": {"schedule.scheduled_at": "2000-01-01T00:00:00"}})
    campaign_service._promote_scheduled()
    run(drain_worker())
    assert len(meta.sent) == 1


def test_cancel_only_affects_unsent_messages(meta):
    camp = _campaign([{"name": "A", "phone": "9000000001", "project_type": "V"},
                      {"name": "B", "phone": "9000000002", "project_type": "V"}])
    campaign_service.launch_campaign(camp["_id"], {"confirm_consent": True})
    job = campaign_service._claim_job()
    run(campaign_service._process_job(job))  # one accepted
    out = campaign_service.cancel_campaign(camp["_id"])
    assert out["cancelled_jobs"] == 1
    assert out["status"] == "cancelled"
    assert out["counts"]["accepted"] == 1 and out["counts"]["cancelled"] == 1
    run(drain_worker())
    assert len(meta.sent) == 1


# ═══════════════════════════════════════════════════════════════════
# WEBHOOKS
# ═══════════════════════════════════════════════════════════════════

def _status_payload(wamid, status, ts="1700000000", phone_number_id="111111"):
    return {"object": "whatsapp_business_account", "entry": [{"id": "222222", "changes": [{"field": "messages", "value": {
        "messaging_product": "whatsapp", "metadata": {"phone_number_id": phone_number_id},
        "statuses": [{"id": wamid, "status": status, "timestamp": ts, "recipient_id": "91900"}]}}]}]}


def test_signature_validation():
    body = b'{"a":1}'
    good = "sha256=" + hmac.new(b"test-app-secret", body, hashlib.sha256).hexdigest()
    assert webhook_service.verify_signature(body, good)
    assert not webhook_service.verify_signature(body + b" ", good)
    assert not webhook_service.verify_signature(body, "sha256=deadbeef")
    assert not webhook_service.verify_signature(body, None)


def test_duplicate_webhook_deliveries_are_ignored():
    p = _status_payload("wamid.X", "delivered")
    assert webhook_service.ingest(p, True) == {"stored": 1, "duplicates": 0, "ignored": 0}
    assert webhook_service.ingest(p, True) == {"stored": 0, "duplicates": 1, "ignored": 0}
    # Multi-number: a phone number ID that is not configured is ignored even when its WABA is known —
    # it is never attributed to another number of that WABA.
    assert webhook_service.ingest(_status_payload("wamid.Y", "sent", phone_number_id="999"), True)["ignored"] == 1
    other = _status_payload("wamid.Z", "sent", phone_number_id="999")
    other["entry"][0]["id"] = "888"
    assert webhook_service.ingest(other, True)["ignored"] == 1


def test_status_arriving_before_wamid_is_stored_is_applied_later(meta):
    camp = _campaign([{"name": "A", "phone": "9000000001", "project_type": "V"}])
    campaign_service.launch_campaign(camp["_id"], {"confirm_consent": True})
    webhook_service.ingest(_status_payload("wamid.TEST1", "delivered"), True)
    run(webhook_service.process_pending_events())
    ev = database.whatsapp_webhook_event_collection.find_one({"wamid": "wamid.TEST1"})
    assert ev["processed"] is False and ev["result"] == "no_match"

    async def send_then_process():
        await drain_worker()  # stores wamid.TEST1 and re-triggers buffered events
        await webhook_service.process_pending_events(wamid="wamid.TEST1")
    run(send_then_process())
    assert database.whatsapp_campaign_recipient_collection.find_one({"wamid": "wamid.TEST1"})["state"] == "delivered"


def test_webhook_http_endpoints():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.whatsapp.routes import router
    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    ok = client.get("/api/whatsapp/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "42"})
    assert ok.status_code == 200 and ok.text == "42"
    assert client.get("/api/whatsapp/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "42"}).status_code == 403

    body = json.dumps(_status_payload("wamid.Q", "sent")).encode()
    bad = client.post("/api/whatsapp/webhook", content=body, headers={"X-Hub-Signature-256": "sha256=00", "Content-Type": "application/json"})
    assert bad.status_code == 401
    sig = "sha256=" + hmac.new(b"test-app-secret", body, hashlib.sha256).hexdigest()
    good = client.post("/api/whatsapp/webhook", content=body, headers={"X-Hub-Signature-256": sig, "Content-Type": "application/json"})
    assert good.status_code == 200 and good.json()["stored"] == 1
    again = client.post("/api/whatsapp/webhook", content=body, headers={"X-Hub-Signature-256": sig, "Content-Type": "application/json"})
    assert again.json()["duplicates"] == 1


def test_dashboard_stats_use_real_outcomes(meta):
    from app.whatsapp.services.message_service import get_dashboard_stats
    empty = get_dashboard_stats()["outcomes_30d"]
    assert empty["accepted"] == 0 and empty["delivery_rate"] is None  # no invented rates
    camp = _campaign([{"name": "A", "phone": "9000000001", "project_type": "V"},
                      {"name": "B", "phone": "9000000002", "project_type": "V"}])
    campaign_service.launch_campaign(camp["_id"], {"confirm_consent": True})
    run(drain_worker())
    run(webhook_service.apply_status_event({"id": "wamid.TEST1", "status": "delivered", "timestamp": "1700000000"}))
    o = get_dashboard_stats()["outcomes_30d"]
    assert (o["accepted"], o["delivered"], o["delivery_rate"]) == (2, 1, 50.0)


# ═══════════════════════════════════════════════════════════════════
# AUTOMATIONS
# ═══════════════════════════════════════════════════════════════════

def test_automation_without_binding_is_skipped_not_sent(meta):
    # No number has the automation enabled → nothing runs and nothing is queued.
    assert run(automation_service.trigger_welcome_message({"_id": "lead1", "name": "Asha", "phone": "9000000001"})) == []
    assert database.whatsapp_campaign_recipient_collection.count_documents({}) == 0


def test_automation_duplicate_trigger_sends_once(meta):
    tid = make_template()
    automation_service.save_binding("welcome_message", {"enabled": True, "template_id": tid, "variable_mapping": {
        "header.1": {"source": "field", "value": "first_name"},
        "body.1": {"source": "field", "value": "name"},
        "body.2": {"source": "field", "value": "project_type"},
        "button.0.url": {"source": "static", "value": "welcome"},
    }}, N())
    lead = {"_id": "lead1", "name": "Asha Rao", "phone": "9000000001", "projectType": "Villa"}
    [r1] = run(automation_service.trigger_welcome_message(lead))
    [r2] = run(automation_service.trigger_welcome_message(lead))
    assert r1["status"] == "queued"
    assert r2.get("duplicate") is True
    run(drain_worker())
    assert len(meta.sent) == 1
    assert meta.sent[0]["template"]["components"][0]["parameters"][0]["text"] == "Asha"
    runs = automation_service.list_runs()["runs"]
    assert len(runs) == 1 and runs[0]["message_state"] == "accepted"


def test_binding_requires_approved_template_and_full_mapping():
    pending = make_template(status="PENDING", meta_id="9201")
    with pytest.raises(ValueError, match="APPROVED"):
        automation_service.save_binding("welcome_message", {"enabled": True, "template_id": pending}, N())
    approved = make_template(meta_id="9202")
    with pytest.raises(ValueError, match="Map every template variable"):
        automation_service.save_binding("welcome_message", {"enabled": True, "template_id": approved, "variable_mapping": {}}, N())
