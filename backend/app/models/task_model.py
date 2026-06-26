from pydantic import BaseModel
from typing import Optional

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
