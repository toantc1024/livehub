"""
Face schemas - matches Prisma Face model.

FastAPI OWNS face detection and embedding management.
"""

from datetime import datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class BoundingBox(BaseModel):
    """Face bounding box coordinates."""
    x: float = Field(..., ge=0)
    y: float = Field(..., ge=0)
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)


class FaceBase(BaseModel):
    """Base face fields."""
    x: float = Field(..., ge=0)
    y: float = Field(..., ge=0)
    width: float = Field(..., gt=0)
    height: float = Field(..., gt=0)
    confidence: float = Field(..., ge=0, le=1)


class FaceCreate(FaceBase):
    """Schema for creating a face record."""
    imageId: str
    qdrantId: Optional[str] = None
    userId: Optional[str] = None


class FaceUpdate(BaseModel):
    """Schema for updating face."""
    qdrantId: Optional[str] = None
    userId: Optional[str] = None
    assignedBy: Optional[str] = None


class UserBasicInfo(BaseModel):
    """Basic user info for face response."""
    id: str
    name: Optional[str] = None
    email: str
    
    class Config:
        from_attributes = True


class FaceResponse(FaceBase):
    """Full face response."""
    id: str
    imageId: str
    qdrantId: Optional[str] = None
    userId: Optional[str] = None
    similarity: Optional[float] = Field(None, ge=0, le=1, description="Similarity score to matched user")
    assignedBy: Optional[str] = None
    createdAt: datetime
    user: Optional[UserBasicInfo] = None
    
    class Config:
        from_attributes = True


class FaceWithEmbedding(FaceResponse):
    """Face with embedding for search operations."""
    embedding: Optional[List[float]] = Field(None, description="512-d embedding")
    similarity: Optional[float] = Field(None, ge=0, le=1)


class FaceDetectionResult(BaseModel):
    """Result from face detection."""
    bbox: BoundingBox
    confidence: float
    embedding: List[float] = Field(..., description="512-dimensional embedding")


class FaceSearchRequest(BaseModel):
    """Request for face search."""
    embedding: List[float] = Field(..., min_length=512, max_length=512)
    threshold: float = Field(0.6, ge=0, le=1)
    limit: int = Field(10, ge=1, le=100)


class FaceSearchResult(BaseModel):
    """Result from face search."""
    face_id: str
    image_id: str
    user_id: Optional[str]
    similarity: float
    bbox: BoundingBox


class FaceAssignRequest(BaseModel):
    """Request to manually assign face to user."""
    face_id: str
    user_id: str


class UserFaceRegisterRequest(BaseModel):
    """Request to register user's reference face."""
    # Image will be uploaded as multipart form
    pass


class UserFaceRegisterResponse(BaseModel):
    """Response after registering user face."""
    qdrant_id: str
    message: str
    backfill_triggered: bool
