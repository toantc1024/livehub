"""
Background Task Model - Queue for background processing.
"""

from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import Column, String, DateTime, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import JSONB

from app.database import Base


class TaskType(str, Enum):
    """Types of background tasks."""
    IMAGE_PROCESSING = "image_processing"
    FACE_REGISTRATION = "face_registration"
    USER_BACKFILL = "user_backfill"


class TaskStatus(str, Enum):
    """Task status."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class BackgroundTask(Base):
    """Background task queue entry."""
    
    __tablename__ = "background_tasks"
    
    id = Column(String(36), primary_key=True)
    taskType = Column(SQLEnum(TaskType), nullable=False, index=True)
    status = Column(SQLEnum(TaskStatus), default=TaskStatus.PENDING, nullable=False, index=True)
    
    # Task payload (JSON)
    payload = Column(JSONB, nullable=False, default={})
    
    # Error message if failed
    error = Column(Text, nullable=True)
    
    # Timestamps
    createdAt = Column(DateTime, default=datetime.utcnow, nullable=False)
    startedAt = Column(DateTime, nullable=True)
    completedAt = Column(DateTime, nullable=True)
    
    # For ordering
    priority = Column(String(10), default="normal", nullable=False)
