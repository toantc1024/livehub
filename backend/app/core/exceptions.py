"""
Custom exceptions for the application.
"""

from fastapi import HTTPException, status


class ImageNotFoundError(HTTPException):
    def __init__(self, image_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Image not found: {image_id}",
        )


class FaceNotFoundError(HTTPException):
    def __init__(self, face_id: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Face not found: {face_id}",
        )


class FaceDetectionError(HTTPException):
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Face detection failed: {message}",
        )


class StorageError(HTTPException):
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Storage error: {message}",
        )


class VectorStoreError(HTTPException):
    def __init__(self, message: str):
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Vector store error: {message}",
        )
