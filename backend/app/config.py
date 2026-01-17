"""
LiveHub Backend - Configuration Settings

All environment variables are loaded here.
"""

from typing import List
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # ===================
    # Database
    # ===================
    DATABASE_URL: str
    
    # ===================
    # Google OAuth
    # ===================
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    
    # ===================
    # JWT
    # ===================
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_DAYS: int = 7
    
    # ===================
    # URLs
    # ===================
    BACKEND_URL: str = "http://localhost:8080"
    FRONTEND_URL: str = "http://localhost:3000"
    
    # ===================
    # Admin
    # ===================
    ADMIN_EMAILS: List[str] = []
    
    # ===================
    # Qdrant Vector DB
    # ===================
    QDRANT_URL: str = "http://qdrant:6333"
    QDRANT_COLLECTION: str = "faces"
    QDRANT_USER_COLLECTION: str = "user_references"
    
    # ===================
    # MinIO / S3 Storage
    # ===================
    MINIO_ENDPOINT: str = "minio:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    MINIO_BUCKET: str = "livehub"
    MINIO_SECURE: bool = False
    
    # ===================
    # Celery
    # ===================
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/0"
    
    # ===================
    # Face Recognition
    # ===================
    USE_CUDA: bool = False  # Set True on GPU server, False for CPU
    SIMILARITY_THRESHOLD: float = 0.6
    FACE_MODEL_NAME: str = "antelopev2"  # ArcFace R100 (512-d embeddings)
    
    # ===================
    # CORS
    # ===================
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    
    # ===================
    # API Settings
    # ===================
    API_PREFIX: str = "/api/v1"
    DEBUG: bool = False
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
