from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class Task(BaseModel):
    title: str
    description: str
    employee: str
    project: str
    priority: str
    deadline: str
    status: str = "Pending"
    employee_id: Optional[str] = None
    employee_name: Optional[str] = None
    
    # Tracking fields
    assignedEmployee: Optional[str] = None
    assignedDate: Optional[str] = None
    completedDate: Optional[str] = None
    updatedAt: Optional[str] = None
    statusHistory: Optional[List[Dict[str, Any]]] = None
    totalWorkedDays: Optional[int] = None

