from datetime import datetime
from bson import ObjectId
from app.config.database import delegation_form_collection, delegation_response_collection
from delegation_forms.model import DelegationForm, DelegationResponse
from delegation_forms.pdf_service import generate_delegation_pdf
import os

class DelegationFormService:
    @staticmethod
    def create_form(form_data: dict) -> dict:
        form_id = form_data.get("id") or f"form-{int(datetime.utcnow().timestamp() * 1000)}"
        form_data["id"] = form_id
        form_data["createdAt"] = datetime.utcnow().isoformat()
        
        # Insert or update
        delegation_form_collection.update_one(
            {"id": form_id},
            {"$set": form_data},
            upsert=True
        )
        return form_data

    @staticmethod
    def get_forms() -> list:
        forms = []
        for doc in delegation_form_collection.find():
            doc["_id"] = str(doc["_id"])
            forms.append(doc)
        return forms

    @staticmethod
    def get_form_by_id(form_id: str) -> dict:
        doc = delegation_form_collection.find_one({"id": form_id})
        if doc:
            doc["_id"] = str(doc["_id"])
            return doc
        return None

    @staticmethod
    def submit_response(form_id: str, answers: dict, files: list = None) -> dict:
        form = DelegationFormService.get_form_by_id(form_id)
        if not form:
            raise ValueError("Form template not found")
            
        response_id = f"resp-{int(datetime.utcnow().timestamp() * 1000)}"
        timestamp = datetime.utcnow().isoformat()
        
        # Build response dict
        response_data = {
            "id": response_id,
            "formId": form_id,
            "answers": answers,
            "files": files or [],
            "timestamp": timestamp,
            "pdfPath": None
        }
        
        # Generate professional PDF
        try:
            pdf_path = generate_delegation_pdf(
                form_title=form.get("title", "Delegation Form"),
                form_description=form.get("description", ""),
                answers=answers,
                fields=form.get("fields", []),
                response_id=response_id,
                timestamp=timestamp
            )
            # Standardize path for web serving via dynamic route
            web_pdf_path = f"/delegation/responses/{response_id}/pdf"
            response_data["pdfPath"] = web_pdf_path
        except Exception as e:
            print("Failed to generate PDF:", str(e))
            
        # Save to DB
        delegation_response_collection.insert_one(response_data)
        # Remove the ObjectId injected by MongoDB so it's JSON-serializable
        response_data.pop("_id", None)
        # Enrich with form title for the frontend
        response_data["formTitle"] = form.get("title", "Delegation Form")
        
        return response_data
 
    @staticmethod
    def get_responses_by_form(form_id: str = None) -> list:
        query = {"formId": form_id} if form_id else {}
        responses = []
        for doc in delegation_response_collection.find(query):
            doc["_id"] = str(doc["_id"])
            
            # Enrich with form name/details
            f_doc = delegation_form_collection.find_one({"id": doc.get("formId")})
            if f_doc:
                doc["formTitle"] = f_doc.get("title")
            else:
                doc["formTitle"] = "Unknown Form"
            
            # Use dynamic PDF endpoint
            doc["pdfPath"] = f"/delegation/responses/{doc.get('id')}/pdf"
                
            responses.append(doc)
        return responses
