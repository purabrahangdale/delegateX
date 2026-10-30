"""
Offline tests for the per-number STOP / YES keyword auto-replies (Settings → Keyword-Based Auto-Replies).
Only the Meta HTTP call and the LLM are faked; the inbound pipeline, DND list and CRM writes are real (mongomock).
"""

import asyncio
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import database
from app.whatsapp import numbers
from app.whatsapp.meta_api import MetaClient
from app.whatsapp.repository import DNDRepository
from app.whatsapp.services import automation_service, webhook_service

ADMIN = {"X-User-Email": "admin@delegatex.com"}
STOP_TEXT = "You are unsubscribed, {first_name}."
YES_TEXT = "Thanks {first_name}! Our team will call you."
GENERIC_TEXT = "generic customer auto-reply"


@pytest.fixture
def client():
    from app.whatsapp.routes import router
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def hdr(number):
    return {**ADMIN, "X-WhatsApp-Number-Id": str(number["_id"])}


@pytest.fixture
def meta(monkeypatch):
    box = {"payloads": [], "ai": []}

    async def send(client, payload):
        box["payloads"].append(payload)
        return {"wamid": f"wamid.OUT{len(box['payloads'])}", "wa_id": payload["to"]}

    async def ai_bot(incoming):
        box["ai"].append(incoming)
        return None

    monkeypatch.setattr(MetaClient, "send_message", send)
    monkeypatch.setattr(automation_service, "trigger_ai_faq_bot", ai_bot)
    return box


def webhook(wamid, text, name="Ravi Kumar", sender="919811111111", button=False):
    msg = {"from": sender, "id": wamid, "timestamp": str(int(time.time()))}
    if button:
        msg.update(type="button", button={"text": text, "payload": text})
    else:
        msg.update(type="text", text={"body": text})
    return {"object": "whatsapp_business_account", "entry": [{"id": "222222", "changes": [{"field": "messages", "value": {
        "messaging_product": "whatsapp", "metadata": {"phone_number_id": "111111", "display_phone_number": "x"},
        "contacts": [{"wa_id": sender, "profile": {"name": name}}], "messages": [msg]}}]}]}


def deliver(*payloads):
    async def go():
        for p in payloads:
            webhook_service.ingest(p, True)
        await webhook_service.process_pending_events()
        pending = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
        await asyncio.gather(*pending)
    asyncio.run(go())


def bodies(meta):
    return [p["text"]["body"] for p in meta["payloads"]]


def configure(client, number, stop=None, yes=None, generic=None):
    h = hdr(number)
    if stop is not None:
        assert client.put("/api/whatsapp/keyword-auto-replies/stop", json={"enabled": stop, "message": STOP_TEXT}, headers=h).status_code == 200
    if yes is not None:
        assert client.put("/api/whatsapp/keyword-auto-replies/yes", json={"enabled": yes, "message": YES_TEXT}, headers=h).status_code == 200
    if generic is not None:
        assert client.put("/api/whatsapp/auto-reply", json={"enabled": generic, "message": GENERIC_TEXT}, headers=h).status_code == 200


def lead(phone="+91 98111-11111", status="New", name="Ravi Kumar"):
    return database.crm_lead_collection.insert_one({"name": name, "phone": phone, "status": status}).inserted_id


# ── Settings API & persistence ──

def test_defaults_are_off_with_suggested_text(client, legacy_number):
    r = client.get("/api/whatsapp/keyword-auto-replies", headers=hdr(legacy_number)).json()["keyword_auto_replies"]
    assert r["stop"]["enabled"] is False and r["yes"]["enabled"] is False
    assert r["stop"]["message"].startswith("You have been successfully unsubscribed")
    assert r["yes"]["message"].startswith("Thank you for showing interest")
    assert r["stop"]["updated_at"] is None


def test_each_keyword_saves_independently(client, legacy_number):
    h = hdr(legacy_number)
    configure(client, legacy_number, generic=True)
    r = client.put("/api/whatsapp/keyword-auto-replies/stop", json={"enabled": True, "message": "  Bye {name}  "}, headers=h)
    assert r.status_code == 200 and r.json()["keyword_auto_reply"]["message"] == "Bye {name}"

    saved = client.get("/api/whatsapp/keyword-auto-replies", headers=h).json()["keyword_auto_replies"]  # page refresh
    assert saved["stop"] == {**saved["stop"], "enabled": True, "message": "Bye {name}", "updated_by": "admin@delegatex.com"}
    assert saved["yes"]["enabled"] is False and saved["yes"]["updated_at"] is None  # untouched
    doc = numbers.get_number(str(legacy_number["_id"]))
    assert set(doc["keyword_auto_replies"]) == {"stop"}  # one sub-document per keyword, no duplicates
    assert doc["customer_auto_reply"]["message"] == GENERIC_TEXT  # existing auto-reply not overwritten

    client.put("/api/whatsapp/keyword-auto-replies/stop", json={"enabled": False, "message": "Bye {name}"}, headers=h)
    assert numbers.get_number(str(legacy_number["_id"]))["keyword_auto_replies"]["stop"]["message"] == "Bye {name}"


def test_validation(client, legacy_number):
    h = hdr(legacy_number)
    assert client.put("/api/whatsapp/keyword-auto-replies/yes", json={"enabled": True, "message": "  "}, headers=h).status_code == 400
    assert client.put("/api/whatsapp/keyword-auto-replies/maybe", json={"enabled": False}, headers=h).status_code == 404
    assert client.put("/api/whatsapp/keyword-auto-replies/yes", json={"enabled": False, "message": "x" * 4097}, headers=h).status_code == 422


def test_keyword_matching():
    for text, key in [("STOP", "stop"), (" stop ", "stop"), ("Stop.", "stop"), ("yes", "yes"), ("Yes!", "yes"), ("YES", "yes")]:
        assert automation_service.reply_keyword(text) == key
    for text in ["yes please", "stop it now", "yesterday", "nonstop", "", None]:
        assert automation_service.reply_keyword(text) is None


# ── Toggle matrix through the real webhook pipeline ──

@pytest.mark.parametrize("stop_on,yes_on", [(True, True), (True, False), (False, True), (False, False)])
def test_toggle_matrix(meta, legacy_number, client, stop_on, yes_on):
    configure(client, legacy_number, stop=stop_on, yes=yes_on)
    deliver(webhook("wamid.Y1", "YES", sender="919822222222", name="Asha Rao"))
    deliver(webhook("wamid.S1", "STOP"))
    expected = (["Thanks Asha! Our team will call you."] if yes_on else []) + (["You are unsubscribed, Ravi."] if stop_on else [])
    assert bodies(meta) == expected
    assert DNDRepository.is_dnd("919811111111")  # opt-out recorded regardless of the toggle
    assert meta["ai"] == []


# ── STOP ──

def test_stop_reply_is_the_only_message_and_gets_past_dnd(meta, legacy_number, client):
    configure(client, legacy_number, stop=True, generic=True)
    deliver(webhook("wamid.S1", "stop"))
    assert bodies(meta) == ["You are unsubscribed, Ravi."]
    stored = list(database.whatsapp_message_collection.find({"direction": "outbound"}))
    assert [m["automation_workflow"] for m in stored] == ["STOP Auto-Reply"]
    assert stored[0]["number_id"] == str(legacy_number["_id"])


def test_after_stop_no_other_automation_reaches_the_contact(meta, legacy_number, client):
    configure(client, legacy_number, stop=True, yes=True, generic=True)
    deliver(webhook("wamid.S1", "STOP"))
    deliver(webhook("wamid.H1", "Hello"), webhook("wamid.A1", "AGENT"), webhook("wamid.Y1", "YES"))
    assert bodies(meta) == ["You are unsubscribed, Ravi."]


def test_stop_off_sends_nothing_not_even_the_generic_reply(meta, legacy_number, client):
    configure(client, legacy_number, stop=False, generic=True)
    deliver(webhook("wamid.S1", "STOP"))
    assert meta["payloads"] == []
    assert DNDRepository.is_dnd("919811111111")
    assert database.whatsapp_message_collection.count_documents({"direction": "inbound", "wamid": "wamid.S1"}) == 1


def test_stop_redelivery_replies_once(meta, legacy_number, client):
    configure(client, legacy_number, stop=True)
    deliver(webhook("wamid.S1", "STOP"), webhook("wamid.S1", "STOP"))
    deliver(webhook("wamid.S1", "STOP"))
    assert len(meta["payloads"]) == 1


# ── YES ──

def test_yes_replaces_generic_reply_and_marks_lead_interested(meta, legacy_number, client):
    configure(client, legacy_number, yes=True, generic=True)
    lead_id = lead()
    deliver(webhook("wamid.Y1", "Yes", button=True))  # quick-reply button
    assert bodies(meta) == ["Thanks Ravi! Our team will call you."]
    doc = database.crm_lead_collection.find_one({"_id": lead_id})
    assert doc["status"] == "Interested"
    assert doc["whatsappResponse"]["keyword"] == "YES" and doc["whatsappResponse"]["number_id"] == str(legacy_number["_id"])
    # The status is written directly: the Lead Status Update automation sends nothing extra.
    assert database.whatsapp_automation_run_collection.count_documents({}) == 0


def test_yes_keeps_converted_and_lost_leads(meta, legacy_number, client):
    configure(client, legacy_number, yes=True)
    converted, lost = lead(status="Converted"), lead(phone="9811111111", status="Lost")
    other = lead(phone="+91 90000 00000")
    deliver(webhook("wamid.Y1", "YES"))
    assert database.crm_lead_collection.find_one({"_id": converted})["status"] == "Converted"
    assert database.crm_lead_collection.find_one({"_id": lost})["status"] == "Lost"
    assert database.crm_lead_collection.find_one({"_id": lost})["whatsappResponse"]["keyword"] == "YES"
    assert "whatsappResponse" not in database.crm_lead_collection.find_one({"_id": other})


def test_yes_off_falls_back_to_existing_customer_auto_reply(meta, legacy_number, client):
    configure(client, legacy_number, yes=False, generic=True)
    lead_id = lead()
    deliver(webhook("wamid.Y1", "YES"))
    assert bodies(meta) == [GENERIC_TEXT]
    assert database.crm_lead_collection.find_one({"_id": lead_id})["status"] == "Interested"


def test_yes_uses_latest_saved_text(meta, legacy_number, client):
    h = hdr(legacy_number)
    client.put("/api/whatsapp/keyword-auto-replies/yes", json={"enabled": True, "message": "v1"}, headers=h)
    deliver(webhook("wamid.Y1", "YES"))
    client.put("/api/whatsapp/keyword-auto-replies/yes", json={"enabled": True, "message": "v2"}, headers=h)
    deliver(webhook("wamid.Y2", "YES"))
    assert bodies(meta) == ["v1", "v2"]


def test_keyword_replies_are_per_number(meta, legacy_number, client):
    other = numbers.create_number({"display_name": "Support", "phone_number": "+91 90000 00002", "phone_number_id": "444444",
                                   "waba_id": "222222", "access_token": "token-b", "purpose": "Support"}, "admin@delegatex.com")
    configure(client, legacy_number, stop=True, yes=True)
    assert automation_service.get_keyword_auto_replies(numbers.get_number(str(other["_id"])))["yes"]["enabled"] is False


# ── Custom keywords (quick-reply button titles) ──

def save_custom(client, number, key, keyword, enabled=True, message="custom reply"):
    return client.put(f"/api/whatsapp/keyword-auto-replies/{key}", json={"keyword": keyword, "enabled": enabled, "message": message},
                      headers=hdr(number))


def test_custom_keyword_saves_and_lists_after_builtins(client, legacy_number):
    r = save_custom(client, legacy_number, "not_interested", "  Not   interested ", message="Noted, {first_name}.")
    assert r.status_code == 200
    assert r.json()["keyword_auto_reply"] == {**r.json()["keyword_auto_reply"], "key": "not_interested", "keyword": "NOT INTERESTED",
                                              "builtin": False, "enabled": True, "default_message": ""}
    save_custom(client, legacy_number, "call_me", "CALL ME", enabled=False, message="We will call.")
    listed = client.get("/api/whatsapp/keyword-auto-replies", headers=hdr(legacy_number)).json()["keyword_auto_replies"]
    assert list(listed) == ["stop", "yes", "not_interested", "call_me"]
    assert listed["call_me"]["enabled"] is False and listed["call_me"]["message"] == "We will call."
    assert listed["stop"]["builtin"] is True and listed["stop"]["updated_at"] is None

    # Saving again updates the same entry: no duplicates.
    save_custom(client, legacy_number, "not_interested", "NOT INTERESTED", message="v2")
    doc = numbers.get_number(str(legacy_number["_id"]))
    assert set(doc["keyword_auto_replies"]) == {"not_interested", "call_me"}
    assert doc["keyword_auto_replies"]["not_interested"]["message"] == "v2"


def test_custom_keyword_validation(client, legacy_number):
    assert save_custom(client, legacy_number, "call_me", "CALL ME LATER").status_code == 400  # key / title mismatch
    assert save_custom(client, legacy_number, "call_me", "CALL ME", message=" ").status_code == 400
    assert save_custom(client, legacy_number, "x" * 26, "X" * 26).status_code == 400  # longer than a button title
    # STOP keeps its built-in title whatever the body says.
    r = save_custom(client, legacy_number, "stop", "something else")
    assert r.status_code == 200 and r.json()["keyword_auto_reply"]["keyword"] == "STOP"


def test_custom_keyword_matching(legacy_number):
    number = {**legacy_number, "keyword_auto_replies": {"not_interested": {"keyword": "NOT INTERESTED"}}}
    assert automation_service.reply_keyword("not interested!", number) == "not_interested"
    assert automation_service.reply_keyword("NOT  INTERESTED", number) == "not_interested"
    assert automation_service.reply_keyword("not interested", None) is None  # only saved keywords match
    assert automation_service.reply_keyword("I am not interested", number) is None
    assert automation_service.reply_keyword("STOP", number) == "stop"


def test_custom_keyword_reply_through_webhook(meta, legacy_number, client):
    configure(client, legacy_number, generic=True)
    save_custom(client, legacy_number, "not_interested", "NOT INTERESTED", message="Sorry to hear that, {first_name}.")
    save_custom(client, legacy_number, "call_me", "CALL ME", enabled=False, message="unused")
    deliver(webhook("wamid.N1", "Not Interested", button=True))
    deliver(webhook("wamid.C1", "CALL ME", sender="919822222222", name="Asha Rao"))  # off → generic reply
    assert bodies(meta) == ["Sorry to hear that, Ravi.", GENERIC_TEXT]
    stored = database.whatsapp_message_collection.find_one({"direction": "outbound", "automation_workflow": "NOT INTERESTED Auto-Reply"})
    assert stored is not None
    assert not DNDRepository.is_dnd("919811111111")


def test_custom_opt_out_keyword_reply_gets_past_dnd(meta, legacy_number, client):
    configure(client, legacy_number, generic=True)
    save_custom(client, legacy_number, "unsubscribe", "UNSUBSCRIBE", message="Unsubscribed.")
    deliver(webhook("wamid.U1", "UNSUBSCRIBE", button=True))
    assert bodies(meta) == ["Unsubscribed."]
    assert DNDRepository.is_dnd("919811111111")


def test_default_button_titles_get_their_custom_replies(meta, legacy_number, client):
    # The template page's default quick-reply buttons, saved together with the template.
    configure(client, legacy_number, generic=True)
    save_custom(client, legacy_number, "yes_interested", "YES / INTERESTED", message="Great, {first_name}! We'll call you.")
    save_custom(client, legacy_number, "no_not_interested", "NO / NOT INTERESTED", message="No problem, {name}.")
    deliver(webhook("wamid.B1", "YES / Interested", button=True))
    deliver(webhook("wamid.B2", "NO / Not Interested", sender="919822222222", name="Asha Rao", button=True))
    assert bodies(meta) == ["Great, Ravi! We'll call you.", "No problem, Asha Rao."]
