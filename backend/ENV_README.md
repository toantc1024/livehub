# Backend Environment Setup

## 📁 Environment Files

- `.env.development` - Development (localhost URLs)
- `.env.production` - Production (Docker service names)
- `.env` - Current active environment (gitignored)

## 🔄 Switching Environments

### Local Development
```bash
# Windows PowerShell
Copy-Item .env.development .env -Force

# Linux/Mac
cp .env.development .env
```

### Production/Docker
```bash
# Windows PowerShell  
Copy-Item .env.production .env -Force

# Linux/Mac
cp .env.production .env
```

## 🗄️ Running Migrations

### Local Development
```bash
# Copy dev env first
cp .env.development .env

# Run migrations
alembic revision --autogenerate -m "Description"
alembic upgrade head
```

### Production (Docker)
Migrations run automatically when container starts via Dockerfile CMD:
```dockerfile
CMD sh -c "alembic upgrade head && uvicorn app.main:app ..."
```

## 🐳 Docker Notes

Docker containers automatically use `.env.production`:
- Dockerfile copies `.env.production` to `.env` during build
- All service names (livehub-db, redis, qdrant, minio) resolve inside Docker network

## 🔑 Key Differences

| Setting | Development (.env.development) | Production (.env.production) |
|---------|----------------------|----------------------|
| Database | localhost:5433 | livehub-db:5432 |
| Redis | localhost:6379 | redis:6379 |
| Qdrant | localhost:6333 | qdrant:6333 |
| MinIO | localhost:9000 | minio:9000 |
| DEBUG | true | false |
