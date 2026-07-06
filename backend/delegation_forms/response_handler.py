import os
import shutil
from fastapi import UploadFile

def save_uploaded_file(upload_file: UploadFile, response_id: str) -> dict:
    upload_dir = os.path.join("static", "delegation_uploads", response_id)
    os.makedirs(upload_dir, exist_ok=True)
    
    file_path = os.path.join(upload_dir, upload_file.filename)
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(upload_file.file, buffer)
        
    web_path = f"/static/delegation_uploads/{response_id}/{upload_file.filename}"
    return {
        "fieldName": upload_file.filename, # standard fallback
        "fileName": upload_file.filename,
        "filePath": web_path
    }
