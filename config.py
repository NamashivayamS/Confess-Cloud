import os
from dotenv import load_dotenv
from supabase import create_client

load_dotenv()

# Flask / App secrets
SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_key")
ADMIN_KEY = os.getenv("ADMIN_KEY", "admin123")

# Supabase credentials
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("Supabase credentials are missing")

# Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
