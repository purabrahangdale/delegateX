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


@app.get("/")
def home():
    return {"message": "Backend Running Successfully"}