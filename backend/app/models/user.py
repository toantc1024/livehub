"""
SQLAlchemy User model.

User owns: role, email, name, avatarUrl, googleId, metadata (school, phone_number)
"""

from datetime import datetime
from typing import Optional, List, TYPE_CHECKING
from sqlalchemy import String, DateTime, Enum, JSON, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base
from app.schemas.enums import Role

if TYPE_CHECKING:
    from app.models.image import Image


class User(Base):
    """User model - synced with Prisma User."""
    
    __tablename__ = "User"
    
    id: Mapped[str] = mapped_column(String, primary_key=True)
    
    # Google OAuth
    googleId: Mapped[str] = mapped_column(String, unique=True)
    
    # Profile
    email: Mapped[str] = mapped_column(String, unique=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    avatarUrl: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    # Role
    role: Mapped[Role] = mapped_column(
        Enum(Role, name="Role"),
        default=Role.USER
    )
    
    # Profile data (school, phone_number, etc.) - renamed from 'metadata' which is reserved
    profileData: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
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
    images: Mapped[List["Image"]] = relationship(
        "Image",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        Index("User_email_idx", "email"),
        Index("User_googleId_idx", "googleId"),
    )
