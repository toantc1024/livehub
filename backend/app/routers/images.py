"""
Images router - Upload (admin-only) and listing endpoints.
"""

from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, UploadFile, File, Query, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.core.dependencies import CurrentUser, AdminUser
from app.schemas import ImageUploadResponse, ImageListResponse, ImageResponse, ImageStatus, ImageWithFaces
from app.services.storage import storage_service
from app.services.background import schedule_image_processing
from app.models.image import Image
from app.models.face import Face
from app.database import get_db


router = APIRouter(prefix="/images", tags=["Images"])


# ==================
# Upload (Admin Only)
# ==================

@router.post("/upload", response_model=ImageUploadResponse, status_code=status.HTTP_202_ACCEPTED)
async def upload_image(
    admin: AdminUser,  # Only admin can upload
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    """
    Upload an image for processing (admin only).
    
    1. Saves file to MinIO storage
    2. Creates database entry with PROCESSING status
    3. Schedules background job for face detection (non-blocking)
    4. Returns immediately with 202 Accepted
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image",
        )
    
    # Read file
    file_bytes = await file.read()
    
    # Generate image ID
    image_id = str(uuid4())
    
    # Upload to storage (async to avoid blocking event loop)
    try:
        storage_service.init()
        storage_path = await storage_service.async_upload_file(
            file_data=file_bytes,
            filename=file.filename or "image.jpg",
            content_type=file.content_type,
            folder=f"events",  # All event images go to events folder
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload file: {str(e)}",
        )
    
    # Generate URL
    original_url = storage_service.get_presigned_url(storage_path, expires_hours=24 * 7)
    
    # Generate blur placeholder for lazy loading (runs in background, non-blocking)
    import asyncio
    blur_placeholder = await asyncio.to_thread(
        storage_service.generate_blur_placeholder, file_bytes
    )
    
    # Create database entry
    image = Image(
        id=image_id,
        userId=admin.id,
        filename=file.filename or "image.jpg",
        originalUrl=original_url,
        storagePath=storage_path,
        status=ImageStatus.PROCESSING,
        imageData={"blurDataURL": blur_placeholder} if blur_placeholder else None,
    )
    db.add(image)
    await db.commit()
    
    # Schedule background processing (non-blocking - returns immediately)
    schedule_image_processing(image_id, storage_path, admin.id)
    
    return ImageUploadResponse(
        id=image_id,
        status=ImageStatus.PROCESSING,
        message="Image uploaded and queued for processing",
    )


# ==================
# Listing Endpoints
# ==================

@router.get("", response_model=ImageListResponse)
async def list_images(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    image_status: Optional[ImageStatus] = Query(None, alias="status"),
):
    """
    List all images with pagination (for admin gallery view).
    """
    # Query all images (not just user's)
    query = select(Image)
    
    if image_status:
        query = query.where(Image.status == image_status)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
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


@router.get("/recent", response_model=ImageListResponse)
async def get_recent_images(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(6, ge=1, le=20),
):
    """
    Get recent images from entire system (authenticated).
    
    Used for "Những khoảnh khắc đáng nhớ" section on gallery homepage.
    Only returns READY images.
    """
    # Query all READY images, newest first
    query = select(Image).where(Image.status == ImageStatus.READY)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
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


@router.get("/public/recent", response_model=ImageListResponse)
async def get_recent_images_public(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(6, ge=1, le=20),
):
    """
    Get recent images from entire system (public, no authentication required).
    
    Used for "Những khoảnh khắc đáng nhớ" section on homepage for non-authenticated users.
    Only returns READY images. Face recognition features require authentication.
    """
    # Query all READY images, newest first
    query = select(Image).where(Image.status == ImageStatus.READY)
    
    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
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


@router.get("/my-faces", response_model=ImageListResponse)
async def get_images_with_my_face(
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """
    Get images containing the current user's detected face.
    
    This returns images where Face.userId matches the current user,
    regardless of who uploaded the image.
    
    Flow:
    1. User registers their face via POST /users/register-face
    2. Backfill job matches their face against all existing faces
    3. Face.userId is set for matching faces
    4. This endpoint returns images with those faces
    """
    # Query distinct image IDs that have faces assigned to current user
    # Using only Image.id for distinct to avoid JSON column comparison issues
    image_ids_query = (
        select(Image.id)
        .join(Face, Face.imageId == Image.id)
        .where(Face.userId == user.id)
        .distinct()
    )
    
    # Count total distinct images
    count_query = select(func.count()).select_from(image_ids_query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Get paginated image IDs
    image_ids_query = image_ids_query.order_by(Image.id).offset((page - 1) * page_size).limit(page_size)
    ids_result = await db.execute(image_ids_query)
    image_ids = [row[0] for row in ids_result.fetchall()]
    
    # Fetch full images
    if image_ids:
        images_query = (
            select(Image)
            .where(Image.id.in_(image_ids))
            .order_by(Image.createdAt.desc())
        )
        result = await db.execute(images_query)
        images = result.scalars().all()
    else:
        images = []
    
    return ImageListResponse(
        items=[ImageResponse.model_validate(img) for img in images],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total > 0 else 0,
    )


@router.get("/{image_id}", response_model=ImageWithFaces)
async def get_image(
    image_id: str,
    user: CurrentUser,
    db: AsyncSession = Depends(get_db),
):
    """
    Get image details by ID with faces.
    """
    query = (
        select(Image)
        .options(selectinload(Image.faces))
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


@router.get("/proxy/{object_path:path}", include_in_schema=False)
async def proxy_image(object_path: str):
    """
    Proxy image from MinIO through backend.
    
    This avoids exposing MinIO directly and fixes hostname issues.
    Uses async wrapper to avoid blocking the event loop.
    """
    from fastapi.responses import StreamingResponse
    import mimetypes
    import asyncio
    
    try:
        storage_service.init()
        # Get stream from MinIO using async wrapper to avoid blocking
        response = await storage_service.async_get_file_stream(object_path)
        
        # Determine media type
        media_type, _ = mimetypes.guess_type(object_path)
        if not media_type:
            media_type = "application/octet-stream"
        
        # Use async generator for streaming
        async def async_iterfile():
            try:
                # Read in chunks using thread pool to avoid blocking
                while True:
                    chunk = await asyncio.to_thread(response.read, 32*1024)
                    if not chunk:
                        break
                    yield chunk
            finally:
                response.close()
                response.release_conn()
        
        return StreamingResponse(
            async_iterfile(),
            media_type=media_type
        )
            
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image not found: {str(e)}",
        )
