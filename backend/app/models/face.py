"""
SQLAlchemy Face model.
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Float, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base

if TYPE_CHECKING:
    from app.models.image import Image
    from app.models.user import User


class Face(Base):
    """Face model - matches Prisma Face."""
    
    __tablename__ = "Face"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    imageId: Mapped[str] = mapped_column(String, ForeignKey("Image.id", ondelete="CASCADE"))
    
    # Bounding box
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    width: Mapped[float] = mapped_column(Float)
    height: Mapped[float] = mapped_column(Float)
    confidence: Mapped[float] = mapped_column(Float)  # Face detection confidence
    
    # Similarity score when matched to user (0.0-1.0)
    similarity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Qdrant reference
    qdrantId: Mapped[Optional[str]] = mapped_column(String, unique=True, nullable=True)
    
    # Assigned user (nullable) - no FK constraint, just a reference
    userId: Mapped[Optional[str]] = mapped_column(String, ForeignKey("User.id", ondelete="SET NULL"), nullable=True)
    assignedBy: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # "auto" or admin user id
    
    createdAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    
    # Relationships
    image: Mapped["Image"] = relationship("Image", back_populates="faces")
    user: Mapped[Optional["User"]] = relationship("User", foreign_keys=[userId])
    
    __table_args__ = (
        Index("Face_imageId_idx", "imageId"),
        Index("Face_userId_idx", "userId"),
    )


class UserFaceReference(Base):
    """User's reference face for matching."""
    
    __tablename__ = "UserFaceReference"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, unique=True)
    qdrantId: Mapped[str] = mapped_column(String, unique=True)
    
    createdAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
