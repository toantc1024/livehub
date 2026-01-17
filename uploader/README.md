# LiveHub Uploader

Desktop application for uploading event photos to LiveHub with:
- Folder monitoring
- Auto-upload (optional)
- Image enhancement
- SQLite tracking
- Google OAuth (admin only)

## Requirements

```
pip install -r requirements.txt
```

## Usage

```bash
python uploader.py
```

## Features

1. **Folder Monitoring**: Select a folder to watch for new images
2. **Auto Upload Mode**: Automatically upload new images when detected
3. **Image Enhancement**: Apply beautify filter before upload (placeholder)
4. **Status Tracking**: SQLite database to track upload status
5. **Admin Only**: Google OAuth login with admin role verification
