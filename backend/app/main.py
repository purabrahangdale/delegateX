import socket
# Apply Windows DNS resolution fallback patch
try:
    import dns.resolver
    _original_getaddrinfo = socket.getaddrinfo
    
    # Initialize resolver with public nameservers to bypass broken Windows registry configs
    _custom_resolver = dns.resolver.Resolver()
    _custom_resolver.nameservers = ['8.8.8.8', '1.1.1.1']

    def patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
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
        except Exception as e:
            print(f"[DNS Patch Error] Resolving {host} failed: {e}", flush=True)
            
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

# CORS
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://delegatex.onrender.com",
    "https://delegatex-backend.onrender.com",
]

frontend_env = os.getenv("FRONTEND_URL") or os.getenv("VITE_FRONTEND_URL")
if frontend_env:
    origins.append(frontend_env)
    origins.append(frontend_env.rstrip("/"))

# Clean up duplicate origins
origins = list(set(origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://.*\.onrender\.com",
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
        seed_default_templates()
        start_schedulers()
        print("[WhatsApp] Templates seeded and schedulers started.")
    except Exception as e:
        err_msg = str(e)
        if "bad auth" in err_msg or "8000" in err_msg:
            print(f"[WhatsApp] Startup Error: MongoDB Atlas authentication failed. Please check DATABASE_URL in backend/.env. Details: {e}")
        else:
            print(f"[WhatsApp] Startup initialization error: {e}")


@app.get("/")
def home():
    return {"message": "Backend Running Successfully"}