"""
Users router - Face registration and profile endpoints.
"""

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional

from app.core.dependencies import CurrentUser
from app.schemas import UserFaceRegisterResponse
from app.schemas.user import UserProfileData, UserResponse
from app.services.face_detection import face_detection_service
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
    
    1. User uploads a clear selfie
    2. System detects face and generates embedding
    3. Queues task to store embedding and run backfill
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image",
        )
    
    # Read file
    file_bytes = await file.read()
    
    try:
        # Detect single face - this is quick, can run in API
        embedding = face_detection_service.get_single_face_embedding(file_bytes)
        
        if embedding is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No face detected in image. Please upload a clear selfie.",
            )
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Face detection failed: {str(e)}",
        )
    
    try:
        # Queue face registration task for worker
        # Worker will: 1) Store in Qdrant, 2) Run backfill
        from app.services.background import queue_face_registration
        
        task_id = await queue_face_registration(
            db=db,
            user_id=user.id,
            embedding=embedding,
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to queue face registration: {str(e)}",
        )
    
    return UserFaceRegisterResponse(
        qdrant_id=task_id,  # Return task ID instead of qdrant ID (will be created by worker)
        message="Face registration queued. Backfill will run automatically.",
        backfill_triggered=True,
    )


class FaceStatusResponse(BaseModel):
    """Response for face status check."""
    hasRegisteredFace: bool
    registeredAt: Optional[datetime] = None


@router.get("/face-status", response_model=FaceStatusResponse)
async def get_face_status(
    user: CurrentUser,
):
    """
    Check if user has registered their face.
    
    Returns whether user has a reference face stored in Qdrant.
    """
    try:
        await vector_store_service.init()
        
        # Check if user has a reference in Qdrant
        has_face = await vector_store_service.check_user_has_reference(user.id)
        
        await vector_store_service.close()
        
        return FaceStatusResponse(
            hasRegisteredFace=has_face,
            registeredAt=datetime.utcnow() if has_face else None,
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check face status: {str(e)}",
        )

