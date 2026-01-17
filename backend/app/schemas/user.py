"""
User schemas - includes full user profile from database.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.enums import Role


class UserProfileData(BaseModel):
    """User profile data - school, phone_number, etc."""
    school: Optional[str] = None
    phone_number: Optional[str] = None
    student_id: Optional[str] = None
    class_name: Optional[str] = None
    description: Optional[str] = None
    
    class Config:
        extra = "allow"  # Allow additional fields


class JWTPayload(BaseModel):
    """JWT payload from Google OAuth."""
    sub: str = Field(..., description="User ID")
    email: str = Field(..., description="User email")
    role: str = Field(..., description="User role")
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    iat: int = Field(..., description="Issued at")
    exp: int = Field(..., description="Expiration")


class UserFromJWT(BaseModel):
    """User extracted from JWT."""
    id: str
    email: str
    role: Role
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    
    class Config:
        from_attributes = True


class UserCreate(BaseModel):
    """Schema for creating a user from Google OAuth."""
    googleId: str
    email: str
    name: Optional[str] = None
    avatarUrl: Optional[str] = None
    role: Role = Role.USER
    profileData: Optional[UserProfileData] = None


class UserUpdate(BaseModel):
    """Schema for updating user profile."""
    name: Optional[str] = None
    avatarUrl: Optional[str] = None
    profileData: Optional[UserProfileData] = None


class UserResponse(BaseModel):
    """Full user response."""
    id: str
    googleId: str
    email: str
    name: Optional[str] = None
    avatarUrl: Optional[str] = None
    role: Role
    profileData: Optional[UserProfileData] = None
    createdAt: datetime
    updatedAt: datetime
    
    class Config:
        from_attributes = True


class UserPublic(BaseModel):
    """Public user info (for other users to see)."""
    id: str
    name: Optional[str] = None
    avatarUrl: Optional[str] = None
    
    class Config:
        from_attributes = True
