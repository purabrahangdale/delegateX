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

import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.websocket.notifications import router as notifications_router
from app.chatbot.routes import router as chatbot_router
from app.whatsapp.routes import router as whatsapp_router
from app.whatsapp.websocket import router as whatsapp_ws_router
from app.auth import routes as auth_routes
from app.auth.routes import router as auth_router
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
    "https://delegatexfrontend1.onrender.com",
    "https://delegatex-1-backend2.onrender.com",
    "https://delegatex-backend.onrender.com",
    "https://delegatex-1-y433.onrender.com",
    "https://delegatex-12341234.onrender.com",
]

# FRONTEND_URL may hold one origin or a comma-separated list of extra origins.
frontend_env = os.getenv("FRONTEND_URL") or os.getenv("VITE_FRONTEND_URL")
if frontend_env:
    origins.extend(o.strip().rstrip("/") for o in frontend_env.split(",") if o.strip())

origins = list(set(origins))


# Unhandled exceptions otherwise surface from Starlette's outermost error middleware without CORS
# headers, which browsers report as a misleading CORS failure. Registered before CORSMiddleware so
# CORS wraps it and the 500 response carries the usual Access-Control-Allow-Origin header.
@app.middleware("http")
async def unhandled_errors_as_json(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception:
        logging.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={"detail": "Internal Server Error"})


# Reachable without signing in: sign-in itself, Meta's webhook (verified by its own signature), media
# files (loaded by <img> tags and Meta), and the health/docs pages the deploy health check polls.
PUBLIC_PATHS = {"/", "/docs", "/docs/oauth2-redirect", "/redoc", "/openapi.json", "/api/auth/login", "/api/whatsapp/webhook"}
PUBLIC_PREFIXES = ("/static/",)


@app.middleware("http")
async def require_sign_in(request: Request, call_next):
    path = request.url.path.rstrip("/") or "/"
    if request.method == "OPTIONS" or path in PUBLIC_PATHS or path.startswith(PUBLIC_PREFIXES):
        return await call_next(request)
    user = auth_routes.verify_token(auth_routes.bearer_token(request.headers.get("Authorization")))
    if not user:
        return JSONResponse(status_code=401, content={"detail": "Sign in required"})
    # Routes identify the acting user by X-User-Email; default it to the signed-in account.
    if not request.headers.get("X-User-Email"):
        request.scope["headers"] = [*request.scope["headers"], (b"x-user-email", user.encode())]
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# List responses (inbox, templates, campaigns) are tens to hundreds of KB of JSON; compressed they are
# a fraction of that, which matters on the long link between users and the server.
app.add_middleware(GZipMiddleware, minimum_size=1024)

# Routes

app.include_router(notifications_router)
app.include_router(chatbot_router)
app.include_router(whatsapp_router)
app.include_router(whatsapp_ws_router)
app.include_router(auth_router)


@app.on_event("startup")
async def startup_whatsapp_automation():
    """Seed default WhatsApp templates and start background schedulers.

    The setup runs in the background so the API answers requests immediately: the database steps
    (legacy migration, index creation) take over a minute against a remote Atlas cluster."""
    import asyncio

    def _blocking_setup():
        from app.whatsapp.services.template_service import seed_default_templates
        from app.whatsapp.indexes import ensure_indexes
        from app.whatsapp.numbers import run_startup_migration
        seed_default_templates()
        # Multi-number upgrade: move the single legacy Meta config into the number registry (once) and
        # attach existing records to their number where the owning phone number ID is recorded.
        print(f"[WhatsApp] Number registry migration: {run_startup_migration()}")
        ensure_indexes()

    async def _initial_template_sync():
        from app.whatsapp.services.template_service import sync_templates_from_meta
        from app.whatsapp.numbers import all_numbers
        # One sync per WABA: numbers in the same WABA share the template catalogue.
        seen_wabas = set()
        for number in await asyncio.to_thread(all_numbers, active_only=True):
            if not number.get("waba_id") or number["waba_id"] in seen_wabas:
                continue
            seen_wabas.add(number["waba_id"])
            try:
                summary = await sync_templates_from_meta(number)
                print(f"[WhatsApp] Template sync from Meta (WABA {number['waba_id']}): {summary}")
            except Exception as sync_err:
                print(f"[WhatsApp] Template sync skipped for WABA {number['waba_id']}: {sync_err}")

    async def _setup():
        try:
            from app.whatsapp.services.scheduler_service import start_schedulers
            from app.whatsapp.services.campaign_service import start_worker
            await asyncio.to_thread(_blocking_setup)
            start_schedulers()
            start_worker()
            print("[WhatsApp] Indexes ensured, schedulers and campaign worker started.")
            await _initial_template_sync()
        except Exception as e:
            err_msg = str(e)
            if "bad auth" in err_msg or "8000" in err_msg:
                print(f"[WhatsApp] Startup Error: MongoDB Atlas authentication failed. Please check DATABASE_URL in backend/.env. Details: {e}")
            else:
                print(f"[WhatsApp] Startup initialization error: {e}")

    # Keep a reference so the task is not garbage-collected while it runs.
    app.state.whatsapp_setup_task = asyncio.create_task(_setup())


@app.get("/")
def home():
    return {"message": "Backend Running Successfully"}
