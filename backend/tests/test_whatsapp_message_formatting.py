"""
Offline tests: multiline WhatsApp text keeps its line breaks from the send API through the Meta
payload, MongoDB and the inbox conversation endpoint. Only the Meta HTTP call is faked.
"""

import asyncio
import json
import time

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import database
from app.whatsapp.meta_api import MetaClient
from app.whatsapp.services import automation_service, webhook_service

ADMIN = {"X-User-Email": "admin@delegatex.com"}
CUSTOMER = "919811111111"

SAMPLE = (
    "Hello Rahul,\n"
    "\n"
    "Thank you for your interest in our services.\n"
    "\n"
    "Here are the details:\n"
    "• Service A\n"
    "• Service B\n"
    "\n"
    "Please let us know if you have any questions.\n"
    "\n"
    "Regards,\n"
    "Team Sparsh"
)


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
    box = {"payloads": []}

    async def send(client, payload):
        # Round-trip through JSON, as httpx does when posting to Meta.
        box["payloads"].append(json.loads(json.dumps(payload)))
        return {"wamid": f"wamid.OUT{len(box['payloads'])}", "wa_id": payload["to"]}

    async def ai_bot(incoming):
        return None

    monkeypatch.setattr(MetaClient, "send_message", send)
    monkeypatch.setattr(automation_service, "trigger_ai_faq_bot", ai_bot)
    return box


def webhook(wamid, text, name="Rahul Verma"):
    return {"object": "whatsapp_business_account", "entry": [{"id": "222222", "changes": [{"field": "messages", "value": {
        "messaging_product": "whatsapp", "metadata": {"phone_number_id": "111111", "display_phone_number": "x"},
        "contacts": [{"wa_id": CUSTOMER, "profile": {"name": name}}],
        "messages": [{"from": CUSTOMER, "id": wamid, "timestamp": str(int(time.time())), "type": "text", "text": {"body": text}}]}}]}]}


def deliver(*payloads):
    async def go():
        for p in payloads:
            webhook_service.ingest(p, True)
        await webhook_service.process_pending_events()
        pending = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
        await asyncio.gather(*pending)
    asyncio.run(go())


def send_and_reopen(client, number, text):
    """Send from the inbox API; return (Meta body, stored content, content shown when the chat is reopened)."""
    r = client.post("/api/whatsapp/messages/send", json={"to": CUSTOMER, "message": text, "content": text,
                                                         "recipient_name": "Rahul"}, headers=hdr(number))
    assert r.status_code == 200, r.text
    msg_id = r.json()["data"]["_id"]
    stored = database.whatsapp_message_collection.find_one({"direction": "outbound", "content": {"$exists": True}},
                                                           sort=[("created_at", -1)])
    conv = client.get(f"/api/whatsapp/messages/conversation/{stored['conversation_id']}", headers=hdr(number)).json()
    shown = next(m["content"] for m in conv["messages"] if str(m["_id"]) == str(msg_id))
    return stored["content"], shown


@pytest.fixture
def open_window(meta, legacy_number):
    """A recent inbound message, so free-form sends are inside the 24h customer service window."""
    deliver(webhook("wamid.IN0", "hi"))
    meta["payloads"].clear()
    return legacy_number


@pytest.mark.parametrize("text", [
    "Single line message",
    SAMPLE,
    "Para one.\n\n\n\nPara two after three blank lines.",
    "Agenda:\n1. Intro\n2. Pricing\n3. Q&A\n\n- dash item\n* star item\n• bullet item",
    "Namaste 🙏\nनमस्ते राहुल\n😀👍🏽 ✅\nçafé — “quotes” {braces}",
    "Steps:\n    indented line\n\tTabbed line\nend",
])
def test_inbox_send_preserves_formatting(client, meta, open_window, text):
    stored, shown = send_and_reopen(client, open_window, text)
    body = meta["payloads"][-1]["text"]["body"]
    assert meta["payloads"][-1]["type"] == "text"
    assert body == text
    assert stored == text
    assert shown == text
    assert "\\n" not in body


def test_windows_line_endings_are_normalized_consistently(client, meta, open_window):
    stored, shown = send_and_reopen(client, open_window, SAMPLE.replace("\n", "\r\n"))
    assert meta["payloads"][-1]["text"]["body"] == SAMPLE
    assert stored == SAMPLE and shown == SAMPLE


def test_only_outer_whitespace_is_trimmed(client, meta, open_window):
    stored, _ = send_and_reopen(client, open_window, "\n\n  Hello,\n\nBye  \n\n")
    assert meta["payloads"][-1]["text"]["body"] == "Hello,\n\nBye"
    assert stored == "Hello,\n\nBye"


def test_multiline_auto_reply_with_placeholders(client, meta, legacy_number):
    template = "Hi {first_name},\n\nThanks for writing to us.\n• We reply within 1 hour\n• {name}, keep this chat open 🙂\n\nTeam Sparsh"
    r = client.put("/api/whatsapp/auto-reply", json={"enabled": True, "message": template}, headers=hdr(legacy_number))
    assert r.status_code == 200
    assert client.get("/api/whatsapp/auto-reply", headers=hdr(legacy_number)).json()["auto_reply"]["message"] == template

    deliver(webhook("wamid.H1", "Hello"))
    expected = "Hi Rahul,\n\nThanks for writing to us.\n• We reply within 1 hour\n• Rahul Verma, keep this chat open 🙂\n\nTeam Sparsh"
    assert meta["payloads"][-1]["text"]["body"] == expected
    stored = database.whatsapp_message_collection.find_one({"automation_workflow": "Custom Auto Reply"})
    assert stored["content"] == expected


def test_multiline_inbound_message_is_stored_intact(client, meta, legacy_number):
    text = "Hi,\n\nI need:\n1. Quote\n2. Demo\n\nThanks"
    deliver(webhook("wamid.IN9", text))
    stored = database.whatsapp_message_collection.find_one({"direction": "inbound", "wamid": "wamid.IN9"}) \
        or database.whatsapp_message_collection.find_one({"direction": "inbound", "content": text})
    assert stored is not None and stored["content"] == text
