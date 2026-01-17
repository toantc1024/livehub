"""
MinIO Storage Service for image uploads.

Note: MinIO client is synchronous. When used from async handlers,
always use asyncio.to_thread() to avoid blocking the event loop.
"""

import logging
from typing import BinaryIO, Optional
from io import BytesIO
from uuid import uuid4
import asyncio

from minio import Minio
from minio.error import S3Error

from app.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    """MinIO/S3 storage service for images."""
    
    def __init__(self):
        self.client: Optional[Minio] = None
        self.bucket = settings.MINIO_BUCKET
    
    def init(self):
        """Initialize MinIO client."""
        self.client = Minio(
            endpoint=settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        
        # Ensure bucket exists
        if not self.client.bucket_exists(self.bucket):
            self.client.make_bucket(self.bucket)
            logger.info(f"Created bucket: {self.bucket}")
    
    def upload_file(
        self,
        file_data: bytes,
        filename: str,
        content_type: str = "image/jpeg",
        folder: str = "uploads",
    ) -> str:
        """
        Upload file to MinIO.
        
        Args:
            file_data: File bytes
            filename: Original filename
            content_type: MIME type
            folder: Folder in bucket
            
        Returns:
            Storage path (object name)
        """
        # Generate unique path
        ext = filename.split(".")[-1] if "." in filename else "jpg"
        object_name = f"{folder}/{uuid4()}.{ext}"
        
        self.client.put_object(
            bucket_name=self.bucket,
            object_name=object_name,
            data=BytesIO(file_data),
            length=len(file_data),
            content_type=content_type,
        )
        
        logger.info(f"Uploaded file: {object_name}")
        return object_name
    
    def generate_blur_placeholder(self, file_data: bytes, size: tuple = (8, 8)) -> str:
        """
        Generate a tiny blur placeholder image as base64.
        
        Args:
            file_data: Original image bytes
            size: Blur image dimensions (default 8x8)
            
        Returns:
            Base64 data URL for blur placeholder
        """
        try:
            from PIL import Image as PILImage
            import base64
            
            # Open and resize to tiny size
            img = PILImage.open(BytesIO(file_data))
            img = img.convert("RGB")
            img = img.resize(size, PILImage.Resampling.LANCZOS)
            
            # Save as low-quality JPEG
            buffer = BytesIO()
            img.save(buffer, format="JPEG", quality=10)
            buffer.seek(0)
            
            # Encode as base64 data URL
            b64 = base64.b64encode(buffer.getvalue()).decode("utf-8")
            return f"data:image/jpeg;base64,{b64}"
            
        except Exception as e:
            logger.warning(f"Failed to generate blur placeholder: {e}")
            return ""
    
    def download_file(self, object_name: str) -> bytes:
        """
        Download file from MinIO.
        
        Args:
            object_name: Storage path
            
        Returns:
            File bytes
        """
        response = self.client.get_object(
            bucket_name=self.bucket,
            object_name=object_name,
        )
        
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()
    
    def get_presigned_url(
        self,
        object_name: str,
        expires_hours: int = 1,
    ) -> str:
        """
        Get presigned URL for file access.
        
        Args:
            object_name: Storage path
            expires_hours: URL expiration time
            
        Returns:
            Presigned URL
        """
        from datetime import timedelta
        
        return self.client.presigned_get_object(
            bucket_name=self.bucket,
            object_name=object_name,
            expires=timedelta(hours=expires_hours),
        )
    
    def delete_file(self, object_name: str):
        """Delete file from storage."""
        self.client.remove_object(
            bucket_name=self.bucket,
            object_name=object_name,
        )
        logger.info(f"Deleted file: {object_name}")

    def get_file_stream(self, object_name: str):
        """
        Get file stream from MinIO.
        
        Returns:
            MinIO response object (streamable)
        """
        return self.client.get_object(
            bucket_name=self.bucket,
            object_name=object_name,
        )
    
    # ===========================
    # Async wrappers (for use in async handlers)
    # ===========================
    
    async def async_download_file(self, object_name: str) -> bytes:
        """
        Download file from MinIO asynchronously.
        Runs sync operation in thread pool to avoid blocking event loop.
        """
        return await asyncio.to_thread(self.download_file, object_name)
    
    async def async_upload_file(
        self,
        file_data: bytes,
        filename: str,
        content_type: str = "image/jpeg",
        folder: str = "uploads",
    ) -> str:
        """
        Upload file to MinIO asynchronously.
        Runs sync operation in thread pool to avoid blocking event loop.
        """
        return await asyncio.to_thread(
            self.upload_file, file_data, filename, content_type, folder
        )
    
    async def async_get_file_stream(self, object_name: str):
        """
        Get file stream from MinIO asynchronously.
        Runs sync operation in thread pool to avoid blocking event loop.
        """
        return await asyncio.to_thread(self.get_file_stream, object_name)


# Global service instance
storage_service = StorageService()
