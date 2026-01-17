"""Routers package."""

from app.routers.auth import router as auth_router
from app.routers.images import router as images_router
from app.routers.users import router as users_router
from app.routers.faces import router as faces_router
from app.routers.admin import router as admin_router

__all__ = [
    "auth_router",
    "images_router",
    "users_router",
    "faces_router",
    "admin_router",
]
