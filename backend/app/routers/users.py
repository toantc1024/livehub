"""
Users router - Face registration and profile endpoints.
"""

import asyncio
from datetime import datetime
from uuid import uuid4

import cv2
import numpy as np
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.dependencies import CurrentUser
from app.schemas import UserFaceRegisterResponse
from app.schemas.user import UserProfileData, UserResponse
from app.services.vector_store import vector_store_service
from app.database import get_db
from app.models.user import User


router = APIRouter(prefix="/users", tags=["Users"])


# ==================
# Schemas
# ==================

class ProfileUpdateRequest(BaseModel):
    """Request to update user profile."""
    name: Optional[str] = None
    profileData: Optional[UserProfileData] = None


class ProfileUpdateResponse(BaseModel):
    """Response after updating profile."""
    message: str
    user: UserResponse


# ==================
# Profile Endpoints
# ==================

@router.patch("/profile", response_model=ProfileUpdateResponse)
async def update_profile(
    request: ProfileUpdateRequest,
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Update current user's profile.
    
    Updates name and/or profileData (school, phone_number).
    """
    # Fetch user from database
    result = await db.execute(
        select(User).where(User.id == current_user.id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    # Update fields
    if request.name is not None:
        user.name = request.name
    
    if request.profileData is not None:
        # Merge with existing profileData
        existing_data = user.profileData or {}
        new_data = request.profileData.model_dump(exclude_none=True)
        user.profileData = {**existing_data, **new_data}
    
    user.updatedAt = datetime.utcnow()
    
    await db.commit()
    await db.refresh(user)
    
    return ProfileUpdateResponse(
        message="Profile updated successfully",
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_my_profile(
    current_user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Get current user's full profile from database.
    """
    result = await db.execute(
        select(User).where(User.id == current_user.id)
    )
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    
    return UserResponse.model_validate(user)


@router.post("/register-face", response_model=UserFaceRegisterResponse, status_code=status.HTTP_202_ACCEPTED)
async def register_user_face(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    """
    Register user's reference face for auto-matching.
    
    Fast path: compress image, store in MinIO, queue background task.
    The worker handles the slow DeepFace inference + Qdrant storage + backfill.
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image",
        )
    
    # Read file
    file_bytes = await file.read()
    
    # Compress for faster upload/storage
    def _compress(data: bytes) -> bytes:
        nparr = np.frombuffer(data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return data
        h, w = img.shape[:2]
        if max(h, w) > 1024:
            scale = 1024 / max(h, w)
            img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        _, buf = cv2.imencode('.jpg', img, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return buf.tobytes()
    file_bytes = await asyncio.to_thread(_compress, file_bytes)
    
    try:
        # Store compressed image in MinIO for worker to process
        from app.services.storage import storage_service
        image_path = await storage_service.async_upload_file(
            file_data=file_bytes,
            filename="selfie.jpg",
            content_type="image/jpeg",
            folder="temp-faces",
        )
        
        # Queue face registration task — worker does the heavy DeepFace work
        from app.services.background import queue_face_registration
        
        task_id = await queue_face_registration(
            db=db,
            user_id=user.id,
            image_path=image_path,
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue face registration: {str(e)}",
        )
    
    return UserFaceRegisterResponse(
        qdrant_id=task_id,
        message="Đang xử lý khuôn mặt. Hệ thống sẽ tự động nhận diện bạn trong các ảnh.",
        backfill_triggered=True,
    )


class FaceStatusResponse(BaseModel):
    """Response for face status check."""
    hasRegisteredFace: bool
    isPending: bool = False
    taskId: Optional[str] = None
    registeredAt: Optional[datetime] = None


class FaceTaskStatusResponse(BaseModel):
    """Response for face task status polling."""
    taskId: str
    status: str  # pending, processing, completed, failed
    error: Optional[str] = None
    createdAt: Optional[datetime] = None
    completedAt: Optional[datetime] = None


@router.get("/face-status", response_model=FaceStatusResponse)
async def get_face_status(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Check if user has registered their face.
    
    Returns whether user has a reference face stored in Qdrant,
    AND whether there is a pending/processing face registration task.
    This prevents redirect loops when face is being processed.
    """
    from app.models.task import BackgroundTask, TaskType, TaskStatus
    import logging
    logger = logging.getLogger(__name__)

    has_face = False
    is_pending = False
    task_id = None
    
    # Check Qdrant for completed reference
    try:
        await vector_store_service.init()
        has_face = await vector_store_service.check_user_has_reference(user.id)
        await vector_store_service.close()
    except Exception as e:
        logger.warning(f"Failed to check Qdrant for user {user.id}: {e}")
    
    # Check background_tasks for pending/processing face registration
    if not has_face:
        try:
            result = await db.execute(
                select(BackgroundTask)
                .where(
                    BackgroundTask.taskType == TaskType.FACE_REGISTRATION,
                    BackgroundTask.status.in_([TaskStatus.PENDING, TaskStatus.PROCESSING]),
                    BackgroundTask.payload["user_id"].astext == user.id,
                )
                .order_by(BackgroundTask.createdAt.desc())
                .limit(1)
            )
            pending_task = result.scalar_one_or_none()
            if pending_task:
                is_pending = True
                task_id = pending_task.id
        except Exception as e:
            logger.warning(f"Failed to check pending tasks for user {user.id}: {e}")
    
    return FaceStatusResponse(
        hasRegisteredFace=has_face,
        isPending=is_pending,
        taskId=task_id,
        registeredAt=datetime.utcnow() if has_face else None,
    )


@router.get("/face-task-status/{task_id}", response_model=FaceTaskStatusResponse)
async def get_face_task_status(
    task_id: str,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Poll for face registration task status.
    
    Used by frontend to show loading animation while face is being processed.
    """
    from app.models.task import BackgroundTask, TaskType
    
    result = await db.execute(
        select(BackgroundTask).where(
            BackgroundTask.id == task_id,
            BackgroundTask.taskType == TaskType.FACE_REGISTRATION,
            BackgroundTask.payload["user_id"].astext == user.id,
        )
    )
    task = result.scalar_one_or_none()
    
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )
    
    return FaceTaskStatusResponse(
        taskId=task.id,
        status=task.status.value,
        error=task.error,
        createdAt=task.createdAt,
        completedAt=task.completedAt,
    )

