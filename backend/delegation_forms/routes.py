from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import FileResponse
from typing import List, Optional
import json
import os
from delegation_forms.service import DelegationFormService
from delegation_forms.model import DelegationForm
from delegation_forms.response_handler import save_uploaded_file

router = APIRouter()

# CREATE / UPDATE Form Template
@router.post("/delegation/forms")
async def create_or_update_form(form: DelegationForm):
    try:
        saved_form = DelegationFormService.create_form(form.dict())
        return {"message": "Form template saved successfully", "form": saved_form}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# GET All Form Templates
@router.get("/delegation/forms")
async def get_forms():
    try:
        return DelegationFormService.get_forms()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# GET Single Form Template by ID
@router.get("/delegation/forms/{form_id}")
async def get_form_by_id(form_id: str):
    form = DelegationFormService.get_form_by_id(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form

# SUBMIT response (supporting optional file uploads)
@router.post("/delegation/forms/{form_id}/submit")
async def submit_response(
    form_id: str,
    answers_str: str = Form(...),
    uploaded_files: Optional[List[UploadFile]] = File(None)
):
    try:
        answers = json.loads(answers_str)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON format for answers")

    response_id = f"resp-{int(os.path.getmtime('.'))}" # fallback or generate inside service
    
    saved_attachments = []
    if uploaded_files:
        for uf in uploaded_files:
            if uf.filename:
                # Save attachment
                saved_file = save_uploaded_file(uf, response_id)
                saved_attachments.append(saved_file)
                
    try:
        saved_response = DelegationFormService.submit_response(
            form_id=form_id,
            answers=answers,
            files=saved_attachments
        )
        return {"message": "Response submitted successfully", "response": saved_response}
    except ValueError as val_e:
        raise HTTPException(status_code=404, detail=str(val_e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# GET All Responses (or filter by form_id)
@router.get("/delegation/responses")
async def get_responses(formId: Optional[str] = None):
    try:
        return DelegationFormService.get_responses_by_form(formId)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
