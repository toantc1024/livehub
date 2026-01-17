"""
Image schemas - matches Prisma Image model.
"""

from datetime import datetime
from typing import Optional, List, Any

from pydantic import BaseModel, Field, model_validator

from app.schemas.enums import ImageStatus


class ImageBase(BaseModel):
    """Base image fields."""
    filename: str
    originalUrl: str


class ImageCreate(ImageBase):
    """Schema for creating an image record."""
    userId: str
    storagePath: Optional[str] = None
    imageData: Optional[dict] = None


class ImageUpdate(BaseModel):
    """Schema for updating image."""
    storagePath: Optional[str] = None
    status: Optional[ImageStatus] = None
    imageData: Optional[dict] = None


class ImageResponse(ImageBase):
    """Full image response."""
    id: str
    userId: str
    storagePath: Optional[str] = None
    status: ImageStatus
    imageData: Optional[dict] = None
    createdAt: datetime
    updatedAt: datetime
    
    class Config:
        from_attributes = True

    @model_validator(mode='after')
    def rewrite_urls(self):
        from app.config import settings
        import re
        
        # If we have storagePath, use proxy URL for stability
        if self.storagePath:
            self.originalUrl = f"{settings.BACKEND_URL}{settings.API_PREFIX}/images/proxy/{self.storagePath}"
        elif self.originalUrl and 'minio' in self.originalUrl:
            # Extract path from old minio URL: http://minio:9000/bucket/path/to/file.jpg?...
            # We need to extract "path/to/file.jpg" and proxy it
            match = re.search(r'/livehub/(.+?)(?:\?|$)', self.originalUrl)
            if match:
                storage_path = match.group(1)
                self.originalUrl = f"{settings.BACKEND_URL}{settings.API_PREFIX}/images/proxy/{storage_path}"
            
        return self


class ImageWithFaces(ImageResponse):
    """Image with faces."""
    faces: List["FaceResponse"] = []
    
    class Config:
        from_attributes = True


class ImageUploadResponse(BaseModel):
    """Response after image upload."""
    id: str
    status: ImageStatus
    message: str


class ImageListResponse(BaseModel):
    """Paginated image list."""
    items: List[ImageResponse]
    total: int
    page: int
    page_size: int
    pages: int


# Forward reference
from app.schemas.face import FaceResponse
ImageWithFaces.model_rebuild()
