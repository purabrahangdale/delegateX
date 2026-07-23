from app.chatbot.db_retriever import DatabaseRetriever
from app.chatbot.rag import RAGManager


class InformationRetriever:
    """
    Hybrid retriever: fetches structured live DB context via DatabaseRetriever
    and RAG document chunks via RAGManager, then merges them for the LLM.
    """

    def __init__(self, kb_dir: str = "knowledge_base", persist_dir: str = "chroma_db"):
        self.rag_manager = RAGManager(kb_dir=kb_dir, persist_dir=persist_dir)
        self.db_retriever = DatabaseRetriever()

    def retrieve_context(self, query: str, user_email: str, user_role: str) -> dict:
        """
        Returns a dict with:
          - is_manager (bool)
          - db_context  (pre-computed structured analytics string)
          - doc_chunks  (list of matching RAG document chunks)
        """
        # 1. Build structured live DB context (includes RBAC)
        db_context, is_manager = self.db_retriever.build_context(
            user_email=user_email,
            user_role=user_role,
        )

        # 2. Retrieve RAG document chunks
        doc_chunks = self.rag_manager.search_documents(query, k=4)

        # 3. Filter confidential docs for non-managers
        filtered_doc_chunks = []
        for chunk in doc_chunks:
            source = chunk.get("metadata", {}).get("source", "")
            is_confidential = (
                "confidential" in source.lower()
                or "restricted" in source.lower()
                or "sop" in source.lower()
            )
            if is_confidential and not is_manager:
                continue
            filtered_doc_chunks.append(chunk)

        return {
            "is_manager": is_manager,
            "db_context": db_context,
            "doc_chunks": filtered_doc_chunks,
        }
