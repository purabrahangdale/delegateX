"""
Offline tests for the per-number custom auto-reply to customer messages (Settings → Customer Reply Auto-Reply).
Outgoing sends and the AI bot are faked; nothing reaches Meta or the LLM.
"""

import asyncio

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.whatsapp import numbers
from app.whatsapp.services import automation_service

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


def test_disabled_auto_reply_keeps_ai_answer(outbox, legacy_number):
    automation_service.save_customer_auto_reply({"enabled": False, "message": "Custom"}, legacy_number)
    asyncio.run(automation_service.detect_intent_and_route(incoming(legacy_number)))
    assert len(outbox["ai"]) == 1 and outbox["sent"] == []


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
    assert len(outbox["ai"]) == 1 and outbox["sent"] == []


def test_render_uses_fallback_for_unknown_sender_and_keeps_other_braces():
    text = "Hello {name} / {first_name} {order}"
    assert automation_service.render_customer_auto_reply(text, "WhatsApp User") == "Hello there / there {order}"
    assert automation_service.render_customer_auto_reply(text, None) == "Hello there / there {order}"
