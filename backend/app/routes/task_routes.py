from fastapi import APIRouter, HTTPException, BackgroundTasks
from bson import ObjectId
from datetime import datetime, date
from app.config.database import task_collection, project_collection, employee_collection
from app.models.task_model import Task
from app.services.email_service import send_task_assignment_notification, send_task_assigned_client_notification

router = APIRouter()

# GET Tasks
@router.get("/tasks")
async def get_tasks():
    tasks = []
    current_date_str = date.today().isoformat()
    for t in task_collection.find():
        t["_id"] = str(t["_id"])
        
        # Populate fallbacks for tasks missing tracking fields
        if not t.get("assignedEmployee"):
            t["assignedEmployee"] = t.get("employee") or t.get("employee_name") or "Unassigned"
        if not t.get("assignedDate"):
            t["assignedDate"] = "2026-06-25"  # Mock start date for existing records
        if not t.get("updatedAt"):
            t["updatedAt"] = t.get("assignedDate")
        if not t.get("statusHistory"):
            t["statusHistory"] = [{
                "status": t.get("status") or "Pending",
                "changedAt": t.get("assignedDate")
            }]
            
        status_val = t.get("status") or "Pending"
        if status_val == "Completed" or status_val == "completed":
            if not t.get("completedDate"):
                t["completedDate"] = "2026-06-26"  # Mock completion date
            if t.get("totalWorkedDays") is None:
                try:
                    a_dt = date.fromisoformat(t["assignedDate"])
                    c_dt = date.fromisoformat(t["completedDate"])
                    t["totalWorkedDays"] = max(0, (c_dt - a_dt).days)
                except Exception:
                    t["totalWorkedDays"] = 1
        else:
            t["completedDate"] = None
            t["totalWorkedDays"] = None
            
        tasks.append(t)
    return tasks

# ADD Task
@router.post("/tasks")
async def add_task(task: Task, background_tasks: BackgroundTasks):
    task_dict = task.dict()

    current_date_str = date.today().isoformat()
    
    # Initialize auto tracking fields
    if not task_dict.get("assignedEmployee"):
        task_dict["assignedEmployee"] = task.employee
    if not task_dict.get("assignedDate"):
        task_dict["assignedDate"] = current_date_str
    if not task_dict.get("updatedAt"):
        task_dict["updatedAt"] = current_date_str
    if not task_dict.get("statusHistory"):
        task_dict["statusHistory"] = [{
            "status": task.status,
            "changedAt": current_date_str
        }]
        
    if task.status == "Completed" or task.status == "completed":
        task_dict["completedDate"] = current_date_str
        task_dict["totalWorkedDays"] = 0
    else:
        task_dict["completedDate"] = None
        task_dict["totalWorkedDays"] = None

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
    
    # WebSocket Event and Notification trigger
    task_dict["_id"] = str(task_dict.get("_id") or "")
    from app.websocket.events import broadcast_delegation_event, trigger_and_broadcast_notification
    import asyncio
    asyncio.create_task(broadcast_delegation_event("delegation_created", task_dict))
    asyncio.create_task(trigger_and_broadcast_notification(
        "task_assigned",
        "Task Assigned",
        f"Task '{task.title}' has been assigned to {task.employee} under project {task.project}."
    ))
    
    # Trigger background email notification
    background_tasks.add_task(send_task_assignment_notification, task_dict)
    # Trigger background email notification to customer
    background_tasks.add_task(send_task_assigned_client_notification, task_dict)
    
    return {
        "message": "Task Delegated Successfully"
    }


# UPDATE Task (for updating status e.g., in Kanban)
@router.put("/tasks/{task_id}")
async def update_task(task_id: str, task: Task):
    existing_task = task_collection.find_one({"_id": ObjectId(task_id)})
    if not existing_task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task_dict = task.dict()
    current_date_str = date.today().isoformat()
    
    # 1. Handle Employee Reassignment
    prev_employee = existing_task.get("employee")
    if prev_employee != task.employee:
        task_dict["assignedEmployee"] = task.employee
        task_dict["assignedDate"] = current_date_str
        if task.status != "Completed" and task.status != "completed":
            task_dict["completedDate"] = None
            task_dict["totalWorkedDays"] = None
    else:
        task_dict["assignedEmployee"] = existing_task.get("assignedEmployee") or task.employee
        task_dict["assignedDate"] = existing_task.get("assignedDate") or "2026-06-25"
        
    # 2. Handle Status Transition and Status History
    prev_status = existing_task.get("status")
    status_history = existing_task.get("statusHistory") or []
    
    if not status_history:
        status_history.append({
            "status": prev_status or "Pending",
            "changedAt": task_dict["assignedDate"]
        })
        
    if prev_status != task.status:
        status_history.append({
            "status": task.status,
            "changedAt": current_date_str
        })
        
        # Mark completed automatically if status is "Completed"
        if task.status == "Completed" or task.status == "completed":
            task_dict["completedDate"] = current_date_str
            try:
                a_dt = date.fromisoformat(task_dict["assignedDate"])
                c_dt = date.fromisoformat(current_date_str)
                task_dict["totalWorkedDays"] = max(0, (c_dt - a_dt).days)
            except Exception:
                task_dict["totalWorkedDays"] = 0
        else:
            task_dict["completedDate"] = None
            task_dict["totalWorkedDays"] = None
    else:
        task_dict["completedDate"] = existing_task.get("completedDate")
        task_dict["totalWorkedDays"] = existing_task.get("totalWorkedDays")
        
    task_dict["statusHistory"] = status_history
    task_dict["updatedAt"] = current_date_str
    
    # Remove _id from task_dict to prevent BSON/MongoDB ID collision errors
    if "_id" in task_dict:
        del task_dict["_id"]

    result = task_collection.update_one(
        {"_id": ObjectId(task_id)},
        {"$set": task_dict}
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
    
    # WebSocket Event and Notification trigger
    task_dict["_id"] = task_id
    from app.websocket.events import broadcast_delegation_event, trigger_and_broadcast_notification
    import asyncio
    asyncio.create_task(broadcast_delegation_event("task_updated", task_dict))
    asyncio.create_task(broadcast_delegation_event("employee_activity_updated", {
        "employee": task.employee,
        "activity": f"Updated task status to {task.status}",
        "timestamp": current_date_str
    }))
    
    if prev_status != task.status:
        if task.status.lower() == "completed":
            asyncio.create_task(broadcast_delegation_event("task_completed", task_dict))
            asyncio.create_task(trigger_and_broadcast_notification(
                "task_completed",
                "Task Completed",
                f"Task '{task.title}' has been marked as Completed by {task.employee}."
            ))
        else:
            asyncio.create_task(trigger_and_broadcast_notification(
                "task_status_updated",
                "Task Status Updated",
                f"Task '{task.title}' status changed from '{prev_status}' to '{task.status}'."
            ))
            
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
        
    from app.websocket.events import broadcast_delegation_event
    import asyncio
    asyncio.create_task(broadcast_delegation_event("task_deleted", {"_id": task_id}))
    
    return {
        "message": "Task Deleted Successfully"
    }


