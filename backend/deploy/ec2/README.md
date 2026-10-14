# EC2 deployment: DelegateX backend + Meta WhatsApp webhook

Topology: `Internet --443--> Nginx (TLS, Let's Encrypt) --> 127.0.0.1:8000 uvicorn (systemd, 1 worker) --> MongoDB Atlas`

Meta Callback URL once deployed: **`https://<YOUR-DOMAIN>/api/whatsapp/webhook`**
(route: `APIRouter(prefix="/api/whatsapp")` + `@router.get/post("/webhook")` in `app/whatsapp/routes.py`).

Files in this folder:

| File | Goes to |
|---|---|
| `delegatex-backend.service` | `/etc/systemd/system/` |
| `nginx-delegatex.conf` | `/etc/nginx/sites-available/delegatex` |
| `backend.env.template` | `/etc/delegatex/backend.env` (fill with real values) |
| `webhook_smoke_test.py` | run from your laptop, not the server |

## 0. Prerequisites (you must create these, none exist yet)

1. **EC2 instance**: Ubuntu 24.04 LTS, at least `t3.small` (2 GB RAM; chromadb + Gemini SDK are heavy).
2. **Elastic IP** associated with the instance, so the IP survives stop/start.
3. **Domain**: an `A` record such as `api.yourdomain.com` pointing to the Elastic IP. Meta needs HTTPS with a publicly trusted certificate, so a bare `http://IP` won't work. Use a domain.
4. **Security group, inbound**: `443/tcp` from 0.0.0.0/0 (and ::/0). `80/tcp` from 0.0.0.0/0 is needed for Let's Encrypt HTTP-01 issuance and renewal, and it redirects to HTTPS. `22/tcp` from **your IP only**. Do **not** open 8000.
5. **MongoDB Atlas → Network Access**: add `<Elastic IP>/32`. Remove `0.0.0.0/0` if it is there.

## 1. Server setup (run on EC2)

```bash
sudo apt update && sudo apt install -y python3 python3-venv python3-dev build-essential git nginx certbot python3-certbot-nginx
sudo useradd --system --create-home --home-dir /opt/delegatex --shell /usr/sbin/nologin delegatex
sudo -u delegatex git clone <YOUR-REPO-URL> /opt/delegatex   # or rsync the project (exclude venv/, .env, node_modules/)
cd /opt/delegatex/backend
sudo -u delegatex python3 -m venv venv
sudo -u delegatex venv/bin/pip install --upgrade pip
sudo -u delegatex venv/bin/pip install -r requirements.txt
```

Local development uses Python 3.11 (`.python-version`). Ubuntu 24.04 ships 3.12, which the pinned packages support. If `pip install` fails, install 3.11 from the deadsnakes PPA and use `python3.11 -m venv venv`.

## 2. Environment (secrets)

```bash
sudo install -d -m 750 -o root -g delegatex /etc/delegatex
sudo install -m 640 -o root -g delegatex deploy/ec2/backend.env.template /etc/delegatex/backend.env
sudo nano /etc/delegatex/backend.env
```

- Copy existing values from the current `backend/.env` or Render environment **unchanged**, especially `DATABASE_URL`, the `META_*` tokens and `WHATSAPP_TOKEN_ENCRYPTION_KEY`. Stored per-number access tokens are encrypted with that key, and a different key makes them unreadable.
- **`META_APP_SECRET` is missing from the current `.env`.** Add it from Meta App Dashboard → App settings → Basic → App secret. Without it every webhook POST returns 503.
- Set `BACKEND_PUBLIC_URL=https://<YOUR-DOMAIN>`. The current value still points to Render.
- Set `FRONTEND_URL` to the frontend origin(s) for CORS.
- Do **not** create `backend/.env` on the server; systemd provides the variables.

## 3. systemd

```bash
sudo cp deploy/ec2/delegatex-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now delegatex-backend
sudo systemctl status delegatex-backend
curl -s http://127.0.0.1:8000/api/whatsapp/webhook   # local check: {"status":"active",...,"signature_validation":"enforced"}
journalctl -u delegatex-backend -f                    # logs
```

`enable` restarts the backend after a reboot, and `Restart=always` restarts it after a crash. Keep `--workers 1`: the campaign worker, schedulers and WebSocket client lists live inside the process.

## 4. Nginx + HTTPS

```bash
sudo sed -i 's/api.example.com/<YOUR-DOMAIN>/' deploy/ec2/nginx-delegatex.conf
sudo cp deploy/ec2/nginx-delegatex.conf /etc/nginx/sites-available/delegatex
sudo ln -s /etc/nginx/sites-available/delegatex /etc/nginx/sites-enabled/delegatex
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d <YOUR-DOMAIN> --redirect -m <admin-email> --agree-tos
sudo certbot renew --dry-run
```

## 5. Verify from outside (your laptop)

```bash
export META_WHATSAPP_VERIFY_TOKEN='...'   # same as server
export META_APP_SECRET='...'              # same as server
python backend/deploy/ec2/webhook_smoke_test.py https://<YOUR-DOMAIN>
```

The script checks DNS, a valid certificate, that GET reaches FastAPI, that a correct verify token returns the challenge and a wrong one gets 403, that a bad or missing signature gets 401, that a signed payload is stored, and that a repeated delivery is reported as a duplicate. Its test event uses a fake `phone_number_id`, so the backend stores it as ignored, the TTL removes it after 30 days, and no real conversation is touched. Secrets are never printed.

## 6. Meta App Dashboard

1. WhatsApp → Configuration → Webhook → Edit. Set Callback URL to `https://<YOUR-DOMAIN>/api/whatsapp/webhook` and Verify token to the value of `META_WHATSAPP_VERIFY_TOKEN`. Click **Verify and save**.
2. Webhook fields: **subscribe** `messages`, `message_template_status_update`, `template_category_update`. Without `messages`, Meta sends no inbound replies and no sent/delivered/read/failed statuses.
3. Make sure the WABA is subscribed to the app: `POST https://graph.facebook.com/v22.0/<WABA_ID>/subscribed_apps` with the access token.
4. Send a WhatsApp message to the business number. Then confirm `journalctl -u delegatex-backend | grep "\[Webhook\]"` shows `kind=message`, and that the in-app diagnostics page shows a recent `last_inbound_message_at`.

## Updating the deployment

```bash
cd /opt/delegatex && sudo -u delegatex git pull
sudo -u delegatex backend/venv/bin/pip install -r backend/requirements.txt
sudo systemctl restart delegatex-backend
```

## Notes

- `app/main.py` patches `socket.getaddrinfo` to resolve hosts via 8.8.8.8 / 1.1.1.1 (a Windows workaround). It also runs on Linux. The default EC2 security-group egress allows it. If you restrict egress, allow UDP/TCP 53 to those resolvers.
- Logs include phone numbers and wamids for webhook events (existing behavior), but never message bodies or secrets.
- Uploaded media goes to `backend/static/whatsapp_media` on the instance disk and is served at `https://<YOUR-DOMAIN>/static/...`.
