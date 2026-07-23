import os
import shutil
from fastapi import APIRouter, UploadFile, File, Header, HTTPException
from pydantic import BaseModel
from app.chatbot.service import ChatbotService
from app.chatbot.rag import RAGManager

router = APIRouter(prefix="/api/chatbot", tags=["chatbot"])

chatbot_service = ChatbotService()
rag_manager = RAGManager()

class QueryRequest(BaseModel):
    query: str

@router.post("/query")
async def query_chatbot(
    request: QueryRequest,
    x_user_email: str = Header("admin@delegatex.com", alias="X-User-Email"),
    x_user_role: str = Header("Administrator", alias="X-User-Role")
):
    """
    Answers the user's natural language query using the hybrid RAG pipeline.
    Applies role-based filtering based on user email and role.
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")
        
    try:
        answer = chatbot_service.answer_question(
            query=request.query,
            user_email=x_user_email,
            user_role=x_user_role
        )
        return {"answer": answer}
    except Exception as e:
        print(f"[Chatbot Router] Error: {str(e)}")
        raise HTTPException(status_code=500, detail="Error generating chatbot response")

@router.post("/upload-document")
async def upload_document(file: UploadFile = File(...)):
    """
    Uploads and indexes a custom PDF/DOCX/TXT/MD document.
    Saves it to the knowledge_base folder and triggers RAG indexer.
    """
    supported_exts = (".pdf", ".docx", ".doc", ".txt", ".md", ".markdown")
    filename = file.filename
    ext = os.path.splitext(filename)[1].lower()
    
    if ext not in supported_exts:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format '{ext}'. Supported formats: {', '.join(supported_exts)}"
        )
        
    # Save file to knowledge_base directory
    target_path = os.path.join(rag_manager.kb_dir, filename)
    try:
        with open(target_path, "wb") as f:
            shutil.copyfileobj(file.file, f)
            
        # Index document immediately
        indexed = rag_manager.index_file(target_path)
        if indexed:
            return {"message": f"Successfully uploaded and indexed document '{filename}'"}
        else:
            return {"message": f"Document '{filename}' uploaded but was skipped (already up to date or empty)"}
    except Exception as e:
        if os.path.exists(target_path):
            os.remove(target_path)
        print(f"[Chatbot Router] Upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to upload document: {str(e)}")

@router.get("/documents")
async def get_documents():
    """Returns a list of all currently indexed documents."""
    return {
        "documents": [
            {
                "filename": filename,
                "chunks": meta.get("chunks_count", 0),
                "size_bytes": meta.get("size", 0)
            }
            for filename, meta in rag_manager.indexing_meta.items()
        ]
    }

@router.delete("/clear")
async def clear_index():
    """Clears all indexed documents from vector store and index metadata."""
    try:
        rag_manager.clear_index()
        # Also clean physical files in knowledge_base directory
        for filename in os.listdir(rag_manager.kb_dir):
            file_path = os.path.join(rag_manager.kb_dir, filename)
            if os.path.isfile(file_path):
                os.remove(file_path)
        return {"message": "All documents cleared successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to clear indexes: {str(e)}")
