from pydantic import BaseModel


class Employee(BaseModel):

    name: str

    role: str

    project: str

    status: str = "Active"