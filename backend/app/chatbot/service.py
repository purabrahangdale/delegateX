import os
from dotenv import load_dotenv
from app.chatbot.retriever import InformationRetriever
from app.chatbot.prompts import CHATBOT_SYSTEM_PROMPT
from app.chatbot.gemini_service import GeminiService

load_dotenv()

class ChatbotService:
    def __init__(self, kb_dir: str = "knowledge_base", persist_dir: str = "chroma_db"):
        self.retriever = InformationRetriever(kb_dir=kb_dir, persist_dir=persist_dir)
        self.gemini_service = GeminiService()
        self.openai_api_key = os.getenv("OPENAI_API_KEY")

    def answer_question(self, query: str, user_email: str, user_role: str) -> str:
        """
        Retrieves context, formats prompts, calls the configured LLM API (Gemini or OpenAI),
        and returns the synthesized answer.
        """
        # 1. Retrieve hybrid context
        context = self.retriever.retrieve_context(query, user_email, user_role)
        is_manager = context["is_manager"]
        db_context = context["db_context"]
        
        # Format document context
        doc_chunks = context["doc_chunks"]
        if doc_chunks:
            doc_context = "\n\n".join([
                f"[Source Document: {chunk['metadata'].get('source')}]\n{chunk['text']}"
                for chunk in doc_chunks
            ])
        else:
            doc_context = "No relevant policy or SOP documents were found matching this query."

        # 2. Format the system prompt
        system_prompt = CHATBOT_SYSTEM_PROMPT.format(
            user_email=user_email,
            user_role=user_role,
            is_manager=str(is_manager),
            db_context=db_context,
            doc_context=doc_context
        )

        # 3. Call LLM API
        
        # Plan A: Gemini SDK Service
        if self.gemini_service.api_key:
            return self.gemini_service.generate_chat_response(
                prompt=f"User Question: {query}\nPlease answer the question based on the guidelines above.",
                system_instruction=system_prompt
            )

        # Plan B: OpenAI API Fallback
        if self.openai_api_key:
            try:
                import requests
                url = "https://api.openai.com/v1/chat/completions"
                headers = {
                    "Authorization": f"Bearer {self.openai_api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": query}
                    ],
                    "temperature": 0.1
                }
                res = requests.post(url, headers=headers, json=payload, timeout=30)
                if res.status_code == 200:
                    data = res.json()
                    choices = data.get("choices", [])
                    if choices and len(choices) > 0:
                        return choices[0].get("message", {}).get("content", "")
                print(f"[Chatbot] OpenAI LLM API failed: {res.text}")
            except Exception as e:
                print(f"[Chatbot] OpenAI LLM API exception: {str(e)}")

        # Plan C: Fallback warning if no API keys are provided
        return (
            "⚠️ **API Configuration Required**\n\n"
            "Please configure a `GEMINI_API_KEY` or `OPENAI_API_KEY` in the backend's `.env` file to enable the AI assistant.\n\n"
            "Once configured, restart the backend server so the settings take effect."
        )

