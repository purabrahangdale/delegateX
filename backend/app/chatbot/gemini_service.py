import os
import logging
from dotenv import load_dotenv

# Set up logging for backend debugging
logger = logging.getLogger("chatbot.gemini")
logger.setLevel(logging.INFO)

load_dotenv()

class GeminiService:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(GeminiService, cls).__new__(cls, *args, **kwargs)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
            
        self.api_key = os.getenv("GEMINI_API_KEY")
        self.model_name = "gemini-2.5-flash"
        self.client_configured = False
        
        if not self.api_key:
            logger.error("GEMINI_API_KEY not found in environment variables.")
            print("GEMINI_API_KEY not found in environment variables.")
            self._initialized = True
            return
            
        try:
            import google.generativeai as genai
            genai.configure(api_key=self.api_key)
            self.client_configured = True
            logger.info("Gemini API initialized successfully.")
            print("Gemini API initialized successfully.")
        except Exception as e:
            logger.exception("Failed to initialize Google Generative AI SDK: %s", str(e))
            
        self._initialized = True

    def generate_chat_response(self, prompt: str, system_instruction: str) -> str:
        """
        Generates content from the Gemini API using gemini-2.5-flash.
        Includes robust exception handling and logs detailed errors securely.
        """
        if not self.api_key:
            logger.error("GEMINI_API_KEY not found in environment variables.")
            return (
                "⚠️ **Gemini API Key Missing**\n\n"
                "The chatbot is not configured. Please add `GEMINI_API_KEY` to the backend `.env` file and restart the server."
            )
            
        if not self.client_configured:
            return "⚠️ **Gemini Client Configuration Error**: The Gemini SDK failed to initialize. Please check backend logs."

        logger.info("Gemini API request started.")
        print("Gemini API request started.")

        try:
            import google.generativeai as genai
            from google.api_core.exceptions import (
                GoogleAPICallError, 
                InvalidArgument, 
                ResourceExhausted, 
                ServiceUnavailable
            )
            
            # Configure model with system instructions
            model = genai.GenerativeModel(
                model_name=self.model_name,
                system_instruction=system_instruction
            )
            
            # Request response completion
            response = model.generate_content(
                prompt,
                generation_config={"temperature": 0.2}
            )
            
            if response and response.text:
                logger.info("Gemini API response received.")
                print("Gemini API response received.")
                return response.text
                
            logger.error("Gemini returned empty response.")
            return "⚠️ **Empty Response**: Gemini returned an empty response."
            
        except InvalidArgument as e:
            logger.error("Gemini API error (InvalidArgument) occurred: %s", str(e), exc_info=True)
            if "key" in str(e).lower() or "api" in str(e).lower():
                return "⚠️ **Invalid API Key**: The configured GEMINI_API_KEY is invalid. Please check your credentials."
            return f"⚠️ **Invalid Request Parameters**: The request parameters are invalid."
            
        except ResourceExhausted as e:
            logger.error("Gemini API error (ResourceExhausted) occurred: %s", str(e), exc_info=True)
            return "⚠️ **Rate Limit Exceeded**: Too many requests are being sent to the Gemini API. Please wait a moment before trying again."
            
        except ServiceUnavailable as e:
            logger.error("Gemini API error (ServiceUnavailable) occurred: %s", str(e), exc_info=True)
            return "⚠️ **Gemini Service Unavailable**: The Gemini API service is currently down or overloaded. Please try again later."
            
        except GoogleAPICallError as e:
            logger.error("Gemini API error (GoogleAPICallError) occurred: %s", str(e), exc_info=True)
            return "⚠️ **Gemini API Error**: An error occurred while communicating with the Gemini service."
            
        except Exception as e:
            logger.exception("Unexpected chatbot completion error occurred: %s", str(e))
            # Return user friendly generic message without exposing internal stacktrace details
            return "⚠️ **Unexpected Error**: The system encountered an error processing your message. Please try again."

