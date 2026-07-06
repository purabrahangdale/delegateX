from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import List, Optional
import json
import os
import time
from delegation_forms.service import DelegationFormService
from delegation_forms.model import DelegationForm

router = APIRouter()

# CREATE / UPDATE Form Template
@router.post("/delegation/forms")
async def create_or_update_form(form: DelegationForm):
    try:
        saved_form = DelegationFormService.create_form(form.dict())
        return {"success": True, "data": saved_form}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# GET All Form Templates
@router.get("/delegation/forms")
async def get_forms():
    try:
        forms = DelegationFormService.get_forms()
        return {"success": True, "data": forms}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# GET Single Form Template by ID
@router.get("/delegation/forms/{form_id}")
async def get_form_by_id(form_id: str):
    form = DelegationFormService.get_form_by_id(form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return {"success": True, "data": form}

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

    response_id = f"resp-{int(time.time() * 1000)}"

    saved_attachments = []
    if uploaded_files:
        for uf in uploaded_files:
            if uf and uf.filename:
                upload_dir = os.path.join("static", "delegation_uploads", response_id)
                os.makedirs(upload_dir, exist_ok=True)
                file_path = os.path.join(upload_dir, uf.filename)
                # Async read — correct for FastAPI async routes
                contents = await uf.read()
                with open(file_path, "wb") as f:
                    f.write(contents)
                web_path = f"/static/delegation_uploads/{response_id}/{uf.filename}"
                saved_attachments.append({
                    "fieldName": uf.filename,
                    "fileName": uf.filename,
                    "filePath": web_path
                })

    try:
        saved_response = DelegationFormService.submit_response(
            form_id=form_id,
            answers=answers,
            files=saved_attachments
        )
        return {"success": True, "data": {"message": "Response submitted successfully", "response": saved_response}}
    except ValueError as val_e:
        raise HTTPException(status_code=404, detail=str(val_e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# GET All Responses (or filter by form_id)
@router.get("/delegation/responses")
async def get_responses(formId: Optional[str] = None):
    try:
        responses = DelegationFormService.get_responses_by_form(formId)
        return {"success": True, "data": responses}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
