# LiveHub Deployment Guide

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx                                 │
│  livehub.yhcmute.com                                        │
├─────────────────────────────────────────────────────────────┤
│  /api/*  → Backend (FastAPI :8080)                          │
│  /*      → Frontend (Next.js :3000)                         │
└─────────────────────────────────────────────────────────────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐       ┌─────────┐       ┌─────────┐
   │ Backend │       │Frontend │       │ MinIO   │
   │ :8080   │       │ :3000   │       │ :9000   │
   └─────────┘       └─────────┘       └─────────┘
        │
        ├── PostgreSQL (:5432)
        ├── Redis (:6379)
        ├── Qdrant (:6333)
        └── Celery Worker
```

## Image Serving

Images are served through the backend API proxy, NOT directly from MinIO.

**URL format:** `https://livehub.yhcmute.com/api/v1/images/proxy/{storage_path}`

This ensures:
- No hostname issues (minio vs public domain)
- No expired presigned URLs
- Works in both development and production

---

## Local Development

### 1. Environment Setup

Copy `.env.example` or use:

```env
# .env (root)
BACKEND_URL=http://localhost:8080
FRONTEND_URL=http://localhost:3000
```

### 2. Start Services

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 3. Frontend

```bash
cd frontend
pnpm install
pnpm run dev
```

---

## Production Deployment

### 1. Server Setup

```bash
# Install dependencies
sudo apt update
sudo apt install -y docker.io docker-compose nginx certbot python3-certbot-nginx

# Clone repository
git clone https://github.com/your-repo/livehub.git
cd livehub
```

### 2. Environment Configuration

```bash
# Copy production env
cp .env.production .env

# Edit with your secrets
nano .env
```

**Critical settings:**
- `BACKEND_URL=https://livehub.yhcmute.com`
- `FRONTEND_URL=https://livehub.yhcmute.com`
- `CORS_ORIGINS=["https://livehub.yhcmute.com"]`
- Strong passwords for DB, MinIO, JWT

### 3. SSL Certificate

```bash
sudo certbot --nginx -d livehub.yhcmute.com
```

### 4. Nginx Configuration

```bash
sudo cp nginx.conf /etc/nginx/sites-available/livehub
sudo ln -s /etc/nginx/sites-available/livehub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. Start Containers

```bash
docker compose -f docker-compose.prod.yml up -d
```

### 6. Build Frontend

```bash
cd frontend
pnpm install
pnpm run build
pnpm run start  # or use PM2
```

---

## Google OAuth Setup

Add these Redirect URIs in Google Cloud Console:

**Development:**
```
http://localhost:8080/api/v1/auth/google/callback
http://localhost:8080/api/v1/auth/google/callback/desktop
```

**Production:**
```
https://livehub.yhcmute.com/api/v1/auth/google/callback
https://livehub.yhcmute.com/api/v1/auth/google/callback/desktop
```

---

## Desktop Uploader

For production usage:

```powershell
$env:LIVEHUB_API_URL = "https://livehub.yhcmute.com/api/v1"
python uploader/uploader.py
```

---

## Troubleshooting

### Image not loading
- Ensure `BACKEND_URL` is correctly set
- Check that `/api/v1/images/proxy/` endpoint is accessible
- Verify `storagePath` is saved in database

### OAuth redirect_uri_mismatch
- Add the exact callback URL to Google Console
- Include both `/callback` and `/callback/desktop` URIs

### CORS errors
- Update `CORS_ORIGINS` in `.env` to include frontend domain
- Rebuild backend: `docker compose ... up -d --build livehub-api`
