"""
LiveHub Uploader - Local Storage
Simple JSON-based storage for settings and upload tracking.
"""

import json
from pathlib import Path
from typing import Any, Optional, Set

from config import DATA_DIR


class Storage:
    """Simple JSON-based storage."""
    
    def __init__(self, filename: str = "uploader_data.json"):
        self.file_path = DATA_DIR / filename
        self._data = self._load()
    
    def _load(self) -> dict:
        if self.file_path.exists():
            try:
                with open(self.file_path, "r") as f:
                    return json.load(f)
            except:
                pass
        return {}
    
    def _save(self):
        with open(self.file_path, "w") as f:
            json.dump(self._data, f, indent=2)
    
    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key, default)
    
    def set(self, key: str, value: Any):
        self._data[key] = value
        self._save()
    
    def delete(self, key: str):
        if key in self._data:
            del self._data[key]
            self._save()
    
    # Convenience methods
    
    def get_token(self) -> Optional[str]:
        return self.get("token")
    
    def set_token(self, token: str):
        self.set("token", token)
    
    def clear_token(self):
        self.delete("token")
    
    def get_watch_folder(self) -> Optional[str]:
        return self.get("watch_folder")
    
    def set_watch_folder(self, folder: str):
        self.set("watch_folder", folder)
    
    def get_uploaded_hashes(self) -> Set[str]:
        return set(self.get("uploaded_hashes", []))
    
    def add_uploaded_hash(self, file_hash: str):
        hashes = self.get_uploaded_hashes()
        hashes.add(file_hash)
        self.set("uploaded_hashes", list(hashes))
    
    def get_auto_upload(self) -> bool:
        return self.get("auto_upload", True)
    
    def set_auto_upload(self, value: bool):
        self.set("auto_upload", value)
    
    def get_enhance_enabled(self) -> bool:
        return self.get("enhance_enabled", True)
    
    def set_enhance_enabled(self, value: bool):
        self.set("enhance_enabled", value)


# Global instance
storage = Storage()
