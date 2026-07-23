import os
import json
from app.chatbot.loader import DocumentLoader
from app.chatbot.splitter import TextSplitter
from app.chatbot.vectorstore import VectorStore

class RAGManager:
    def __init__(self, kb_dir: str = "knowledge_base", persist_dir: str = "chroma_db"):
        self.kb_dir = kb_dir
        self.vector_store = VectorStore(persist_dir=persist_dir)
        self.splitter = TextSplitter()
        
        # Meta file to track indexed files
        self.meta_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "kb_indexing_meta.json"
        )
        self.indexing_meta = self._load_meta()

        # Ensure kb directory exists
        if not os.path.exists(self.kb_dir):
            os.makedirs(self.kb_dir, exist_ok=True)

    def _load_meta(self) -> dict:
        if os.path.exists(self.meta_file):
            try:
                with open(self.meta_file, "r") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _save_meta(self):
        try:
            with open(self.meta_file, "w") as f:
                json.dump(self.indexing_meta, f, indent=2)
        except Exception as e:
            print(f"[RAG] Error saving indexing metadata: {str(e)}")

    def index_file(self, file_path: str) -> bool:
        """Indexes a single file. Returns True if successfully indexed, False if skipped."""
        if not os.path.exists(file_path):
            print(f"[RAG] File does not exist: {file_path}")
            return False
            
        filename = os.path.basename(file_path)
        mtime = os.path.getmtime(file_path)
        size = os.path.getsize(file_path)
        
        # Check if file has already been indexed and has not changed
        meta = self.indexing_meta.get(filename)
        if meta and meta.get("mtime") == mtime and meta.get("size") == size:
            print(f"[RAG] Skipping unchanged file: {filename}")
            return False
            
        try:
            print(f"[RAG] Indexing file: {filename}...")
            text = DocumentLoader.load_document(file_path)
            if not text.strip():
                print(f"[RAG] Warning: File {filename} has no readable text. Skipping.")
                return False
                
            chunks = self.splitter.split_text(text)
            metadatas = [{"source": filename, "chunk_index": i} for i in range(len(chunks))]
            ids = [f"{filename}_chunk_{i}" for i in range(len(chunks))]
            
            self.vector_store.add_texts(chunks, metadatas, ids)
            
            # Save meta
            self.indexing_meta[filename] = {
                "mtime": mtime,
                "size": size,
                "chunks_count": len(chunks)
            }
            self._save_meta()
            print(f"[RAG] Successfully indexed {filename} ({len(chunks)} chunks).")
            return True
        except Exception as e:
            print(f"[RAG] Error indexing file {filename}: {str(e)}")
            return False

    def index_knowledge_base(self) -> dict:
        """Indexes all supported documents inside the knowledge base folder."""
        results = {"indexed": [], "skipped": [], "failed": []}
        if not os.path.exists(self.kb_dir):
            return results
            
        supported_exts = (".pdf", ".docx", ".txt", ".md", ".markdown")
        for filename in os.listdir(self.kb_dir):
            file_path = os.path.join(self.kb_dir, filename)
            if not os.path.isfile(file_path):
                continue
                
            if not filename.lower().endswith(supported_exts):
                continue
                
            status = self.index_file(file_path)
            if status:
                results["indexed"].append(filename)
            else:
                # Check if it was skipped or failed
                if filename in self.indexing_meta:
                    results["skipped"].append(filename)
                else:
                    results["failed"].append(filename)
                    
        return results

    def search_documents(self, query: str, k: int = 4) -> list:
        """Retrieves top K similar document chunks matching the query."""
        # Auto-index KB to fetch any new files before search
        self.index_knowledge_base()
        return self.vector_store.similarity_search(query, k=k)

    def clear_index(self):
        """Clears all indexed documents and vector database collections."""
        self.vector_store.clear()
        self.indexing_meta = {}
        self._save_meta()
        print("[RAG] All indexes cleared.")
