"""
Offline tests for the per-number custom auto-reply to customer messages (Settings → Customer Reply Auto-Reply).
Outgoing sends and the AI bot are faked; nothing reaches Meta or the LLM.
"""

import asyncio
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import database
from app.whatsapp import numbers
from app.whatsapp.meta_api import MetaClient
from app.whatsapp.services import automation_service, webhook_service

ADMIN = {"X-User-Email": "admin@delegatex.com"}


@pytest.fixture
def client():
    from app.whatsapp.routes import router
    app = FastAPI()
    app.include_router(router)
    return TestClient(app)


def hdr(number):
    return {**ADMIN, "X-WhatsApp-Number-Id": str(number["_id"])}


@pytest.fixture
def outbox(monkeypatch):
    """Captures replies sent by the automation service and calls to the AI bot."""
    box = {"sent": [], "ai": []}

    async def send_message(**kwargs):
        box["sent"].append(kwargs)
        return {"_id": "m1", **kwargs}

    async def ai_bot(incoming):
        box["ai"].append(incoming)
        return {"_id": "ai"}

    monkeypatch.setattr(automation_service, "send_message", send_message)
    monkeypatch.setattr(automation_service, "trigger_ai_faq_bot", ai_bot)
    return box


def incoming(number, content="YES", sender="Abhigyan Sharma"):
    return {"_id": "in1", "number_id": str(number["_id"]), "sender_phone": "919811111111", "sender": sender, "content": content}


def enable(number, message):
    automation_service.save_customer_auto_reply({"enabled": True, "message": message}, number, "admin@delegatex.com")


def test_api_round_trip_and_validation(client, legacy_number):
    r = client.get("/api/whatsapp/auto-reply", headers=hdr(legacy_number))
    assert r.status_code == 200 and r.json()["auto_reply"]["enabled"] is False

    r = client.put("/api/whatsapp/auto-reply", json={"enabled": True, "message": "   "}, headers=hdr(legacy_number))
    assert r.status_code == 400

    r = client.put("/api/whatsapp/auto-reply", json={"enabled": True, "message": "  Thanks {first_name}!  "}, headers=hdr(legacy_number))
    assert r.status_code == 200
    saved = client.get("/api/whatsapp/auto-reply", headers=hdr(legacy_number)).json()["auto_reply"]
    assert saved["enabled"] is True and saved["message"] == "Thanks {first_name}!"
    assert saved["updated_by"] == "admin@delegatex.com"

    r = client.put("/api/whatsapp/auto-reply", json={"enabled": False, "message": "x" * 4097}, headers=hdr(legacy_number))
    assert r.status_code == 422


def test_enabled_auto_reply_replaces_ai_answer(outbox, legacy_number):
    enable(legacy_number, "Hi {first_name}, thanks! — {name}")
    asyncio.run(automation_service.detect_intent_and_route(incoming(legacy_number)))
    assert outbox["ai"] == []
    assert len(outbox["sent"]) == 1
    sent = outbox["sent"][0]
    assert sent["content"] == "Hi Abhigyan, thanks! — Abhigyan Sharma"
    assert str(sent["number"]["_id"]) == str(legacy_number["_id"])  # replies from the number the customer wrote to


def test_disabled_auto_reply_sends_nothing(outbox, legacy_number):
    automation_service.save_customer_auto_reply({"enabled": False, "message": "Custom"}, legacy_number)
    assert asyncio.run(automation_service.detect_intent_and_route(incoming(legacy_number))) is None
    assert outbox["ai"] == [] and outbox["sent"] == []


def test_never_configured_sends_nothing(outbox, legacy_number):
    assert asyncio.run(automation_service.detect_intent_and_route(incoming(legacy_number))) is None
    assert outbox["ai"] == [] and outbox["sent"] == []


def test_keyword_routes_are_unchanged(outbox, legacy_number):
    enable(legacy_number, "Custom")
    asyncio.run(automation_service.detect_intent_and_route(incoming(legacy_number, content="AGENT")))
    assert outbox["ai"] == []
    assert outbox["sent"][0]["automation_workflow"] == "Intent Detection — Agent Handoff"


def test_auto_reply_is_per_number(outbox, legacy_number):
    other = numbers.create_number({"display_name": "Support", "phone_number": "+91 90000 00002", "phone_number_id": "444444",
                                   "waba_id": "222222", "access_token": "token-b", "purpose": "Support"}, "admin@delegatex.com")
    enable(legacy_number, "Custom")
    asyncio.run(automation_service.detect_intent_and_route(incoming(other)))
    assert outbox["ai"] == [] and outbox["sent"] == []  # other number's toggle is off


def test_render_uses_fallback_for_unknown_sender_and_keeps_other_braces():
    text = "Hello {name} / {first_name} {order}"
    assert automation_service.render_customer_auto_reply(text, "WhatsApp User") == "Hello there / there {order}"
    assert automation_service.render_customer_auto_reply(text, None) == "Hello there / there {order}"


# ── End to end: Meta webhook → inbound processor → intent router → Meta send ──

@pytest.fixture
def meta(monkeypatch):
    """Real message_service; only the Meta HTTP call and the LLM are faked."""
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


def webhook(wamid, text, name="Ravi Kumar", sender="919811111111"):
    return {"object": "whatsapp_business_account", "entry": [{"id": "222222", "changes": [{"field": "messages", "value": {
        "messaging_product": "whatsapp", "metadata": {"phone_number_id": "111111", "display_phone_number": "x"},
        "contacts": [{"wa_id": sender, "profile": {"name": name}}],
        "messages": [{"from": sender, "id": wamid, "timestamp": str(int(time.time())), "type": "text", "text": {"body": text}}]}}]}]}


def deliver(*payloads):
    """Ingest webhook deliveries, process them and wait for the replies they schedule."""
    async def go():
        for p in payloads:
            webhook_service.ingest(p, True)
        await webhook_service.process_pending_events()
        pending = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
        await asyncio.gather(*pending)
    asyncio.run(go())


def outbound(workflow):
    return list(database.whatsapp_message_collection.find({"direction": "outbound", "automation_workflow": workflow}))


def test_webhook_hello_gets_exact_configured_reply(meta, legacy_number, client):
    message = "hello this is dtable analytics autoreply chatbot"
    r = client.put("/api/whatsapp/auto-reply", json={"enabled": True, "message": message}, headers=hdr(legacy_number))
    assert r.status_code == 200

    deliver(webhook("wamid.H1", "Hello"))
    assert meta["ai"] == []
    assert len(meta["payloads"]) == 1
    assert meta["payloads"][0]["text"]["body"] == message  # what goes to the WhatsApp API
    stored = outbound("Custom Auto Reply")
    assert [m["content"] for m in stored] == [message]  # what the inbox shows
    assert stored[0]["number_id"] == str(legacy_number["_id"])
    assert "DelegateX AI Assistant" not in meta["payloads"][0]["text"]["body"]


def test_webhook_uses_latest_saved_message_and_names(meta, legacy_number, client):
    client.put("/api/whatsapp/auto-reply", json={"enabled": True, "message": "first version"}, headers=hdr(legacy_number))
    deliver(webhook("wamid.V1", "Hello"))
    client.put("/api/whatsapp/auto-reply", json={"enabled": True, "message": "Hi {first_name} ({name})"}, headers=hdr(legacy_number))
    deliver(webhook("wamid.V2", "Hello again"))
    deliver(webhook("wamid.V3", "Hello", name="", sender="919822222222"))  # no WhatsApp profile name
    assert [p["text"]["body"] for p in meta["payloads"]] == ["first version", "Hi Ravi (Ravi Kumar)", "Hi there (there)"]


def test_webhook_disabled_sends_no_reply(meta, legacy_number, client):
    client.put("/api/whatsapp/auto-reply", json={"enabled": False, "message": "custom text"}, headers=hdr(legacy_number))
    deliver(webhook("wamid.D1", "Hello"), webhook("wamid.D1", "Hello"))  # including a redelivery
    assert meta["ai"] == []
    assert meta["payloads"] == [] and outbound("Custom Auto Reply") == []
    # the customer's message still reaches the inbox
    assert database.whatsapp_message_collection.count_documents({"direction": "inbound", "wamid": "wamid.D1"}) == 1


def test_webhook_commands_keep_dedicated_handlers(meta, legacy_number, client):
    client.put("/api/whatsapp/auto-reply", json={"enabled": True, "message": "custom text"}, headers=hdr(legacy_number))
    deliver(webhook("wamid.C1", "STATUS"))
    deliver(webhook("wamid.C2", "AGENT"))
    bodies = [p["text"]["body"] for p in meta["payloads"]]
    assert len(bodies) == 2 and "custom text" not in bodies
    assert outbound("CRM Lookup") and outbound("Intent Detection — Agent Handoff")
    assert meta["ai"] == []


def test_webhook_redelivery_replies_once(meta, legacy_number, client):
    client.put("/api/whatsapp/auto-reply", json={"enabled": True, "message": "custom text"}, headers=hdr(legacy_number))
    deliver(webhook("wamid.R1", "Hello"), webhook("wamid.R1", "Hello"))  # Meta retries the same event
    deliver(webhook("wamid.R1", "Hello"))  # and again after it was processed
    assert [p["text"]["body"] for p in meta["payloads"]] == ["custom text"]
    assert len(outbound("Custom Auto Reply")) == 1


# ── Real AI FAQ handler (only the LLM is faked): its hardcoded header must never reach Meta ──

@pytest.fixture
def real_ai(monkeypatch):
    from app.chatbot import service as chatbot_service
    box = {"payloads": [], "llm": []}

    async def send(client, payload):
        box["payloads"].append(payload)
        return {"wamid": f"wamid.OUT{len(box['payloads'])}", "wa_id": payload["to"]}

    class FakeChatbot:
        def answer_question(self, **kwargs):
            box["llm"].append(kwargs)
            return "Hello! I'm DelegateX AI Assistant. How can I help you today?"

    monkeypatch.setattr(MetaClient, "send_message", send)
    monkeypatch.setattr(chatbot_service, "ChatbotService", FakeChatbot)
    return box


def test_toggle_on_off_on_through_api(real_ai, legacy_number, client):
    h = hdr(legacy_number)
    client.put("/api/whatsapp/auto-reply", json={"enabled": True, "message": "Hi {first_name}!"}, headers=h)
    assert client.get("/api/whatsapp/auto-reply", headers=h).json()["auto_reply"]["enabled"] is True  # page refresh
    deliver(webhook("wamid.T1", "Hello"))

    client.put("/api/whatsapp/auto-reply", json={"enabled": False, "message": "Hi {first_name}!"}, headers=h)
    off = client.get("/api/whatsapp/auto-reply", headers=h).json()["auto_reply"]  # page refresh
    assert off["enabled"] is False and off["message"] == "Hi {first_name}!"  # message kept for re-enabling
    deliver(webhook("wamid.T2", "Hello"))
    deliver(webhook("wamid.T3", "hi, what are your prices?"))

    client.put("/api/whatsapp/auto-reply", json={"enabled": True, "message": "Hi {first_name}!"}, headers=h)
    deliver(webhook("wamid.T4", "Hello"))

    bodies = [p["text"]["body"] for p in real_ai["payloads"]]
    assert bodies == ["Hi Ravi!", "Hi Ravi!"]  # T1 and T4 only; nothing for T2/T3
    assert real_ai["llm"] == []
    assert not any("DelegateX AI Assistant" in b for b in bodies)
    assert outbound("AI FAQ Bot") == []


def test_setting_survives_restart(real_ai, legacy_number, client):
    # Nothing is cached in-process: the number doc in MongoDB is re-read per message.
    client.put("/api/whatsapp/auto-reply", json={"enabled": False, "message": "custom"}, headers=hdr(legacy_number))
    stored = numbers.get_number(str(legacy_number["_id"]))["customer_auto_reply"]
    assert stored["enabled"] is False and stored["message"] == "custom"
    deliver(webhook("wamid.S1", "Hello"))
    assert real_ai["payloads"] == [] and real_ai["llm"] == []


def test_keyword_routes_work_while_off(real_ai, legacy_number, client):
    client.put("/api/whatsapp/auto-reply", json={"enabled": False, "message": "custom"}, headers=hdr(legacy_number))
    deliver(webhook("wamid.K1", "STATUS"))
    deliver(webhook("wamid.K2", "AGENT"))
    assert len(real_ai["payloads"]) == 2
    assert outbound("CRM Lookup") and outbound("Intent Detection — Agent Handoff")
    assert real_ai["llm"] == [] and outbound("Custom Auto Reply") == []
