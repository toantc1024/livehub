"""
Faces router - Search and assignment endpoints.
"""

from typing import List

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status

from app.core.dependencies import CurrentUser, AdminUser
from app.schemas import (
    FaceSearchRequest,
    FaceSearchResult,
    FaceAssignRequest,
    FaceResponse,
)
from app.services.face_detection import face_detection_service
from app.services.vector_store import vector_store_service


router = APIRouter(prefix="/faces", tags=["Faces"])


@router.post("/search", response_model=List[FaceSearchResult])
async def search_faces(
    user: CurrentUser,
    file: UploadFile = File(None),
    request: FaceSearchRequest = None,
):
    """
    Search for similar faces.
    
    Can search by:
    - Uploaded image (will detect face and use embedding)
    - Direct embedding vector
    """
    embedding = None
    
    # Option 1: Search by uploaded image
    if file:
        file_bytes = await file.read()
        
        try:
            embedding = face_detection_service.get_single_face_embedding(file_bytes)
            
            if embedding is None:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="No face detected in image",
                )
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(e),
            )
    
    # Option 2: Search by embedding
    elif request:
        embedding = request.embedding
    
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Must provide either image file or embedding",
        )
    
    # Search in Qdrant
    try:
        await vector_store_service.init()
        
        threshold = request.threshold if request else 0.6
        limit = request.limit if request else 10
        
        results = await vector_store_service.search_similar(
            embedding=embedding,
            threshold=threshold,
            limit=limit,
        )
        
        await vector_store_service.close()
        
        return results
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Search failed: {str(e)}",
        )


@router.post("/assign")
async def assign_face(
    admin: AdminUser,
    request: FaceAssignRequest,
):
    """
    Manually assign a face to a user.
    
    Admin only endpoint for manual override.
    """
    try:
        await vector_store_service.init()
        
        # Update in Qdrant
        await vector_store_service.update_face_user(
            point_id=request.face_id,
            user_id=request.user_id,
        )
        
        await vector_store_service.close()
        
        # TODO: Update Face record in PostgreSQL
        
        return {
            "message": f"Face {request.face_id} assigned to user {request.user_id}",
            "assigned_by": admin.id,
        }
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Assignment failed: {str(e)}",
        )
