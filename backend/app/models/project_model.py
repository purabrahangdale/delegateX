from pydantic import BaseModel
from typing import List, Optional

class Project(BaseModel):
    name: str
    description: str
    deadline: str
    status: str = "Pending"
    progress: int = 0
    tasks: int = 0
    team: List[str] = []
