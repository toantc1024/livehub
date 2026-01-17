"""
LiveHub Uploader - API Client
"""

from typing import Optional
from pathlib import Path
import os
import requests

from config import API_URL


class APIClient:
    """Client for LiveHub API."""
    
    def __init__(self):
        self.api_url = API_URL
        self.token: Optional[str] = None
    
    def set_token(self, token: str):
        self.token = token
    
    def clear_token(self):
        self.token = None
    
    def _headers(self) -> dict:
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers
    
    def get_login_url(self) -> Optional[str]:
        """Get Google OAuth login URL for desktop app."""
        try:
            resp = requests.get(f"{self.api_url}/auth/google/login/desktop", timeout=10)
            if resp.ok:
                return resp.json().get("url")
        except Exception as e:
            print(f"Get login URL error: {e}")
        return None
    
    def validate_token(self) -> Optional[dict]:
        """Validate token and return user info."""
        if not self.token:
            return None
        try:
            resp = requests.get(
                f"{self.api_url}/auth/validate",
                headers=self._headers(),
                timeout=10,
            )
            if resp.ok:
                return resp.json()
        except Exception as e:
            print(f"Token validation error: {e}")
        return None
    
    def is_admin(self) -> bool:
        """Check if current user is admin."""
        result = self.validate_token()
        if result:
            return result.get("user", {}).get("role") == "ADMIN"
        return False
    
    def get_user_info(self) -> Optional[dict]:
        """Get current user info."""
        result = self.validate_token()
        if result:
            return result.get("user")
        return None
    
    def upload_image(self, file_path: str) -> Optional[dict]:
        """
        Upload image to API with automatic optimization.
        
        Images are automatically compressed to be under server limit
        while maintaining highest possible quality.
        """
        if not self.token:
            return None
        
        from image_processor import process_for_upload
        
        try:
            # Process and optimize image
            img_bytes, filename, metadata = process_for_upload(file_path)
            
            # Create file-like object from bytes
            import io
            file_obj = io.BytesIO(img_bytes)
            
            # Upload
            resp = requests.post(
                f"{self.api_url}/images/upload",
                headers=self._headers(),
                files={"file": (filename, file_obj, "image/jpeg")},
                timeout=120,  # Increased timeout for large files
            )
            
            if resp.ok:
                result = resp.json()
                result["_upload_metadata"] = metadata
                return result
            else:
                print(f"Upload failed: {resp.status_code} - {resp.text}")
                return None
        except Exception as e:
            print(f"Upload error: {e}")
            import traceback
            traceback.print_exc()
            return None


# Global instance
api = APIClient()
