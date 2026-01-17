"""
LiveHub Uploader - File Watcher
"""

import time
import hashlib
from pathlib import Path
from typing import Callable, Set

from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from config import SUPPORTED_EXTENSIONS


def get_file_hash(file_path: str) -> str:
    """Calculate MD5 hash of file."""
    hasher = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            hasher.update(chunk)
    return hasher.hexdigest()


class ImageHandler(FileSystemEventHandler):
    """Handler for new image files."""
    
    def __init__(self, on_new_file: Callable[[str], None]):
        self.on_new_file = on_new_file
    
    def on_created(self, event):
        if event.is_directory:
            return
        
        ext = Path(event.src_path).suffix.lower()
        if ext in SUPPORTED_EXTENSIONS:
            # Wait for file to be fully written
            time.sleep(0.5)
            self.on_new_file(event.src_path)


class FolderWatcher:
    """Watches a folder for new images."""
    
    def __init__(self, on_new_file: Callable[[str], None]):
        self.on_new_file = on_new_file
        self.observer = None
        self.is_watching = False
        self.folder_path = None
        self.uploaded_hashes: Set[str] = set()
    
    def set_folder(self, folder_path: str):
        """Set folder to watch."""
        self.folder_path = folder_path
    
    def start(self) -> bool:
        """Start watching folder."""
        if not self.folder_path:
            return False
        
        if self.is_watching:
            return True
        
        self.observer = Observer()
        handler = ImageHandler(self._handle_new_file)
        self.observer.schedule(handler, self.folder_path, recursive=True)
        self.observer.start()
        self.is_watching = True
        return True
    
    def stop(self):
        """Stop watching folder."""
        if self.observer:
            self.observer.stop()
            self.observer.join()
            self.observer = None
        self.is_watching = False
    
    def _handle_new_file(self, file_path: str):
        """Handle new file detected."""
        file_hash = get_file_hash(file_path)
        
        if file_hash in self.uploaded_hashes:
            return  # Already uploaded
        
        self.on_new_file(file_path)
    
    def mark_uploaded(self, file_path: str):
        """Mark file as uploaded."""
        try:
            file_hash = get_file_hash(file_path)
            self.uploaded_hashes.add(file_hash)
        except:
            pass
    
    def scan_folder(self) -> list:
        """Scan folder for existing images."""
        if not self.folder_path:
            return []
        
        files = []
        for file in Path(self.folder_path).rglob("*"):
            if file.suffix.lower() in SUPPORTED_EXTENSIONS:
                file_hash = get_file_hash(str(file))
                if file_hash not in self.uploaded_hashes:
                    files.append(str(file))
        
        return files
