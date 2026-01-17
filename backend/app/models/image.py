"""
SQLAlchemy Image model.
"""

from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, DateTime, Enum, Text, JSON, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base
from app.schemas.enums import ImageStatus

if TYPE_CHECKING:
    from app.models.face import Face
    from app.models.user import User


class Image(Base):
    """Image model - matches Prisma Image."""
    
    __tablename__ = "Image"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"))
    
    filename: Mapped[str] = mapped_column(String)
    originalUrl: Mapped[str] = mapped_column(String)
    storagePath: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    status: Mapped[ImageStatus] = mapped_column(
        Enum(ImageStatus, name="ImageStatus"),
        default=ImageStatus.PROCESSING
    )
    imageData: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    createdAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now()
    )
    
    # Relationships
    user: Mapped["User"] = relationship(
        "User",
        back_populates="images"
    )
    
    faces: Mapped[List["Face"]] = relationship(
        "Face",
        back_populates="image",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        Index("Image_userId_idx", "userId"),
        Index("Image_status_idx", "status"),
    )

