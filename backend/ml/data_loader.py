import os
from supabase import create_client
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

def fetch_corrections():
    if not SUPABASE_SERVICE_ROLE_KEY:
        print("Warning: SUPABASE_SERVICE_ROLE_KEY is not set. Returning empty corrections.")
        return []
    try:
        sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        response = sb.table("expense_corrections").select("raw_text, corrected_category").execute()
        return response.data
    except Exception as e:
        print(f"Error fetching corrections from Supabase: {e}")
        return []
