"""
LiveHub Uploader - Configuration
"""

import os
from pathlib import Path

# API
# Default to localhost for development
# For production usage: set LIVEHUB_API_URL=https://livehub.yhcmute.com/api/v1
API_URL = os.getenv("LIVEHUB_API_URL", "http://localhost:8080/api/v1")

# Local callback server
LOCAL_CALLBACK_PORT = 5556

# Supported image extensions
SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

# Local storage
DATA_DIR = Path.home() / ".livehub"
DATA_DIR.mkdir(parents=True, exist_ok=True)
