from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.employee_routes import router as employee_router
from app.routes.project_routes import router as project_router
from app.routes.task_routes import router as task_router

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

@app.get("/")
def home():
    return {"message": "Backend Running Successfully"}