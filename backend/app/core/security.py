"""
JWT Security - Stateless token validation.

JWT is issued by NextAuth. FastAPI MUST:
- Validate signature using NEXTAUTH_SECRET
- Trust role from token
- Reject tokens without role
"""

from datetime import datetime
from typing import Optional

from fastapi import HTTPException, status
from jose import JWTError, jwt

from app.config import settings
from app.schemas.user import JWTPayload
from app.schemas.enums import Role


ALGORITHM = "HS256"


def decode_jwt(token: str) -> JWTPayload:
    """
    Decode and validate JWT token.
    
    Args:
        token: JWT token string (without Bearer prefix)
        
    Returns:
        JWTPayload with user info
        
    Raises:
        HTTPException: If token is invalid
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
        )
        
        user_id: Optional[str] = payload.get("sub")
        email: Optional[str] = payload.get("email")
        role: Optional[str] = payload.get("role")
        
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing user ID (sub)",
            )
        
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing email",
            )
        
        if not role:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token missing role",
            )
        
        try:
            validated_role = Role(role)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid role: {role}",
            )
        
        return JWTPayload(
            sub=user_id,
            email=email,
            role=validated_role,
            iat=payload.get("iat", 0),
            exp=payload.get("exp", 0),
            name=payload.get("name"),
        )
        
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def verify_not_expired(payload: JWTPayload) -> None:
    """Verify token hasn't expired."""
    if payload.exp < datetime.utcnow().timestamp():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired",
        )
