# LiveHub Production Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼
┌───────────────────┐                 ┌───────────────────┐
│     Vercel        │                 │   Your Server     │
│  (Frontend)       │                 │   (Backend)       │
│                   │                 │                   │
│ livehub.yhcmute   │ ──── API ────▶  │ api-livehub.yhcmute│
│     .com          │                 │     .com          │
└───────────────────┘                 └───────────────────┘
                                              │
                                      ┌───────┴───────┐
                                      │    Nginx      │
                                      │   (Reverse    │
                                      │    Proxy)     │
                                      └───────┬───────┘
                                              │
                              ┌───────────────┼───────────────┐
                              ▼               ▼               ▼
                        ┌──────────┐   ┌──────────┐   ┌──────────┐
                        │ FastAPI  │   │PostgreSQL│   │  MinIO   │
                        │  :8080   │   │  :5432   │   │  :9000   │
                        └──────────┘   └──────────┘   └──────────┘
                              │               │               │
                              └───────────────┼───────────────┘
                                              ▼
                                    ┌──────────────────┐
                                    │ Qdrant │ Redis   │
                                    │ :6333  │ :6379   │
                                    └──────────────────┘
```

## Prerequisites

- Ubuntu 22.04 LTS server
- Docker & Docker Compose installed
- Domain with A record pointing to server IP
- Git installed

## Step 1: DNS Setup

Add an **A Record** in your DNS provider:

| Type | Name         | Value          | TTL  |
|------|--------------|----------------|------|
| A    | api-livehub  | YOUR_SERVER_IP | 3600 |

This will make `api-livehub.yhcmute.com` point to your server.

## Step 2: Server Setup

### Install Docker & Docker Compose

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y

# Verify installation
docker --version
docker compose version
```

### Install Nginx & Certbot

```bash
# Install Nginx
sudo apt install nginx -y

# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Start and enable Nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

## Step 3: Clone & Configure Project

```bash
# Create project directory
sudo mkdir -p /opt/livehub
sudo chown $USER:$USER /opt/livehub
cd /opt/livehub

# Clone repository
git clone https://github.com/YOUR_USERNAME/LiveHub.git .

# Or if already have the files, copy them
# scp -r ./LiveHub/* user@server:/opt/livehub/
```

### Configure Environment

```bash
# Copy production environment
cp .env.production .env

# Edit environment variables
nano .env
```

**Important: Update these values in `.env`:**

```env
# Change these to secure random values!
MINIO_ROOT_PASSWORD=your-secure-minio-password-here
LIVEHUB_DB_PASSWORD=your-secure-db-password-here
JWT_SECRET=your-very-long-jwt-secret-at-least-32-chars

# Google OAuth (get from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Admin emails
ADMIN_EMAILS=["your-admin-email@hcmute.edu.vn"]
```

## Step 4: Setup Nginx

```bash
# Copy nginx config
sudo cp nginx-api.conf /etc/nginx/sites-available/api-livehub

# Create symlink to enable
sudo ln -s /etc/nginx/sites-available/api-livehub /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

## Step 5: Get SSL Certificate

```bash
# Create webroot directory for certbot
sudo mkdir -p /var/www/certbot

# Get SSL certificate
sudo certbot --nginx -d api-livehub.yhcmute.com

# Follow the prompts:
# - Enter email address
# - Agree to terms
# - Choose whether to redirect HTTP to HTTPS (recommended: yes)

# Verify auto-renewal
sudo certbot renew --dry-run
```

## Step 6: Deploy with Docker

```bash
cd /opt/livehub

# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Check health
curl https://api-livehub.yhcmute.com/health
```

### Useful Docker Commands

```bash
# Stop all services
docker compose -f docker-compose.prod.yml down

# Restart a specific service
docker compose -f docker-compose.prod.yml restart livehub-api

# View logs for a specific service
docker compose -f docker-compose.prod.yml logs -f livehub-api

# Check running containers
docker compose -f docker-compose.prod.yml ps

# Execute command in container
docker compose -f docker-compose.prod.yml exec livehub-api bash

# Rebuild and restart (after code changes)
docker compose -f docker-compose.prod.yml up -d --build livehub-api
```

## Step 7: Initialize MinIO Bucket

Access MinIO console to create the bucket:

```bash
# Get MinIO console URL (port 9001)
# You may need to temporarily allow this port or use SSH tunnel
ssh -L 9001:localhost:9001 user@your-server

# Then access: http://localhost:9001
# Login with MINIO_ROOT_USER and MINIO_ROOT_PASSWORD
# Create bucket named: livehub
```

Or via CLI:

```bash
# Install MinIO client
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# Configure alias
mc alias set livehub http://localhost:9000 admin your-minio-password

# Create bucket
mc mb livehub/livehub

# Set bucket policy to public (for image access)
mc anonymous set download livehub/livehub
```

## Step 8: Update Frontend Environment

On Vercel dashboard, update environment variables:

```env
NEXT_PUBLIC_API_URL=https://api-livehub.yhcmute.com
```

Then redeploy the frontend.

## Firewall Configuration

```bash
# Allow required ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status
```

**Note:** Keep ports 5432, 6333, 6379, 9000, 9001, 8080 internal only (not exposed to internet).

## Monitoring & Maintenance

### Check Service Health

```bash
# All containers
docker compose -f docker-compose.prod.yml ps

# API health
curl -s https://api-livehub.yhcmute.com/health | jq

# Database
docker compose -f docker-compose.prod.yml exec livehub-db pg_isready
```

### View Logs

```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f livehub-api --tail=100
```

### Backup Database

```bash
# Create backup
docker compose -f docker-compose.prod.yml exec livehub-db \
  pg_dump -U livehub livehub > backup_$(date +%Y%m%d).sql

# Restore backup
docker compose -f docker-compose.prod.yml exec -T livehub-db \
  psql -U livehub livehub < backup_20260117.sql
```

### Update Application

```bash
cd /opt/livehub

# Pull latest changes
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker compose -f docker-compose.prod.yml logs livehub-api

# Check container status
docker inspect livehub-api
```

### Database connection issues

```bash
# Test connection from API container
docker compose -f docker-compose.prod.yml exec livehub-api \
  python -c "from app.database import engine; print(engine.url)"
```

### SSL Certificate issues

```bash
# Renew certificate
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

### CORS issues

If you see CORS errors in browser:
1. Check `CORS_ORIGINS` in `.env` includes `https://livehub.yhcmute.com`
2. Restart the API container after changes

---

## Quick Reference

| Service        | URL/Port                              | Purpose        |
|----------------|---------------------------------------|----------------|
| Frontend       | https://livehub.yhcmute.com           | User interface |
| API            | https://api-livehub.yhcmute.com       | Backend API    |
| MinIO Console  | localhost:9001 (internal)             | Object storage |
| PostgreSQL     | localhost:5432 (internal)             | Database       |
| Qdrant         | localhost:6333 (internal)             | Vector DB      |
| Redis          | localhost:6379 (internal)             | Cache/Queue    |
