import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL") or os.getenv("DATABASE_URL")

if not MONGO_URL:
    raise ValueError("MongoDB database connection URL is not set in environment variables.")

client = MongoClient(MONGO_URL)
db = client["delegation_system"]

employee_collection = db["employees"]
project_collection = db["projects"]
task_collection = db["tasks"]