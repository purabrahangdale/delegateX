from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.config.database import project_collection
from app.models.project_model import Project

router = APIRouter()

# GET Projects
@router.get("/projects")
async def get_projects():
    projects = []
    for p in project_collection.find():
        p["_id"] = str(p["_id"])
        projects.append(p)
    return projects

# ADD Project
@router.post("/projects")
async def add_project(project: Project):
    project_dict = project.dict()
    project_collection.insert_one(project_dict)
    return {
        "message": "Project Created Successfully"
    }

# UPDATE Project
@router.put("/projects/{project_id}")
async def update_project(project_id: str, project: Project):
    result = project_collection.update_one(
        {"_id": ObjectId(project_id)},
        {"$set": project.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "message": "Project Updated Successfully"
    }

# DELETE Project
@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    result = project_collection.delete_one(
        {"_id": ObjectId(project_id)}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {
        "message": "Project Deleted Successfully"
    }
