"""
Database connection module using SQLAlchemy async.
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from app.config import settings

# Async database URL
async_database_url = settings.DATABASE_URL
if async_database_url.startswith("postgresql://"):
    async_database_url = async_database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

# Sync database URL for migrations
sync_database_url = settings.DATABASE_URL
if "+asyncpg" in sync_database_url:
    sync_database_url = sync_database_url.replace("+asyncpg", "")

# Create async engine
engine = create_async_engine(
    async_database_url,
    echo=settings.DEBUG,
    pool_pre_ping=True,
    pool_size=10,
    max_overflow=20,
)

# Sync engine for migrations/create_all
sync_engine = create_engine(
    sync_database_url,
    echo=settings.DEBUG,
    pool_pre_ping=True,
)

# Session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Base class for models
Base = declarative_base()


async def get_db() -> AsyncSession:
    """
    Dependency to get database session.
    
    Usage:
        @app.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with async_session_maker() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Initialize database tables."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


def create_tables_sync():
    """Create tables synchronously (for startup)."""
    # Import models to ensure they're registered with Base
    from app.models import User, Image, Face, UserFaceReference
    Base.metadata.create_all(bind=sync_engine)

