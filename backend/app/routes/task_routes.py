from fastapi import APIRouter, HTTPException
from bson import ObjectId
from app.config.database import task_collection, project_collection, employee_collection
from app.models.task_model import Task

router = APIRouter()

# GET Tasks
@router.get("/tasks")
async def get_tasks():
    tasks = []
    for t in task_collection.find():
        t["_id"] = str(t["_id"])
        tasks.append(t)
    return tasks

# ADD Task
@router.post("/tasks")
async def add_task(task: Task):
    task_dict = task.dict()
    task_collection.insert_one(task_dict)
    
    # Update the project's team with the employee name
    project_collection.update_one(
        {"name": task.project},
        {"$addToSet": {"team": task.employee}}
    )
    
    # Update the employee's project and assigned_projects fields
    employee_collection.update_one(
        {"name": task.employee},
        {
            "$set": {"project": task.project},
            "$addToSet": {"assigned_projects": task.project}
        }
    )
    
    return {
        "message": "Task Delegated Successfully"
    }

# UPDATE Task (for updating status e.g., in Kanban)
@router.put("/tasks/{task_id}")
async def update_task(task_id: str, task: Task):
    result = task_collection.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": task.dict()}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # Update the project's team with the employee name
    project_collection.update_one(
        {"name": task.project},
        {"$addToSet": {"team": task.employee}}
    )
    
    # Update the employee's project and assigned_projects fields
    employee_collection.update_one(
        {"name": task.employee},
        {
            "$set": {"project": task.project},
            "$addToSet": {"assigned_projects": task.project}
        }
    )
    
    return {
        "message": "Task Updated Successfully"
    }

# DELETE Task
@router.delete("/tasks/{task_id}")
async def delete_task(task_id: str):
    result = task_collection.delete_one(
        {"_id": ObjectId(task_id)}
    )
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {
        "message": "Task Deleted Successfully"
    }
