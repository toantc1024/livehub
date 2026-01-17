"""
LiveHub Uploader - API Client
"""

from typing import Optional
from pathlib import Path
import os
import requests
from PIL import Image

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
    
    def upload_image(self, file_path: str, enhanced_image: Optional[Image.Image] = None) -> Optional[dict]:
        """Upload image to API."""
        if not self.token:
            return None
        
        upload_path = file_path
        temp_file_path = None
        
        if enhanced_image:
            import tempfile
            # Create temp file, close it immediately so we can re-open it for reading
            with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as tf:
                enhanced_image.save(tf.name, "JPEG", quality=95)
                upload_path = tf.name
                temp_file_path = tf.name
        
        try:
            with open(upload_path, "rb") as f:
                filename = Path(file_path).name
                resp = requests.post(
                    f"{self.api_url}/images/upload",
                    headers=self._headers(),
                    files={"file": (filename, f, "image/jpeg")},
                    timeout=60,
                )
            
            if resp.ok:
                return resp.json()
            else:
                print(f"Upload failed: {resp.status_code} - {resp.text}")
                return None
        except Exception as e:
            print(f"Upload error: {e}")
            return None
        finally:
            # Clean up temp file
            if temp_file_path and os.path.exists(temp_file_path):
                try:
                    os.unlink(temp_file_path)
                except Exception as e:
                    print(f"Failed to delete temp file: {e}")


# Global instance
api = APIClient()
