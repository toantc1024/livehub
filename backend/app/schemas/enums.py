"""
Enums matching Prisma schema exactly.
"""

from enum import Enum


class Role(str, Enum):
    """User role enum - matches Prisma Role"""
    USER = "USER"
    ADMIN = "ADMIN"


class ImageStatus(str, Enum):
    """Image processing status - matches Prisma ImageStatus"""
    PROCESSING = "PROCESSING"
    READY = "READY"
    ERROR = "ERROR"
