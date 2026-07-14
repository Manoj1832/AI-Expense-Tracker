import os
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://celqwclvswspldqarvbs.supabase.co")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
TRAINING_API_KEY = os.environ.get("TRAINING_API_KEY", "super-secret-training-key")
MODELS_DIR = os.environ.get("MODELS_DIR", "models")
