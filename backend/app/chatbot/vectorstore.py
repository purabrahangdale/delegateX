import os
import json
from app.chatbot.embeddings import EmbeddingsService

# Dual-mode Vector Store
# Tries to use ChromaDB if available, otherwise falls back to a clean flat-file index.
class VectorStore:
    def __init__(self, persist_dir: str = "chroma_db"):
        self.persist_dir = persist_dir
        self.embeddings_service = EmbeddingsService()
        self.chroma_client = None
        self.chroma_collection = None
        
        # Flat file fallback config
        self.fallback_file = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "vector_store_fallback.json"
        )
        self.fallback_data = []
        
        # Try to initialize ChromaDB
        try:
            import chromadb
            # If chromadb imports successfully, set up the client
            self.chroma_client = chromadb.PersistentClient(path=self.persist_dir)
            self.chroma_collection = self.chroma_client.get_or_create_collection(
                name="knowledge_base",
                metadata={"hnsw:space": "cosine"}
            )
            print("[VectorStore] ChromaDB initialized successfully.")
        except Exception as e:
            print(f"[VectorStore] ChromaDB load failed, using JSON flat-file fallback: {str(e)}")
            self._load_fallback_data()

    def _load_fallback_data(self):
        if os.path.exists(self.fallback_file):
            try:
                with open(self.fallback_file, "r") as f:
                    self.fallback_data = json.load(f)
                print(f"[VectorStore] Loaded {len(self.fallback_data)} records from flat-file index.")
            except Exception as e:
                print(f"[VectorStore] Error loading flat-file data: {str(e)}")
                self.fallback_data = []

    def _save_fallback_data(self):
        try:
            with open(self.fallback_file, "w") as f:
                json.dump(self.fallback_data, f, indent=2)
        except Exception as e:
            print(f"[VectorStore] Error saving flat-file data: {str(e)}")

    def add_texts(self, texts: list, metadatas: list = None, ids: list = None):
        """Adds texts and metadata to the vector store."""
        if not texts:
            return
            
        metadatas = metadatas or [{} for _ in texts]
        ids = ids or [f"doc_{i}_{hash(txt)}" for i, txt in enumerate(texts)]
        embeddings = self.embeddings_service.embed_documents(texts)
        
        if self.chroma_collection:
            try:
                self.chroma_collection.add(
                    documents=texts,
                    metadatas=metadatas,
                    ids=ids,
                    embeddings=embeddings
                )
                print(f"[VectorStore] Added {len(texts)} documents to ChromaDB.")
                return
            except Exception as e:
                print(f"[VectorStore] ChromaDB add error: {str(e)}. Falling back to JSON storage.")
        
        # Fallback implementation
        for txt, meta, uid, emb in zip(texts, metadatas, ids, embeddings):
            # Check if exists and update, or append
            existing = next((item for item in self.fallback_data if item["id"] == uid), None)
            if existing:
                existing["text"] = txt
                existing["metadata"] = meta
                existing["embedding"] = emb
            else:
                self.fallback_data.append({
                    "id": uid,
                    "text": txt,
                    "metadata": meta,
                    "embedding": emb
                })
        self._save_fallback_data()
        print(f"[VectorStore] Added {len(texts)} documents to flat-file index.")

    def similarity_search(self, query: str, k: int = 4) -> list:
        """Performs cosine similarity search for a query and returns top K documents."""
        query_embedding = self.embeddings_service.embed_text(query)
        
        if self.chroma_collection:
            try:
                results = self.chroma_collection.query(
                    query_embeddings=[query_embedding],
                    n_results=k
                )
                documents = results.get("documents", [[]])[0]
                metadatas = results.get("metadatas", [[]])[0]
                # Format to standard dict format
                search_results = []
                for doc, meta in zip(documents, metadatas):
                    search_results.append({
                        "text": doc,
                        "metadata": meta
                    })
                return search_results
            except Exception as e:
                print(f"[VectorStore] ChromaDB search error: {str(e)}. Falling back to JSON query.")

        # Fallback calculation
        def dot_product(v1, v2):
            return sum(x * y for x, y in zip(v1, v2))
            
        def magnitude(v):
            return sum(x**2 for x in v) ** 0.5

        scored_items = []
        q_mag = magnitude(query_embedding)
        
        for item in self.fallback_data:
            emb = item["embedding"]
            meta = item["metadata"]
            txt = item["text"]
            
            # Compute dot product
            dot = dot_product(query_embedding, emb)
            item_mag = magnitude(emb)
            
            # Compute Cosine Similarity
            denom = q_mag * item_mag
            score = dot / denom if denom > 0 else 0
            
            scored_items.append({
                "score": score,
                "text": txt,
                "metadata": meta
            })
            
        # Sort descending
        scored_items = sorted(scored_items, key=lambda x: x["score"], reverse=True)
        return scored_items[:k]

    def clear(self):
        """Clears all records in the vector store."""
        if self.chroma_client and self.chroma_collection:
            try:
                self.chroma_client.delete_collection("knowledge_base")
                self.chroma_collection = self.chroma_client.get_or_create_collection(
                    name="knowledge_base",
                    metadata={"hnsw:space": "cosine"}
                )
                print("[VectorStore] ChromaDB collection cleared.")
                return
            except Exception as e:
                print(f"[VectorStore] ChromaDB clear error: {str(e)}")
                
        self.fallback_data = []
        self._save_fallback_data()
        print("[VectorStore] Flat-file index cleared.")
