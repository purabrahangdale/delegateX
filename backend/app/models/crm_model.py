from pydantic import BaseModel, validator
from typing import Optional, List, Any
import re

class Lead(BaseModel):
    name: str
    phone: str
    email: str
    contact: Optional[str] = None
    spouseName: Optional[str] = None
    spouseMobile: Optional[str] = None
    leadSource: str = "Walk-In"
    referredBy: Optional[str] = None
    referrerPhone: Optional[str] = None
    referralEmail: Optional[str] = None
    projectType: str = "Residential"
    value: Optional[float] = 0.0
    status: str = "Contacted"
    requirements: Optional[str] = None
    stage: Optional[str] = "Enquiry"
    priority: Optional[str] = "Medium"
    assignedTo: Optional[str] = "Sarah Jenkins"
    budget: Optional[str] = None
    date: Optional[str] = None
    id: Optional[Any] = None

    @validator("email")
    def validate_email_format(cls, v):
        email_regex = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
        if not re.match(email_regex, v):
            raise ValueError("Invalid email format")
        return v


class Meeting(BaseModel):
    leadId: Any
    clientName: str
    category: str
    location: str
    date: str
    time: str
    duration: str = "30 mins"
    phone: Optional[str] = None
    notes: Optional[str] = None
    attendees: Optional[List[str]] = None
    status: str = "Scheduled"
