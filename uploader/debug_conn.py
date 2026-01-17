import requests
import os

API_URL = os.getenv("LIVEHUB_API_URL", "http://localhost:8080/api/v1")
print(f"Testing connection to {API_URL}...")

try:
    resp = requests.get(f"{API_URL}/auth/google/login/desktop", timeout=10)
    print(f"Status: {resp.status_code}")
    print(f"Content: {resp.text}")
except Exception as e:
    print(f"Error: {e}")
