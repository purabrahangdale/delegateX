import os
from pypdf import PdfReader
import docx

class DocumentLoader:
    @staticmethod
    def load_document(file_path: str) -> str:
        """
        Loads document content based on its file extension.
        Supports PDF, DOCX, TXT, MD.
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
            
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == ".pdf":
            return DocumentLoader._load_pdf(file_path)
        elif ext in (".docx", ".doc"):
            return DocumentLoader._load_docx(file_path)
        elif ext in (".txt", ".md", ".markdown"):
            return DocumentLoader._load_text(file_path)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

    @staticmethod
    def _load_pdf(file_path: str) -> str:
        text = ""
        try:
            reader = PdfReader(file_path)
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        except Exception as e:
            raise RuntimeError(f"Failed to read PDF file: {str(e)}")
        return text

    @staticmethod
    def _load_docx(file_path: str) -> str:
        try:
            doc = docx.Document(file_path)
            full_text = []
            for para in doc.paragraphs:
                full_text.append(para.text)
            return "\n".join(full_text)
        except Exception as e:
            raise RuntimeError(f"Failed to read DOCX file: {str(e)}")

    @staticmethod
    def _load_text(file_path: str) -> str:
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception as e:
            raise RuntimeError(f"Failed to read text file: {str(e)}")
