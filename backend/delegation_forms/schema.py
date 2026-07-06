from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from delegation_forms.model import FormField

class FormCreateSchema(BaseModel):
    title: str
    description: Optional[str] = ""
    fields: List[FormField] = []

class FormResponseSchema(BaseModel):
    id: str
    title: str
    description: str
    fields: List[FormField]
    createdAt: str

class ResponseSubmitSchema(BaseModel):
    answers: Dict[str, Any]
