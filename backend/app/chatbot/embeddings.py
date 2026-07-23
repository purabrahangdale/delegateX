import os
import requests
from dotenv import load_dotenv

load_dotenv()

class EmbeddingsService:
    def __init__(self):
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")
        self.client_configured = False
        
        if self.gemini_api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.gemini_api_key)
                self.client_configured = True
            except Exception as e:
                print(f"[Embeddings] SDK config failed: {str(e)}")
        
    def embed_text(self, text: str) -> list:
        """
        Generates vector embeddings for a given string text.
        Tries Gemini SDK/API first, then OpenAI API. Falls back to a mock embedding.
        """
        # 1. Try Gemini Embeddings (via SDK)
        if self.gemini_api_key:
            try:
                import google.generativeai as genai
                # Use standard embedding model: models/gemini-embedding-001
                result = genai.embed_content(
                    model="models/gemini-embedding-001",
                    content=text
                )
                if "embedding" in result:
                    return result["embedding"]
            except Exception as sdk_err:
                print(f"[Embeddings] Gemini SDK embed failed: {str(sdk_err)}. Trying direct API fallback...")
                
                # Fallback to direct HTTP endpoint using gemini-embedding-001
                try:
                    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key={self.gemini_api_key}"
                    headers = {"Content-Type": "application/json"}
                    payload = {
                        "model": "models/gemini-embedding-001",
                        "content": {
                            "parts": [{"text": text}]
                        }
                    }
                    res = requests.post(url, headers=headers, json=payload, timeout=10)
                    if res.status_code == 200:
                        data = res.json()
                        if "embedding" in data and "values" in data["embedding"]:
                            return data["embedding"]["values"]
                except Exception as api_err:
                    print(f"[Embeddings] Gemini direct API fallback failed: {str(api_err)}")

        # 2. Try OpenAI Embeddings
        if self.openai_api_key:
            try:
                url = "https://api.openai.com/v1/embeddings"
                headers = {
                    "Authorization": f"Bearer {self.openai_api_key}",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "text-embedding-3-small",
                    "input": text
                }
                res = requests.post(url, headers=headers, json=payload, timeout=10)
                if res.status_code == 200:
                    data = res.json()
                    if "data" in data and len(data["data"]) > 0:
                        return data["data"][0]["embedding"]
                print(f"[Embeddings] OpenAI embedding failed: {res.text}")
            except Exception as e:
                print(f"[Embeddings] OpenAI API error: {str(e)}")

        # 3. Fallback: Return a mock deterministic vector if no keys are found
        print("[Embeddings] Warning: Using mock embeddings fallback.")
        return self._generate_mock_embedding(text)

    def embed_documents(self, texts: list) -> list:
        return [self.embed_text(t) for t in texts]

    def _generate_mock_embedding(self, text: str, dimension: int = 1536) -> list:
        """Generates a deterministic pseudo-random embedding vector of size `dimension` based on text hash."""
        import random
        # Hash text to seed random generator
        val = hash(text)
        random.seed(val)
        vec = [random.uniform(-1, 1) for _ in range(dimension)]
        # Normalize vector
        magnitude = sum(x**2 for x in vec) ** 0.5
        if magnitude > 0:
            vec = [x / magnitude for x in vec]
        return vec

