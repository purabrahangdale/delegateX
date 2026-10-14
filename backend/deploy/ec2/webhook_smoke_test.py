"""
Public smoke test for the Meta WhatsApp webhook. Run it from OUTSIDE the EC2 host (stdlib only):

    META_WHATSAPP_VERIFY_TOKEN=... META_APP_SECRET=... python webhook_smoke_test.py https://api.example.com

Secrets are read from the environment and never printed. The signed test event uses a phone_number_id
that no configured number has, so the backend stores it as `ignored_unmapped_number` (auto-deleted by
the TTL index) and never touches real messages, conversations or campaigns.
"""

import hashlib
import hmac
import json
import os
import socket
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

results = []


def check(name, ok, detail=""):
    results.append(ok)
    print(f"[{'PASS' if ok else 'FAIL'}] {name}" + (f" - {detail}" if detail else ""))


def request(url, method="GET", body=None, headers=None):
    req = urllib.request.Request(url, data=body, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=20, context=ssl.create_default_context()) as resp:
            return resp.status, resp.read().decode(errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode(errors="replace")


def main():
    if len(sys.argv) != 2 or not sys.argv[1].startswith("https://"):
        sys.exit("usage: python webhook_smoke_test.py https://YOUR-DOMAIN")
    base = sys.argv[1].rstrip("/")
    url = f"{base}/api/whatsapp/webhook"
    verify_token = os.getenv("META_WHATSAPP_VERIFY_TOKEN", "")
    app_secret = os.getenv("META_APP_SECRET", "")
    if not verify_token or not app_secret:
        sys.exit("Set META_WHATSAPP_VERIFY_TOKEN and META_APP_SECRET in the environment (same values as on the server).")

    host = urllib.parse.urlparse(base).hostname
    try:
        ips = sorted({ai[4][0] for ai in socket.getaddrinfo(host, 443)})
        check("DNS resolves", True, f"{host} -> {', '.join(ips)} (must be the EC2 Elastic IP)")
    except socket.gaierror as e:
        check("DNS resolves", False, str(e))
        return

    # Fails with an SSL error if the certificate is invalid/self-signed/for another name.
    try:
        status, body = request(url)
        info = json.loads(body) if status == 200 else {}
        check("HTTPS + valid certificate, GET reaches FastAPI", status == 200 and info.get("endpoint") == "/api/whatsapp/webhook", f"HTTP {status}")
        check("Server has verify token", bool(info.get("verification_token_configured")))
        check("Server enforces signatures (META_APP_SECRET set)", info.get("signature_validation") == "enforced", info.get("signature_validation", ""))
    except (ssl.SSLError, urllib.error.URLError) as e:
        check("HTTPS + valid certificate", False, str(e))
        return

    challenge = str(int(time.time()))
    q = lambda tok: urllib.parse.urlencode({"hub.mode": "subscribe", "hub.verify_token": tok, "hub.challenge": challenge})
    status, body = request(f"{url}?{q(verify_token)}")
    check("Correct verify token returns challenge", status == 200 and body == challenge, f"HTTP {status}")
    status, _ = request(f"{url}?{q('wrong-' + challenge)}")
    check("Wrong verify token rejected", status == 403, f"HTTP {status}")

    wamid = f"wamid.SMOKETEST{challenge}"
    payload = {"object": "whatsapp_business_account", "entry": [{"id": "0", "changes": [{"field": "messages", "value": {
        "messaging_product": "whatsapp",
        "metadata": {"display_phone_number": "0", "phone_number_id": "smoke-test-unmapped"},
        "messages": [{"from": "0", "id": wamid, "timestamp": challenge, "type": "text", "text": {"body": "smoke test"}}],
    }}]}]}
    raw = json.dumps(payload).encode()
    sig = "sha256=" + hmac.new(app_secret.encode(), raw, hashlib.sha256).hexdigest()
    headers = {"Content-Type": "application/json"}

    status, _ = request(url, "POST", raw, {**headers, "X-Hub-Signature-256": "sha256=" + "0" * 64})
    check("Invalid signature rejected", status == 401, f"HTTP {status}")
    status, _ = request(url, "POST", raw, headers)
    check("Missing signature rejected", status == 401, f"HTTP {status}")

    status, body = request(url, "POST", raw, {**headers, "X-Hub-Signature-256": sig})
    first = json.loads(body) if status == 200 else {}
    check("Signed payload accepted and stored in MongoDB", status == 200 and first.get("status") == "received" and first.get("ignored") == 1, f"HTTP {status} {first}")
    status, body = request(url, "POST", raw, {**headers, "X-Hub-Signature-256": sig})
    second = json.loads(body) if status == 200 else {}
    check("Duplicate delivery detected", status == 200 and second.get("duplicates") == 1, f"HTTP {status} {second}")

    print(f"\n{sum(results)}/{len(results)} checks passed")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
