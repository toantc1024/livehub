"""
LiveHub FastAPI Backend

Main entry point for the API service.
"""

import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import (
    auth_router,
    images_router,
    users_router,
    faces_router,
    admin_router,
)
from app.services.vector_store import vector_store_service
from app.services.storage import storage_service


# Configure logging
logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan events."""
    # Startup
    logger.info("🚀 LiveHub API starting...")
    
    # Create database tables
    try:
        from app.database import create_tables_sync
        create_tables_sync()
        logger.info("✅ Database tables created/verified")
    except Exception as e:
        logger.error(f"❌ Database table creation failed: {e}")
    
    try:
        # Initialize storage
        storage_service.init()
        logger.info("✅ MinIO storage initialized")
    except Exception as e:
        logger.warning(f"⚠️ MinIO not available: {e}")
    
    try:
        # Initialize Qdrant
        await vector_store_service.init()
        logger.info("✅ Qdrant vector store initialized")
    except Exception as e:
        logger.warning(f"⚠️ Qdrant not available: {e}")
    
    logger.info("🟢 LiveHub API ready")
    
    yield
    
    # Shutdown
    logger.info("👋 LiveHub API shutting down...")
    await vector_store_service.close()



app = FastAPI(
    title="LiveHub API",
    description="Face detection and image processing API for LiveHub",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(images_router, prefix=settings.API_PREFIX)
app.include_router(users_router, prefix=settings.API_PREFIX)
app.include_router(faces_router, prefix=settings.API_PREFIX)
app.include_router(admin_router, prefix=settings.API_PREFIX)


@app.get("/", tags=["Health"])
async def root():
    """Root endpoint - API info."""
    return {
        "name": "LiveHub API",
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Health check for Docker/K8s."""
    return {"status": "healthy"}
