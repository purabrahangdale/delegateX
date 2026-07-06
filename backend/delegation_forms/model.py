from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class FormField(BaseModel):
    id: str
    type: str  # text, email, phone, number, date, dropdown, textarea, checkbox, file
    label: str
    placeholder: Optional[str] = ""
    required: bool = False
    options: Optional[List[str]] = []

class DelegationForm(BaseModel):
    id: Optional[str] = None
    title: str
    description: Optional[str] = ""
    fields: List[FormField] = []
    createdAt: Optional[str] = None

class FileAttachment(BaseModel):
    fieldName: str
    fileName: str
    filePath: str

class DelegationResponse(BaseModel):
    id: Optional[str] = None
    formId: str
    answers: Dict[str, Any]
    files: Optional[List[FileAttachment]] = []
    pdfPath: Optional[str] = None
    timestamp: Optional[str] = None
