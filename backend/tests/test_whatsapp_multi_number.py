"""
Offline tests for multiple WhatsApp Business numbers (same WABA and different WABAs).
Meta API calls are faked; each fake call records which number's credentials were used.
"""

import asyncio
import hashlib
import hmac
import json
from datetime import datetime

import pytest
from bson import ObjectId
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import database
from app.whatsapp import numbers
from app.whatsapp.meta_api import MetaApiError, MetaClient
from app.whatsapp.services import campaign_service, template_service, webhook_service, automation_service, message_service

ADMIN = {"X-User-Email": "admin@delegatex.com"}
COMPONENTS = [{"type": "BODY", "text": "Hi {{1}}, welcome.", "example": {"body_text": [["John"]]}}]
MAPPING = {"body.1": {"source": "field", "value": "name"}}


def run(coro):
    return asyncio.run(coro)


class FakeMeta:
    """Records (phone_number_id, waba_id, token, payload) for every Meta call."""

    def __init__(self, monkeypatch):
        self.sent = []
        self.listed = []
        self.templates_by_waba = {}
        self.send_errors = []
        fake = self
        counter = {"n": 0}

        async def send_message(client, payload):
            if fake.send_errors:
                raise fake.send_errors.pop(0)
            counter["n"] += 1
            fake.sent.append({"phone_number_id": client.config.phone_number_id, "token": client.config.access_token, "payload": payload})
            return {"wamid": f"wamid.M{counter['n']}", "wa_id": payload["to"]}

        async def list_templates(client):
            fake.listed.append(client.config.waba_id)
            return fake.templates_by_waba.get(client.config.waba_id, [])

        async def get_phone_number(client):
            if client.config.access_token == "bad-token":
                raise MetaApiError(message="Invalid OAuth access token", code=190, http_status=401)
            return {"id": client.config.phone_number_id, "display_phone_number": "+91 90000 0" + client.config.phone_number_id[-4:],
                    "verified_name": "Biz " + client.config.phone_number_id, "quality_rating": "GREEN"}

        async def list_phone_numbers(client):
            saved = [n["phone_number_id"] for n in database.whatsapp_number_collection.find({"waba_id": client.config.waba_id})]
            return [{"id": pnid} for pnid in saved + fake.registered.get(client.config.waba_id, [])]

        async def get_subscribed_apps(client):
            return [{"whatsapp_business_api_data": {"name": "ERP"}}]

        async def get_token_identity(client):
            if fake.network_down:
                raise MetaApiError(message="Could not connect to Meta Graph API: ConnectError", retryable=True)
            if client.config.access_token == "bad-token":
                raise MetaApiError(message="Invalid OAuth access token", code=190, http_status=401)
            return {"id": "sysuser", "name": "ERP System User"}

        async def get_token_permissions(client):
            return [{"permission": p, "status": "granted"} for p in fake.permissions]

        async def get_waba(client, fields="id,name"):
            if client.config.waba_id not in fake.wabas:
                raise MetaApiError(message="Unsupported get request. Object does not exist", code=100, subcode=33, http_status=400)
            info = fake.wabas[client.config.waba_id]
            return {"id": client.config.waba_id, "name": info["name"], "owner_business_info": {"id": info["portfolio"], "name": "Portfolio"}}

        self.registered = {}  # waba_id -> extra phone number IDs registered on Meta (not yet saved locally)
        self.wabas = {"222222": {"name": "Main WABA", "portfolio": "123456"}, "666666": {"name": "Sales WABA", "portfolio": "777777"},
                      "888888": {"name": "New WABA", "portfolio": "999000"}}
        self.permissions = ["whatsapp_business_messaging", "whatsapp_business_management"]
        self.network_down = False
        monkeypatch.setattr(MetaClient, "get_token_identity", get_token_identity)
        monkeypatch.setattr(MetaClient, "get_token_permissions", get_token_permissions)
        monkeypatch.setattr(MetaClient, "get_waba", get_waba)
        monkeypatch.setattr(MetaClient, "send_message", send_message)
        monkeypatch.setattr(MetaClient, "list_templates", list_templates)
        monkeypatch.setattr(MetaClient, "get_phone_number", get_phone_number)
        monkeypatch.setattr(MetaClient, "list_phone_numbers", list_phone_numbers)
        monkeypatch.setattr(MetaClient, "get_subscribed_apps", get_subscribed_apps)


@pytest.fixture
def meta(monkeypatch):
    return FakeMeta(monkeypatch)


@pytest.fixture
def client():
    from app.whatsapp.routes import router
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def add_number(name, phone_number_id, waba_id, token, phone="+91 90000 00000", **extra):
    return numbers.create_number({
        "display_name": name, "phone_number": phone, "phone_number_id": phone_number_id, "waba_id": waba_id,
        "access_token": token, "purpose": name, **extra,
    }, "admin@delegatex.com")


@pytest.fixture
def three(legacy_number):
    """Legacy number A (WABA 222222, env token), B in the same WABA, C in a different WABA/portfolio."""
    a = legacy_number
    b = add_number("Support", "444444", "222222", "token-b", phone="+91 90000 00002")
    c = add_number("Sales", "555555", "666666", "token-c", phone="+91 90000 00003", business_portfolio_id="777777")
    return a, b, c


def make_template(waba_id, meta_id, name="welcome"):
    return str(database.whatsapp_template_collection.insert_one({
        "name": name, "content": "Hi {{name}}, welcome.", "meta_template_name": name, "language": "en_US",
        "meta_category": "UTILITY", "status": "APPROVED", "meta_template_id": meta_id, "meta_components": COMPONENTS,
        "body_param_names": ["name"], "waba_id": waba_id, "created_at": datetime.utcnow().isoformat(),
    }).inserted_id)


async def drain():
    for _ in range(50):
        job = campaign_service._claim_job()
        if not job:
            break
        await campaign_service._process_job(job)
    campaign_service._finalize_campaigns()


def inbound_payload(phone_number_id, waba_id, wamid, sender="919811111111", text="hello"):
    return {"object": "whatsapp_business_account", "entry": [{"id": waba_id, "changes": [{"field": "messages", "value": {
        "messaging_product": "whatsapp", "metadata": {"phone_number_id": phone_number_id, "display_phone_number": "x"},
        "contacts": [{"wa_id": sender, "profile": {"name": "Ravi"}}],
        "messages": [{"from": sender, "id": wamid, "timestamp": "1700000000", "type": "text", "text": {"body": text}}]}}]}]}


def hdr(number, **extra):
    return {**ADMIN, "X-WhatsApp-Number-Id": str(number["_id"]), **extra}


@pytest.fixture(autouse=True)
def no_auto_replies(monkeypatch):
    """Inbound processing schedules intent routing; keep tests deterministic."""
    async def noop(*a, **k):
        return None
    monkeypatch.setattr(automation_service, "detect_intent_and_route", noop)


# ═══════════════════════════════════════════════════════════════════
# MIGRATION & CONFIGURATION
# ═══════════════════════════════════════════════════════════════════

def test_legacy_env_configuration_becomes_default_number(legacy_number):
    n = legacy_number
    assert n["legacy"] and n["is_default"] and n["is_active"]
    assert (n["phone_number_id"], n["waba_id"], n["token_source"]) == ("111111", "222222", "env")
    assert "access_token_enc" not in n  # env token stays in the environment
    assert numbers.config_for(n).access_token == "test-token"
    assert numbers.run_startup_migration()["migrated_number"] is None  # idempotent


def test_legacy_settings_token_is_encrypted_and_settings_doc_untouched(monkeypatch):
    database.whatsapp_number_collection.delete_many({})
    database.automation_settings_collection.insert_one({"provider": "meta_cloud", "api_key": "EAAG-legacy-secret",
                                                        "phone_number_id": "121212", "business_account_id": "343434",
                                                        "automation_bindings": {"welcome_message": {"enabled": False}}})
    doc = numbers.migrate_legacy_configuration()
    stored = database.whatsapp_number_collection.find_one({"_id": doc["_id"]})
    assert stored["phone_number_id"] == "121212" and stored["token_source"] == "stored"
    assert "EAAG-legacy-secret" not in json.dumps(stored, default=str)
    assert numbers.config_for(stored).access_token == "EAAG-legacy-secret"
    assert stored["automation_bindings"] == {"welcome_message": {"enabled": False}}
    settings = database.automation_settings_collection.find_one()
    assert settings["api_key"] == "EAAG-legacy-secret"  # original configuration not deleted


def test_backfill_assigns_only_provable_records(three):
    a, b, _ = three
    msgs = database.whatsapp_message_collection
    jobs = database.whatsapp_campaign_recipient_collection
    database.whatsapp_campaign_collection.insert_one({"name": "old", "phone_number_id": "444444"})
    jobs.insert_one({"idempotency_key": "k1", "phone_number_id": "111111", "wamid": "wamid.OLD1"})
    msgs.insert_one({"wamid": "wamid.OLD1", "direction": "outbound", "content": "x"})
    database.whatsapp_webhook_event_collection.insert_one({"dedupe_key": "message:wamid.IN1", "kind": "message",
                                                          "wamid": "wamid.IN1", "phone_number_id": "444444"})
    msgs.insert_one({"wamid": "wamid.IN1", "direction": "inbound", "content": "hi"})
    orphan = msgs.insert_one({"wamid": "wamid.UNKNOWN", "direction": "outbound", "content": "no evidence"}).inserted_id
    numbers.backfill_number_ids()
    assert msgs.find_one({"wamid": "wamid.OLD1"})["number_id"] == str(a["_id"])
    assert msgs.find_one({"wamid": "wamid.IN1"})["number_id"] == str(b["_id"])
    assert database.whatsapp_campaign_collection.find_one({"name": "old"})["number_id"] == str(b["_id"])
    assert "number_id" not in msgs.find_one({"_id": orphan})  # never guessed
    assert numbers.unassigned_counts()["whatsapp_messages"] == 1


def test_multiple_numbers_saved_independently_and_tokens_never_returned(three, client):
    a, b, c = three
    res = client.get("/api/whatsapp/numbers", headers=ADMIN).json()
    assert [n["display_name"] for n in res["numbers"]] == ["Primary number", "Support", "Sales"]
    body = json.dumps(res)
    assert "token-b" not in body and "token-c" not in body and "test-token" not in body
    assert numbers.config_for(numbers.get_number(str(b["_id"]))).access_token == "token-b"
    assert numbers.config_for(numbers.get_number(str(c["_id"]))).access_token == "token-c"
    # Editing B with the masked token keeps it; other numbers are untouched.
    masked = next(n for n in res["numbers"] if n["id"] == str(b["_id"]))["token_hint"]
    r = client.put(f"/api/whatsapp/numbers/{b['_id']}", headers=ADMIN, json={"display_name": "Support Desk", "access_token": masked})
    assert r.status_code == 200 and r.json()["number"]["display_name"] == "Support Desk"
    assert numbers.config_for(numbers.get_number(str(b["_id"]))).access_token == "token-b"
    assert numbers.get_number(str(c["_id"]))["display_name"] == "Sales"


def test_add_number_validation_and_duplicates(three, client):
    r = client.post("/api/whatsapp/numbers", headers=ADMIN, json={"display_name": "", "phone_number": "12", "waba_id": "x",
                                                                  "phone_number_id": "444444", "access_token": ""})
    assert r.status_code == 400
    msg = r.json()["detail"]["message"]
    assert "Display name is required" in msg and "WABA ID" in msg and "already configured" in msg and "Access token" in msg
    # Non-admins cannot manage numbers.
    r = client.post("/api/whatsapp/numbers", headers={"X-User-Email": "agent@x.com"}, json={
        "display_name": "X", "phone_number": "+91 9000000009", "waba_id": "222222", "phone_number_id": "888888", "access_token": "t"})
    assert r.status_code == 403


def test_test_connection_reports_real_result(three, meta, client):
    _, b, _ = three
    r = client.post(f"/api/whatsapp/numbers/{b['_id']}/test", headers=ADMIN).json()
    assert r["ok"] and r["number"]["connection"]["status"] == "connected"
    numbers.update_number(str(b["_id"]), {"access_token": "bad-token"}, "admin@delegatex.com")
    r = client.post(f"/api/whatsapp/numbers/{b['_id']}/test", headers=ADMIN).json()
    assert not r["ok"] and r["number"]["connection"]["status"] == "error"
    assert "Invalid OAuth" in r["number"]["connection"]["message"]


# ═══════════════════════════════════════════════════════════════════
# ADD NUMBER: VERIFY WITH META, THEN SAVE
# ═══════════════════════════════════════════════════════════════════

def new_number_payload(**overrides):
    # FakeMeta reports "+91 90000 0" + last 4 digits of the Phone Number ID as the registered number.
    return {"display_name": "Collections", "phone_number": "+91 90000 09999", "phone_number_id": "989999",
            "waba_id": "888888", "business_portfolio_id": "999000", "access_token": "EAAG-new-secret",
            "graph_api_version": "v22.0", "purpose": "Operations", **overrides}


def test_verify_then_save_new_number_in_another_waba(three, meta, client):
    a, b, c = three
    before = {str(n["_id"]): n for n in database.whatsapp_number_collection.find()}
    meta.registered["888888"] = ["989999"]

    v = client.post("/api/whatsapp/numbers/verify", headers=ADMIN, json=new_number_payload()).json()
    assert v["ok"] and v["status"] == "verified", v
    assert {ch["key"] for ch in v["checks"]} >= {"token", "permissions", "phone", "phone_match", "waba", "in_waba", "portfolio", "webhook"}
    assert "EAAG-new-secret" not in json.dumps(v)
    assert database.whatsapp_number_collection.count_documents({}) == len(before)  # verification stores nothing

    r = client.post("/api/whatsapp/numbers", headers=ADMIN, json=new_number_payload())
    assert r.status_code == 200, r.text
    saved = r.json()["number"]
    assert "EAAG-new-secret" not in r.text
    assert saved["connection"]["status"] == "connected" and saved["is_active"] and not saved["is_default"]
    assert saved["waba_name"] == "New WABA" and saved["business_portfolio_id"] == "999000"
    stored = numbers.get_number(saved["id"])
    assert "EAAG-new-secret" not in json.dumps(stored, default=str)
    assert numbers.config_for(stored).access_token == "EAAG-new-secret"
    assert stored["created_at"] and stored["updated_at"]

    # Existing numbers (including the primary/default) are unchanged.
    for nid, doc in before.items():
        assert database.whatsapp_number_collection.find_one({"_id": doc["_id"]}) == doc
    listed = client.get("/api/whatsapp/numbers", headers=ADMIN).json()
    assert saved["id"] in [n["id"] for n in listed["numbers"]]
    assert listed["default_number_id"] == str(a["_id"])
    # Selecting the new number (selector header) sends through it with its own credentials.
    database.automation_settings_collection.insert_one({"provider": "meta_cloud"})
    r = client.post("/api/whatsapp/messages/send", headers=hdr(stored), json={"to": "+919811111111", "message": "hi"})
    assert r.status_code == 200, r.text
    assert meta.sent[-1]["phone_number_id"] == "989999" and meta.sent[-1]["token"] == "EAAG-new-secret"
    r = client.post("/api/whatsapp/messages/send", headers=hdr(a), json={"to": "+919811111111", "message": "hi"})
    assert meta.sent[-1]["phone_number_id"] == "111111" and meta.sent[-1]["token"] == "test-token"


def test_invalid_token_is_a_real_failure_and_nothing_is_saved(three, meta, client):
    meta.registered["888888"] = ["989999"]
    v = client.post("/api/whatsapp/numbers/verify", headers=ADMIN, json=new_number_payload(access_token="bad-token")).json()
    assert not v["ok"] and v["status"] == "invalid_credentials" and "Invalid OAuth" in v["message"]
    r = client.post("/api/whatsapp/numbers", headers=ADMIN, json=new_number_payload(access_token="bad-token"))
    assert r.status_code == 400 and r.json()["detail"]["code"] == "verification_failed"
    assert numbers.get_by_phone_number_id("989999") is None


@pytest.mark.parametrize("setup, status", [
    (lambda m: None, "inaccessible"),                                            # phone not registered on the WABA
    (lambda m: m.registered.update({"888888": ["989999"]}) or m.permissions.remove("whatsapp_business_messaging"), "permission"),
    (lambda m: m.registered.update({"888888": ["989999"]}) or m.wabas.pop("888888"), "inaccessible"),
    (lambda m: setattr(m, "network_down", True), "network"),
])
def test_verification_failures_are_classified(three, meta, client, setup, status):
    setup(meta)
    v = client.post("/api/whatsapp/numbers/verify", headers=ADMIN, json=new_number_payload()).json()
    assert not v["ok"] and v["status"] == status, v
    assert client.post("/api/whatsapp/numbers", headers=ADMIN, json=new_number_payload()).status_code == 400
    assert numbers.get_by_phone_number_id("989999") is None


def test_wrong_phone_number_or_portfolio_fails_verification(three, meta, client):
    meta.registered["888888"] = ["989999"]
    v = client.post("/api/whatsapp/numbers/verify", headers=ADMIN, json=new_number_payload(phone_number="+91 91111 11111")).json()
    assert not v["ok"] and "Meta reports" in v["message"]
    v = client.post("/api/whatsapp/numbers/verify", headers=ADMIN, json=new_number_payload(business_portfolio_id="555000")).json()
    assert not v["ok"] and "owned by portfolio 999000" in v["message"]


def test_duplicate_incomplete_and_non_admin_verification(three, meta, client):
    v = client.post("/api/whatsapp/numbers/verify", headers=ADMIN, json=new_number_payload(phone_number_id="444444")).json()
    assert v["status"] == "duplicate" and "already configured" in v["message"]
    v = client.post("/api/whatsapp/numbers/verify", headers=ADMIN, json=new_number_payload(access_token="", waba_id="")).json()
    assert v["status"] == "incomplete" and "Access token" in v["message"]
    r = client.post("/api/whatsapp/numbers/verify", headers={"X-User-Email": "agent@x.com"}, json=new_number_payload())
    assert r.status_code == 403
    r = client.post("/api/whatsapp/numbers/verify", json=new_number_payload())
    assert r.status_code == 403


def test_same_waba_number_reuses_token_and_reports_shared_templates(three, meta, client):
    _, b, _ = three
    meta.registered["222222"] = ["980001"]
    payload = new_number_payload(phone_number="+91 90000 00001", phone_number_id="980001", waba_id="222222",
                                 business_portfolio_id="", access_token="", copy_token_from=str(b["_id"]))
    v = client.post("/api/whatsapp/numbers/verify", headers=ADMIN, json=payload).json()
    assert v["ok"] and set(v["same_waba_numbers"]) == {"Primary number", "Support"}
    saved = client.post("/api/whatsapp/numbers", headers=ADMIN, json=payload).json()["number"]
    assert numbers.config_for(numbers.get_number(saved["id"])).access_token == "token-b"
    assert saved["waba_id"] == "222222"


def test_verify_edit_of_saved_number_uses_stored_token(three, meta, client):
    _, b, _ = three
    edit = {"number_id": str(b["_id"]), "access_token": "••••ok-b", "phone_number": "+91 90000 04444"}
    r = client.post("/api/whatsapp/numbers/verify", headers=ADMIN, json=edit).json()
    assert r["ok"] and r["status"] == "verified", r  # duplicate check excludes the number itself
    assert "token-b" not in json.dumps(r)


# ═══════════════════════════════════════════════════════════════════
# TEMPLATES PER WABA
# ═══════════════════════════════════════════════════════════════════

def test_same_waba_numbers_share_templates_and_other_waba_is_isolated(three, client):
    a, b, c = three
    shared = make_template("222222", "9001", "shared_welcome")
    other = make_template("666666", "9002", "sales_offer")
    names = lambda n: [t["name"] for t in client.get("/api/whatsapp/templates", headers=hdr(n)).json()["templates"]]
    assert names(a) == names(b) == ["shared_welcome"]
    assert names(c) == ["sales_offer"]
    assert client.get(f"/api/whatsapp/templates/{other}", headers=hdr(a)).status_code == 404
    assert client.get(f"/api/whatsapp/templates/{shared}", headers=hdr(c)).status_code == 404
    with pytest.raises(ValueError, match="different|does not belong"):
        campaign_service.create_campaign({"name": "x", "template_id": other, "variable_mapping": MAPPING,
                                          "recipients": [{"name": "A", "phone": "9000000001"}]}, number=a)


def test_sync_uses_each_wabas_credentials_and_never_touches_other_wabas(three, meta):
    a, b, c = three
    a_tmpl = make_template("222222", "9001", "shared_welcome")
    meta.templates_by_waba = {"666666": [{"id": "9500", "name": "sales_offer", "language": "en_US", "status": "APPROVED",
                                          "category": "MARKETING", "components": COMPONENTS}]}
    summary = run(template_service.sync_templates_from_meta(c))
    assert meta.listed == ["666666"] and summary["created"] == 1 and summary["marked_deleted"] == 0
    assert database.whatsapp_template_collection.find_one({"_id": ObjectId(a_tmpl)})["status"] == "APPROVED"
    assert database.whatsapp_template_collection.find_one({"meta_template_id": "9500"})["waba_id"] == "666666"
    # Creating a template on B lands in the shared WABA (no duplicate per number).
    t = template_service.create_template({"name": "New", "content": "Hello there"}, b)
    assert t["waba_id"] == "222222"


# ═══════════════════════════════════════════════════════════════════
# SENDING
# ═══════════════════════════════════════════════════════════════════

def test_inbox_send_uses_selected_numbers_credentials(three, meta, client):
    a, b, c = three
    database.automation_settings_collection.insert_one({"provider": "meta_cloud"})
    for n, pnid, token in ((b, "444444", "token-b"), (c, "555555", "token-c"), (a, "111111", "test-token")):
        r = client.post("/api/whatsapp/messages/send", headers=hdr(n), json={"to": "+919811111111", "message": "hi"})
        assert r.status_code == 200, r.text
        assert meta.sent[-1]["phone_number_id"] == pnid and meta.sent[-1]["token"] == token
        assert r.json()["data"]["number_id"] == str(n["_id"])


def test_campaign_jobs_keep_their_number_regardless_of_ui_or_default(three, meta):
    a, b, _ = three
    tid = make_template("222222", "9001")
    camp = campaign_service.create_campaign({"name": "B camp", "template_id": tid, "variable_mapping": MAPPING,
                                             "recipients": [{"name": "A", "phone": "9000000001"}, {"name": "B", "phone": "9000000002"}]}, number=b)
    campaign_service.launch_campaign(camp["_id"], {"confirm_consent": True})
    numbers.set_default(str(a["_id"]), "admin@delegatex.com")  # UI / default changes after scheduling
    run(drain())
    assert [s["phone_number_id"] for s in meta.sent] == ["444444", "444444"]
    msg = database.whatsapp_message_collection.find_one({"campaign_id": camp["_id"]})
    assert msg["number_id"] == str(b["_id"]) and msg["phone_number_id"] == "444444"


def test_deactivated_or_removed_number_fails_safely_without_fallback(three, meta, client):
    a, b, _ = three
    database.automation_settings_collection.insert_one({"provider": "meta_cloud"})
    tid = make_template("222222", "9001")
    camp = campaign_service.create_campaign({"name": "x", "template_id": tid, "variable_mapping": MAPPING,
                                             "recipients": [{"name": "A", "phone": "9000000001"}]}, number=b)
    campaign_service.launch_campaign(camp["_id"], {"confirm_consent": True})
    # Cannot remove while messages are queued.
    assert client.delete(f"/api/whatsapp/numbers/{b['_id']}", headers=ADMIN).status_code == 409
    numbers.set_active(str(b["_id"]), False, "admin@delegatex.com")
    run(drain())
    assert meta.sent == []
    job = database.whatsapp_campaign_recipient_collection.find_one({"campaign_id": camp["_id"]})
    assert job["state"] == "failed" and "deactivated" in job["reason"]
    r = client.post("/api/whatsapp/messages/send", headers=hdr(b), json={"to": "+919811111111", "message": "hi"})
    assert r.status_code == 409 and "deactivated" in r.json()["detail"]["message"]
    # History of a deactivated number stays readable.
    assert client.get("/api/whatsapp/campaigns", headers=hdr(b)).json()["total"] == 1
    # Removing keeps records; the removed number can no longer be selected.
    assert client.delete(f"/api/whatsapp/numbers/{b['_id']}", headers=ADMIN).status_code == 200
    assert database.whatsapp_campaign_collection.count_documents({"number_id": str(b["_id"])}) == 1
    assert client.get("/api/whatsapp/campaigns", headers=hdr(b)).status_code == 404
    # Re-adding the same phone number ID restores the original configuration and its history.
    again = add_number("Support again", "444444", "222222", "token-b2")
    assert str(again["_id"]) == str(b["_id"])


def test_disconnected_number_cannot_send(three, meta):
    _, b, _ = three
    database.automation_settings_collection.insert_one({"provider": "meta_cloud"})
    numbers.update_number(str(b["_id"]), {"access_token": "bad-token"}, "admin@delegatex.com")
    run(numbers.test_connection(str(b["_id"]), "admin@delegatex.com"))
    with pytest.raises(numbers.NumberError, match="disconnected"):
        run(message_service.send_message("+919811111111", "hi", number=numbers.get_number(str(b["_id"]))))
    assert meta.sent == []


def test_token_rejected_by_meta_marks_number_disconnected(three, meta):
    _, b, _ = three
    tid = make_template("222222", "9001")
    camp = campaign_service.create_campaign({"name": "x", "template_id": tid, "variable_mapping": MAPPING,
                                             "recipients": [{"name": "A", "phone": "9000000001"}]}, number=b)
    campaign_service.launch_campaign(camp["_id"], {"confirm_consent": True})
    meta.send_errors = [MetaApiError(message="Error validating access token", code=190, http_status=401)]
    run(drain())
    assert numbers.get_number(str(b["_id"]))["connection"]["status"] == "error"


def test_simulation_mode_never_calls_meta_and_tags_number(three, meta, client):
    _, b, _ = three
    database.automation_settings_collection.insert_one({"provider": "simulation"})
    r = client.post("/api/whatsapp/messages/send", headers=hdr(b), json={"to": "+919811111111", "message": "sim"})
    assert r.status_code == 200 and meta.sent == []
    assert r.json()["data"]["number_id"] == str(b["_id"])


# ═══════════════════════════════════════════════════════════════════
# WEBHOOKS & INBOX ISOLATION
# ═══════════════════════════════════════════════════════════════════

def test_inbound_webhooks_are_stored_against_the_receiving_number(three, client):
    a, b, c = three
    webhook_service.ingest(inbound_payload("111111", "222222", "wamid.A1", text="to A"), True)
    webhook_service.ingest(inbound_payload("444444", "222222", "wamid.B1", text="to B"), True)
    webhook_service.ingest(inbound_payload("555555", "666666", "wamid.C1", text="to C"), True)
    run(webhook_service.process_pending_events())
    for n, text in ((a, "to A"), (b, "to B"), (c, "to C")):
        convs = client.get("/api/whatsapp/messages/conversations", headers=hdr(n)).json()["conversations"]
        assert len(convs) == 1 and convs[0]["last_message"]["content"] == text
        msgs = client.get(f"/api/whatsapp/messages/conversation/{convs[0]['conversation_id']}", headers=hdr(n)).json()["messages"]
        assert [m["content"] for m in msgs] == [text]  # same customer, but no cross-number history


def test_unknown_number_webhook_is_never_assigned(three):
    r = webhook_service.ingest(inbound_payload("999999", "222222", "wamid.X"), True)
    assert r["ignored"] == 1
    ev = database.whatsapp_webhook_event_collection.find_one({"wamid": "wamid.X"})
    assert ev["result"] == "ignored_unmapped_number" and not ev.get("number_id")
    run(webhook_service.process_pending_events())
    assert database.whatsapp_message_collection.count_documents({}) == 0


def test_duplicate_webhook_deliveries_process_once(three):
    p = inbound_payload("444444", "222222", "wamid.DUP")
    webhook_service.ingest(p, True)
    webhook_service.ingest(p, True)
    run(webhook_service.process_pending_events())
    webhook_service.ingest(p, True)
    run(webhook_service.process_pending_events())
    assert database.whatsapp_message_collection.count_documents({"wamid": "wamid.DUP"}) == 1


def test_status_event_for_one_number_cannot_update_another_numbers_message(three):
    a, b, _ = three
    database.whatsapp_message_collection.insert_one({"wamid": "wamid.S1", "number_id": str(a["_id"]), "status": "accepted",
                                                     "status_rank": 2, "direction": "outbound"})
    st = {"id": "wamid.S1", "status": "delivered", "timestamp": "1700000000"}
    assert run(webhook_service.apply_status_event(st, number_id=str(b["_id"]))) == "number_mismatch"
    assert database.whatsapp_message_collection.find_one({"wamid": "wamid.S1"})["status"] == "accepted"
    assert run(webhook_service.apply_status_event(st, number_id=str(a["_id"]))) == "applied"


def test_per_number_app_secret_only_authorizes_its_own_waba(three):
    _, _, c = three
    numbers.update_number(str(c["_id"]), {"app_secret": "sales-app-secret"}, "admin@delegatex.com")
    body = json.dumps(inbound_payload("555555", "666666", "wamid.SIG")).encode()
    sig = "sha256=" + hmac.new(b"sales-app-secret", body, hashlib.sha256).hexdigest()
    wabas = webhook_service.match_signature(body, sig)
    assert wabas == {"666666"}
    assert webhook_service.ingest(json.loads(body), True, signer_wabas=wabas)["stored"] == 1
    forged = inbound_payload("444444", "222222", "wamid.FORGED")
    assert webhook_service.ingest(forged, True, signer_wabas=wabas)["ignored"] == 1


# ═══════════════════════════════════════════════════════════════════
# SCOPING, PERMISSIONS, AUTOMATIONS
# ═══════════════════════════════════════════════════════════════════

def test_records_of_other_numbers_answer_404(three, client):
    a, b, _ = three
    tid = make_template("222222", "9001")
    camp = campaign_service.create_campaign({"name": "A only", "template_id": tid, "variable_mapping": MAPPING,
                                             "recipients": [{"name": "A", "phone": "9000000001"}]}, number=a)
    assert client.get(f"/api/whatsapp/campaigns/{camp['_id']}", headers=hdr(a)).status_code == 200
    assert client.get(f"/api/whatsapp/campaigns/{camp['_id']}", headers=hdr(b)).status_code == 404
    assert client.post(f"/api/whatsapp/campaigns/{camp['_id']}/launch", headers=hdr(b), json={"confirm_consent": True}).status_code == 404
    assert client.get("/api/whatsapp/campaigns", headers=hdr(b)).json()["total"] == 0
    assert client.get("/api/whatsapp/dashboard/stats", headers=hdr(b)).json()["number_id"] == str(b["_id"])


def test_restricted_number_is_hidden_and_forbidden_for_other_users(three, client):
    _, b, _ = three
    numbers.update_number(str(b["_id"]), {"allowed_users": ["support@x.com"]}, "admin@delegatex.com")
    other = {"X-User-Email": "sales@x.com"}
    ids = [n["id"] for n in client.get("/api/whatsapp/numbers", headers=other).json()["numbers"]]
    assert str(b["_id"]) not in ids
    r = client.get("/api/whatsapp/messages/conversations", headers={**other, "X-WhatsApp-Number-Id": str(b["_id"])})
    assert r.status_code == 403
    ok = client.get("/api/whatsapp/messages/conversations", headers={"X-User-Email": "support@x.com", "X-WhatsApp-Number-Id": str(b["_id"])})
    assert ok.status_code == 200


def test_invalid_selection_is_an_error_not_a_fallback(three, client):
    a, _, _ = three
    assert client.get("/api/whatsapp/messages/conversations", headers={**ADMIN, "X-WhatsApp-Number-Id": str(ObjectId())}).status_code == 404
    numbers.set_active(str(a["_id"]), False, "admin@delegatex.com")  # default cleared
    r = client.get("/api/whatsapp/messages/conversations", headers=ADMIN)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "no_default_number"


def test_automations_are_configured_and_sent_per_number(three, meta):
    a, b, c = three
    tid_ab = make_template("222222", "9001")
    tid_c = make_template("666666", "9002", "sales_welcome")
    with pytest.raises(ValueError, match="different WhatsApp Business Account"):
        automation_service.save_binding("welcome_message", {"enabled": True, "template_id": tid_c, "variable_mapping": MAPPING}, b)
    automation_service.save_binding("welcome_message", {"enabled": True, "template_id": tid_ab, "variable_mapping": MAPPING}, b)
    automation_service.save_binding("welcome_message", {"enabled": True, "template_id": tid_c, "variable_mapping": MAPPING}, c)
    lead = {"_id": "lead9", "name": "Asha", "phone": "9000000001"}
    first = run(automation_service.trigger_welcome_message(lead))
    again = run(automation_service.trigger_welcome_message(lead))
    assert sorted(r["status"] for r in first) == ["queued", "queued"]
    assert all(r.get("duplicate") for r in again)
    run(drain())
    assert sorted(s["phone_number_id"] for s in meta.sent) == ["444444", "555555"]  # A has no binding → nothing from A
    assert automation_service.list_runs(scope={"number_id": str(c["_id"])})["total"] == 1


def test_legacy_number_keeps_pre_upgrade_automation_idempotency(three, meta):
    a, _, _ = three
    database.whatsapp_automation_run_collection.insert_one({"idempotency_key": "welcome_message:lead:old1", "status": "queued"})
    tid = make_template("222222", "9001")
    automation_service.save_binding("welcome_message", {"enabled": True, "template_id": tid, "variable_mapping": MAPPING}, a)
    [res] = run(automation_service.trigger_welcome_message({"_id": "old1", "name": "Asha", "phone": "9000000001"}))
    assert res.get("duplicate") is True  # already handled before the upgrade → not sent again


def test_explicit_assignment_of_unassigned_legacy_records(three, client):
    a, _, _ = three
    database.whatsapp_message_collection.insert_one({"direction": "inbound", "content": "old", "sender_phone": "9198"})
    assert client.get("/api/whatsapp/numbers/legacy/unassigned", headers=ADMIN).json()["whatsapp_messages"] == 1
    assert client.post(f"/api/whatsapp/numbers/{a['_id']}/assign-legacy", headers=ADMIN, json={}).status_code == 400
    r = client.post(f"/api/whatsapp/numbers/{a['_id']}/assign-legacy", headers=ADMIN, json={"confirm": True})
    assert r.json()["assigned"]["whatsapp_messages"] == 1
    assert database.whatsapp_message_collection.find_one({"content": "old"})["number_id"] == str(a["_id"])
