"""
FastAPI Dependencies for authentication.
"""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_jwt, verify_not_expired
from app.schemas.user import UserFromJWT
from app.schemas.enums import Role
from app.database import get_db


security = HTTPBearer(
    scheme_name="JWT",
    description="NextAuth JWT token",
    auto_error=True,
)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> UserFromJWT:
    """
    Extract current user from JWT token.
    
    CRITICAL: This is the ONLY way to get user info.
    Never query database for user information.
    """
    token = credentials.credentials
    jwt_payload = decode_jwt(token)
    verify_not_expired(jwt_payload)
    
    return UserFromJWT(
        id=jwt_payload.sub,
        email=jwt_payload.email,
        role=jwt_payload.role,
        name=jwt_payload.name,
    )


async def require_admin(
    user: Annotated[UserFromJWT, Depends(get_current_user)]
) -> UserFromJWT:
    """Require admin role."""
    if user.role != Role.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


# Type aliases for cleaner code
CurrentUser = Annotated[UserFromJWT, Depends(get_current_user)]
AdminUser = Annotated[UserFromJWT, Depends(require_admin)]
DbSession = Annotated[AsyncSession, Depends(get_db)]
