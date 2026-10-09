import socket
# Apply Windows DNS resolution fallback patch
try:
    import dns.resolver
    _original_getaddrinfo = socket.getaddrinfo
    
    # Initialize resolver with public nameservers to bypass broken Windows registry configs
    _custom_resolver = dns.resolver.Resolver()
    _custom_resolver.nameservers = ['8.8.8.8', '1.1.1.1']

    def patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
        if isinstance(host, bytes):
            try:
                host = host.decode("utf-8")
            except Exception:
                return _original_getaddrinfo(host, port, family, type, proto, flags)

        # Loopbacks and local hosts go to original resolver
        if not host or host in ("localhost", "127.0.0.1", "::1"):
            return _original_getaddrinfo(host, port, family, type, proto, flags)
            
        # External hosts resolve via dnspython first to bypass Windows socket hangs
        try:
            answers = _custom_resolver.resolve(host, 'A')
            results = []
            for rdata in answers:
                ip = rdata.to_text()
                results.append((socket.AddressFamily.AF_INET, socket.SocketKind.SOCK_STREAM, 6, '', (ip, port)))
            if results:
                return results
        except Exception:
            pass
            
        # Fallback to original resolver
        return _original_getaddrinfo(host, port, family, type, proto, flags)

    socket.getaddrinfo = patched_getaddrinfo
    print("[DNS Patch] Applied Windows DNS monkey-patch successfully with public DNS servers.")
except Exception as e:
    print("[DNS Patch] Failed to apply socket monkey-patch:", e)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.employee_routes import router as employee_router
from app.routes.project_routes import router as project_router
from app.routes.task_routes import router as task_router
from app.websocket.delegation_socket import router as delegation_ws_router
from app.websocket.crm_socket import router as crm_ws_router
from app.websocket.notifications import router as notifications_router
from app.routes.crm_routes import router as crm_router
from app.routes.email_routes import router as email_router
from delegation_forms.routes import router as delegation_form_router
from app.chatbot.routes import router as chatbot_router
from app.whatsapp.routes import router as whatsapp_router
from app.whatsapp.websocket import router as whatsapp_ws_router
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI()

# Ensure static directory exists
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

# CORS configuration
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://delegatex-1-backend2.onrender.com",
    "https://delegatex-backend.onrender.com",
    "https://delegatex-1-y433.onrender.com"
]

frontend_env = os.getenv("FRONTEND_URL") or os.getenv("VITE_FRONTEND_URL")
if frontend_env:
    origins.append(frontend_env)
    origins.append(frontend_env.rstrip("/"))

origins = list(set(origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes

app.include_router(employee_router)
app.include_router(project_router)
app.include_router(task_router)
app.include_router(delegation_ws_router)
app.include_router(crm_ws_router)
app.include_router(notifications_router)
app.include_router(crm_router)
app.include_router(email_router)
app.include_router(delegation_form_router)
app.include_router(chatbot_router)
app.include_router(whatsapp_router)
app.include_router(whatsapp_ws_router)


@app.on_event("startup")
async def startup_whatsapp_automation():
    """Seed default WhatsApp templates and start background schedulers."""
    try:
        from app.whatsapp.services.template_service import seed_default_templates
        from app.whatsapp.services.scheduler_service import start_schedulers
        import asyncio
        from app.whatsapp.indexes import ensure_indexes
        from app.whatsapp.services.campaign_service import start_worker
        from app.whatsapp.numbers import run_startup_migration
        seed_default_templates()
        # Multi-number upgrade: move the single legacy Meta config into the number registry (once) and
        # attach existing records to their number where the owning phone number ID is recorded.
        print(f"[WhatsApp] Number registry migration: {run_startup_migration()}")
        ensure_indexes()
        start_schedulers()
        start_worker()
        print("[WhatsApp] Indexes ensured, schedulers and campaign worker started.")

        async def _initial_template_sync():
            from app.whatsapp.services.template_service import sync_templates_from_meta
            from app.whatsapp.numbers import all_numbers
            # One sync per WABA: numbers in the same WABA share the template catalogue.
            seen_wabas = set()
            for number in all_numbers(active_only=True):
                if not number.get("waba_id") or number["waba_id"] in seen_wabas:
                    continue
                seen_wabas.add(number["waba_id"])
                try:
                    summary = await sync_templates_from_meta(number)
                    print(f"[WhatsApp] Template sync from Meta (WABA {number['waba_id']}): {summary}")
                except Exception as sync_err:
                    print(f"[WhatsApp] Template sync skipped for WABA {number['waba_id']}: {sync_err}")

        asyncio.create_task(_initial_template_sync())
    except Exception as e:
        err_msg = str(e)
        if "bad auth" in err_msg or "8000" in err_msg:
            print(f"[WhatsApp] Startup Error: MongoDB Atlas authentication failed. Please check DATABASE_URL in backend/.env. Details: {e}")
        else:
            print(f"[WhatsApp] Startup initialization error: {e}")


@app.get("/")
def home():
    return {"message": "Backend Running Successfully"}
