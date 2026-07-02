from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.employee_routes import router as employee_router
from app.routes.project_routes import router as project_router
from app.routes.task_routes import router as task_router
from app.websocket.delegation_socket import router as delegation_ws_router
from app.websocket.crm_socket import router as crm_ws_router
from app.websocket.notifications import router as notifications_router
from app.routes.crm_routes import router as crm_router


app = FastAPI()

# CORS

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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


@app.get("/")
def home():
    return {"message": "Backend Running Successfully"}