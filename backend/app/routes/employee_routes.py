from fastapi import APIRouter

from bson import ObjectId

from app.config.database import employee_collection

from app.models.employee_model import Employee

router = APIRouter()


# GET Employees

@router.get("/employees")
async def get_employees():

    employees = []

    for employee in employee_collection.find():

        employee["_id"] = str(employee["_id"])

        employees.append(employee)

    return employees


# ADD Employee

@router.post("/employees")
async def add_employee(employee: Employee):

    employee_dict = employee.dict()

    employee_collection.insert_one(employee_dict)

    return {
        "message": "Employee Added Successfully"
    }


# DELETE Employee

@router.delete("/employees/{employee_id}")
async def delete_employee(employee_id: str):

    employee_collection.delete_one(
        {"_id": ObjectId(employee_id)}
    )

    return {
        "message": "Employee Deleted Successfully"
    }


# UPDATE Employee

@router.put("/employees/{employee_id}")
async def update_employee(employee_id: str, employee: Employee):

    employee_collection.update_one(
        {"_id": ObjectId(employee_id)},
        {"$set": employee.dict()}
    )

    return {
        "message": "Employee Updated Successfully"
    }