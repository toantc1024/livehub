"""
Pydantic Schemas - Mirroring Prisma Models
"""

from app.schemas.enums import Role, ImageStatus
from app.schemas.user import UserFromJWT, JWTPayload
from app.schemas.image import (
    ImageBase,
    ImageCreate,
    ImageUpdate,
    ImageResponse,
    ImageWithFaces,
    ImageUploadResponse,
    ImageListResponse,
)
from app.schemas.face import (
    BoundingBox,
    FaceBase,
    FaceCreate,
    FaceUpdate,
    FaceResponse,
    FaceWithEmbedding,
    FaceDetectionResult,
    FaceSearchRequest,
    FaceSearchResult,
    FaceAssignRequest,
    UserFaceRegisterResponse,
)

__all__ = [
    "Role",
    "ImageStatus",
    "UserFromJWT",
    "JWTPayload",
    "ImageBase",
    "ImageCreate",
    "ImageUpdate",
    "ImageResponse",
    "ImageWithFaces",
    "ImageUploadResponse",
    "ImageListResponse",
    "BoundingBox",
    "FaceBase",
    "FaceCreate",
    "FaceUpdate",
    "FaceResponse",
    "FaceWithEmbedding",
    "FaceDetectionResult",
    "FaceSearchRequest",
    "FaceSearchResult",
    "FaceAssignRequest",
    "UserFaceRegisterResponse",
]
