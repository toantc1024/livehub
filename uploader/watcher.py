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
        # Debounce: track recently processed files to avoid duplicates
        self._processed_files: dict = {}  # path -> timestamp
        self._debounce_seconds = 2.0  # Ignore same file within 2 seconds
    
    def _should_process(self, file_path: str) -> bool:
        """Check if file should be processed (debounce check)."""
        now = time.time()
        last_processed = self._processed_files.get(file_path, 0)
        
        if now - last_processed < self._debounce_seconds:
            return False  # Recently processed, skip
        
        self._processed_files[file_path] = now
        
        # Clean up old entries (older than 60 seconds)
        old_paths = [p for p, t in self._processed_files.items() if now - t > 60]
        for p in old_paths:
            del self._processed_files[p]
        
        return True
    
    def _handle_file_event(self, event):
        """Common handler for file events."""
        if event.is_directory:
            return
        
        file_path = event.src_path
        ext = Path(file_path).suffix.lower()
        
        if ext in SUPPORTED_EXTENSIONS:
            # Check if file exists and is accessible
            if not Path(file_path).exists():
                return
            
            if not self._should_process(file_path):
                return  # Debounced
            
            # Wait for file to be fully written
            time.sleep(0.5)
            
            # Double-check file still exists after waiting
            if Path(file_path).exists():
                self.on_new_file(file_path)
    
    def on_created(self, event):
        """Handle file creation event."""
        self._handle_file_event(event)
    
    def on_modified(self, event):
        """Handle file modification event - important for paste on Windows."""
        self._handle_file_event(event)
    
    def on_moved(self, event):
        """Handle file moved/renamed event."""
        if event.is_directory:
            return
        
        # For moved events, check the destination path
        dest_path = event.dest_path
        ext = Path(dest_path).suffix.lower()
        
        if ext in SUPPORTED_EXTENSIONS:
            if not self._should_process(dest_path):
                return
            
            time.sleep(0.5)
            if Path(dest_path).exists():
                self.on_new_file(dest_path)


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
