"""
Admin router - Statistics and management endpoints.
"""

from typing import Optional, List
from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, UploadFile, File, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
from pydantic import BaseModel

from app.core.dependencies import AdminUser
from app.database import get_db
from app.models.image import Image
from app.models.face import Face
from app.models.user import User
from app.schemas import ImageResponse, ImageListResponse, ImageWithFaces, ImageStatus
from app.schemas.face import FaceResponse
from app.services.storage import storage_service


router = APIRouter(prefix="/admin", tags=["Admin"])


# ==================
# Schemas
# ==================

class StatsResponse(BaseModel):
    images: dict
    faces: dict
    users: dict


class FaceUpdateRequest(BaseModel):
    userId: Optional[str] = None


class FaceUpdateResponse(BaseModel):
    message: str
    face: FaceResponse


class UserListItem(BaseModel):
    id: str
    name: Optional[str] = None
    email: str
    avatarUrl: Optional[str] = None
    profileData: Optional[dict] = None
    createdAt: datetime

    class Config:
        from_attributes = True


# ==================
# Stats Endpoints
# ==================

@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Get aggregated statistics.
    """
    # Count images by status
    img_total = await db.scalar(select(func.count()).select_from(Image))
    img_processing = await db.scalar(
        select(func.count()).select_from(Image).where(Image.status == ImageStatus.PROCESSING)
    )
    img_ready = await db.scalar(
        select(func.count()).select_from(Image).where(Image.status == ImageStatus.READY)
    )
    img_error = await db.scalar(
        select(func.count()).select_from(Image).where(Image.status == ImageStatus.ERROR)
    )
    
    # Sum view and download counts
    total_views = await db.scalar(select(func.sum(Image.viewCount))) or 0
    total_downloads = await db.scalar(select(func.sum(Image.downloadCount))) or 0
    
    # Count faces
    face_total = await db.scalar(select(func.count()).select_from(Face))
    face_assigned = await db.scalar(
        select(func.count()).select_from(Face).where(Face.userId.isnot(None))
    )
    
    # Count users
    user_total = await db.scalar(select(func.count()).select_from(User))
    
    return StatsResponse(
        images={
            "total": img_total or 0,
            "processing": img_processing or 0,
            "ready": img_ready or 0,
            "error": img_error or 0,
            "totalViews": total_views,
            "totalDownloads": total_downloads,
        },
        faces={
            "total": face_total or 0,
            "assigned": face_assigned or 0,
            "unassigned": (face_total or 0) - (face_assigned or 0),
        },
        users={
            "total": user_total or 0,
        },
    )


# ==================
# Image Endpoints
# ==================

@router.get("/images", response_model=ImageListResponse)
async def admin_list_images(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    image_status: Optional[ImageStatus] = Query(None, alias="status"),
):
    """
    List all images with pagination (admin only).
    """
    query = select(Image)
    
    if image_status:
        query = query.where(Image.status == image_status)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0
    
    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(Image.createdAt.desc())
    
    result = await db.execute(query)
    images = result.scalars().all()
    
    return ImageListResponse(
        items=[ImageResponse.model_validate(img) for img in images],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total > 0 else 0,
    )




@router.get("/images/{image_id}", response_model=ImageWithFaces)
async def admin_get_image(
    image_id: str,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Get image details with faces (admin only).
    """
    query = (
        select(Image)
        .options(
            selectinload(Image.faces).selectinload(Face.user)
        )
        .where(Image.id == image_id)
    )
    
    result = await db.execute(query)
    image = result.scalar_one_or_none()
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image not found: {image_id}",
        )
    
    return ImageWithFaces.model_validate(image)


@router.delete("/images/{image_id}")
async def admin_delete_image(
    image_id: str,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete image and its faces (admin only).
    Also removes face embeddings from Qdrant.
    """
    from app.services.vector_store import vector_store_service
    
    result = await db.execute(select(Image).where(Image.id == image_id))
    image = result.scalar_one_or_none()
    
    if not image:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image not found: {image_id}",
        )
    
    # Delete from Qdrant first
    try:
        await vector_store_service.init()
        await vector_store_service.delete_faces_by_image(image_id)
        await vector_store_service.close()
    except Exception as e:
        import logging
        logging.warning(f"Failed to delete faces from Qdrant for image {image_id}: {e}")
    
    # Delete from storage (async to avoid blocking)
    if image.storagePath:
        try:
            import asyncio
            storage_service.init()
            await asyncio.to_thread(storage_service.delete_file, image.storagePath)
        except Exception as e:
            pass  # Log but don't fail
    
    # Delete from database (cascades to faces)
    await db.delete(image)
    await db.commit()
    
    return {"message": f"Image {image_id} deleted"}


# ==================
# Face Endpoints
# ==================

@router.patch("/faces/{face_id}", response_model=FaceUpdateResponse)
async def admin_update_face(
    face_id: str,
    request: FaceUpdateRequest,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Update face assignment (admin only).
    
    Updates both PostgreSQL Face record and Qdrant vector store.
    """
    from app.services.vector_store import vector_store_service
    
    result = await db.execute(
        select(Face)
        .options(selectinload(Face.user))
        .where(Face.id == face_id)
    )
    face = result.scalar_one_or_none()
    
    if not face:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Face not found: {face_id}",
        )
    
    # Update user assignment in PostgreSQL
    face.userId = request.userId
    face.assignedBy = admin.id if request.userId else None
    
    await db.commit()
    
    # Also update in Qdrant if face has qdrantId
    if face.qdrantId:
        try:
            await vector_store_service.init()
            await vector_store_service.update_face_user(face.qdrantId, request.userId)
            await vector_store_service.close()
        except Exception as e:
            # Log but don't fail the request - PostgreSQL is the source of truth
            import logging
            logging.warning(f"Failed to update Qdrant for face {face_id}: {e}")
    
    # Reload with user relationship
    result = await db.execute(
        select(Face)
        .options(selectinload(Face.user))
        .where(Face.id == face_id)
    )
    face = result.scalar_one_or_none()
    
    return FaceUpdateResponse(
        message="Face updated successfully",
        face=FaceResponse.model_validate(face),
    )


@router.delete("/faces/{face_id}")
async def admin_delete_face(
    face_id: str,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a face record (admin only).
    Also removes embedding from Qdrant.
    """
    from app.services.vector_store import vector_store_service
    
    result = await db.execute(select(Face).where(Face.id == face_id))
    face = result.scalar_one_or_none()
    
    if not face:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Face not found: {face_id}",
        )
    
    # Delete from Qdrant if has qdrantId
    if face.qdrantId:
        try:
            await vector_store_service.init()
            await vector_store_service.delete_face(face.qdrantId)
            await vector_store_service.close()
        except Exception as e:
            import logging
            logging.warning(f"Failed to delete face from Qdrant: {e}")
    
    # Delete from database
    await db.delete(face)
    await db.commit()
    
    return {"message": f"Face {face_id} deleted"}


# ==================
# User Management Endpoints
# ==================

class UserListResponse(BaseModel):
    items: List[UserListItem]
    total: int
    page: int
    page_size: int
    pages: int


class UserRoleUpdate(BaseModel):
    role: str


class UserDetailResponse(BaseModel):
    id: str
    name: Optional[str] = None
    email: str
    role: str
    avatarUrl: Optional[str] = None
    profileData: Optional[dict] = None
    createdAt: str
    updatedAt: str
    
    class Config:
        from_attributes = True


@router.get("/users", response_model=UserListResponse)
async def admin_list_users(
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    List users with pagination.
    """
    query = select(User)
    
    if search:
        query = query.where(
            (User.name.ilike(f"%{search}%")) | (User.email.ilike(f"%{search}%"))
        )
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0
    
    # Paginate
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(User.createdAt.desc())
    
    result = await db.execute(query)
    users = result.scalars().all()
    
    return UserListResponse(
        items=[UserListItem.model_validate(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total > 0 else 0,
    )


@router.get("/users/{user_id}", response_model=UserDetailResponse)
async def admin_get_user(
    user_id: str,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Get user details.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return UserDetailResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role.value,
        avatarUrl=user.avatarUrl,
        profileData=user.profileData,
        createdAt=user.createdAt.isoformat(),
        updatedAt=user.updatedAt.isoformat(),
    )


@router.patch("/users/{user_id}/role")
async def admin_update_user_role(
    user_id: str,
    data: UserRoleUpdate,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Update user role.
    """
    from app.models.user import UserRole
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Validate role
    try:
        new_role = UserRole(data.role)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid role: {data.role}")
    
    user.role = new_role
    await db.commit()
    
    return {"message": "Role updated", "role": new_role.value}


@router.delete("/users/{user_id}")
async def admin_delete_user(
    user_id: str,
    admin: AdminUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Delete a user.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Prevent deleting self
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    await db.delete(user)
    await db.commit()
    
    return {"message": "User deleted"}


# ==================
# Health Endpoints
# ==================

@router.get("/health")
async def admin_health(admin: AdminUser):
    """
    Detailed health check for admin.
    """
    from app.services.vector_store import vector_store_service
    
    checks = {}
    
    # Check Qdrant
    try:
        await vector_store_service.init()
        collections = await vector_store_service.client.get_collections()
        checks["qdrant"] = {
            "status": "healthy",
            "collections": len(collections.collections),
        }
        await vector_store_service.close()
    except Exception as e:
        checks["qdrant"] = {"status": "unhealthy", "error": str(e)}
    
    # Check MinIO
    try:
        storage_service.init()
        exists = storage_service.client.bucket_exists(storage_service.bucket)
        checks["minio"] = {
            "status": "healthy",
            "bucket_exists": exists,
        }
    except Exception as e:
        checks["minio"] = {"status": "unhealthy", "error": str(e)}
    
    return {
        "status": "healthy" if all(c.get("status") == "healthy" for c in checks.values()) else "degraded",
        "checks": checks,
    }

