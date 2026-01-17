"""
Google OAuth authentication router.

Flow:
1. Frontend calls GET /auth/google/login → Backend returns Google OAuth URL
2. User authenticates with Google → Redirects to /auth/google/callback (port 8080)
3. Backend exchanges code for tokens, creates/updates user in DB, issues JWT
4. Backend redirects to frontend/auth/callback?token=... (port 3000)
5. Frontend stores JWT and uses for API calls
"""

from datetime import datetime, timedelta
from typing import Optional
from uuid import uuid4
import secrets

from fastapi import APIRouter, HTTPException, status, Query, Depends
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import httpx

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.schemas.enums import Role
from app.core.dependencies import get_current_user
from app.schemas.user import UserFromJWT


router = APIRouter(prefix="/auth", tags=["Authentication"])


# ==================
# Schemas
# ==================

class GoogleLoginResponse(BaseModel):
    """Response with Google OAuth URL."""
    url: str


class TokenResponse(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class GoogleUserInfo(BaseModel):
    """User info from Google."""
    id: str
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None


# ==================
# OAuth Helpers
# ==================

def create_jwt_token(
    user_id: str, 
    email: str, 
    role: str, 
    name: Optional[str] = None,
    avatar_url: Optional[str] = None,
) -> str:
    """Create JWT token for user."""
    from jose import jwt
    
    now = datetime.utcnow()
    expires = now + timedelta(days=settings.JWT_EXPIRE_DAYS)
    
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "name": name,
        "avatar_url": avatar_url,
        "iat": int(now.timestamp()),
        "exp": int(expires.timestamp()),
    }
    
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


async def exchange_code_for_tokens(code: str, redirect_uri: str) -> dict:
    """Exchange authorization code for Google tokens."""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.GOOGLE_CLIENT_ID,
                "client_secret": settings.GOOGLE_CLIENT_SECRET,
                "code": code,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to exchange code: {response.text}",
            )
        
        return response.json()


async def get_google_user_info(access_token: str) -> GoogleUserInfo:
    """Get user info from Google."""
    async with httpx.AsyncClient() as client:
        response = await client.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        
        if response.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user info from Google",
            )
        
        data = response.json()
        return GoogleUserInfo(
            id=data["id"],
            email=data["email"],
            name=data.get("name"),
            picture=data.get("picture"),
        )


async def get_or_create_user(
    db: AsyncSession,
    google_user: GoogleUserInfo,
) -> User:
    """Get existing user or create new one from Google info."""
    # Try to find by googleId
    result = await db.execute(
        select(User).where(User.googleId == google_user.id)
    )
    user = result.scalar_one_or_none()
    
    if user:
        # Update profile from Google
        user.name = google_user.name or user.name
        user.avatarUrl = google_user.picture or user.avatarUrl
        user.updatedAt = datetime.utcnow()
        await db.commit()
        return user
    
    # Create new user
    role = Role.ADMIN if google_user.email in settings.ADMIN_EMAILS else Role.USER
    
    new_user = User(
        id=str(uuid4()),
        googleId=google_user.id,
        email=google_user.email,
        name=google_user.name,
        avatarUrl=google_user.picture,
        role=role,
        profileData={},
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return new_user


# ==================
# Endpoints
# ==================

@router.get("/google/login", response_model=GoogleLoginResponse)
async def google_login():
    """
    Get Google OAuth login URL.
    
    Frontend should redirect user to this URL.
    """
    state = secrets.token_urlsafe(32)
    
    # Callback goes to BACKEND (port 8080)
    redirect_uri = f"{settings.BACKEND_URL}/api/v1/auth/google/callback"
    
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "state": state,
        "prompt": "select_account",
    }
    
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + "&".join(
        f"{k}={v}" for k, v in params.items()
    )
    
    return GoogleLoginResponse(url=url)


@router.get("/google/callback")
async def google_callback(
    code: str = Query(...),
    state: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Google OAuth callback (PORT 8080).
    
    After success, redirects to frontend (PORT 3000) with JWT token.
    """
    redirect_uri = f"{settings.BACKEND_URL}/api/v1/auth/google/callback"
    
    # Exchange code for tokens
    tokens = await exchange_code_for_tokens(code, redirect_uri)
    access_token = tokens.get("access_token")
    
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No access token in response",
        )
    
    # Get user info from Google
    google_user = await get_google_user_info(access_token)
    
    # Create or update user in database
    user = await get_or_create_user(db, google_user)
    
    # Create JWT
    jwt_token = create_jwt_token(
        user_id=user.id,
        email=user.email,
        role=user.role.value,
        name=user.name,
        avatar_url=user.avatarUrl,
    )
    
    # Redirect to FRONTEND (port 3000) with token
    frontend_url = f"{settings.FRONTEND_URL}/auth/callback?token={jwt_token}"
    
    return RedirectResponse(url=frontend_url)


@router.get("/validate")
async def validate_token(
    user: UserFromJWT = Depends(get_current_user),
):
    """
    Validate JWT token and return user info.
    
    This endpoint ONLY validates the JWT - no database query.
    This ensures auth validation works even if database is under load.
    """
    # Return JWT data directly - no database query needed for validation
    return {
        "valid": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role.value,
            "name": user.name,
            "avatarUrl": user.avatar_url,
        }
    }


@router.get("/validate/full")
async def validate_token_full(
    user: UserFromJWT = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Validate JWT token and return user info with full profile from database."""
    # Fetch full user from database to get profileData
    result = await db.execute(
        select(User).where(User.id == user.id)
    )
    db_user = result.scalar_one_or_none()
    
    if db_user:
        return {
            "valid": True,
            "user": {
                "id": db_user.id,
                "email": db_user.email,
                "role": db_user.role.value,
                "name": db_user.name,
                "avatarUrl": db_user.avatarUrl,
                "profileData": db_user.profileData,
            }
        }
    
    # Fallback to JWT data if user not found in DB
    return {
        "valid": True,
        "user": {
            "id": user.id,
            "email": user.email,
            "role": user.role.value,
            "name": user.name,
            "avatarUrl": user.avatar_url,
        }
    }


@router.post("/logout")
async def logout():
    """Logout - frontend clears token."""
    return {"message": "Logged out. Clear token from frontend."}


@router.get("/google/login/desktop", response_model=GoogleLoginResponse)
async def google_login_desktop():
    """
    Get Google OAuth login URL for desktop app.
    
    Uses a different callback that redirects to localhost.
    """
    state = secrets.token_urlsafe(32) + "_desktop"
    
    # Callback goes to BACKEND (port 8080)
    redirect_uri = f"{settings.BACKEND_URL}/api/v1/auth/google/callback/desktop"
    
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "state": state,
        "prompt": "select_account",
    }
    
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + "&".join(
        f"{k}={v}" for k, v in params.items()
    )
    
    return GoogleLoginResponse(url=url)


@router.get("/google/callback/desktop")
async def google_callback_desktop(
    code: str = Query(...),
    state: str = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Google OAuth callback for desktop app.
    
    Redirects to localhost:5556/callback with token.
    """
    redirect_uri = f"{settings.BACKEND_URL}/api/v1/auth/google/callback/desktop"
    
    # Exchange code for tokens
    tokens = await exchange_code_for_tokens(code, redirect_uri)
    access_token = tokens.get("access_token")
    
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No access token in response",
        )
    
    # Get user info from Google
    google_user = await get_google_user_info(access_token)
    
    # Create or update user in database
    user = await get_or_create_user(db, google_user)
    
    # Create JWT
    jwt_token = create_jwt_token(
        user_id=user.id,
        email=user.email,
        role=user.role.value,
        name=user.name,
        avatar_url=user.avatarUrl,
    )
    
    # Redirect to desktop app's local server
    desktop_callback = f"http://127.0.0.1:5556/callback?token={jwt_token}"
    
    return RedirectResponse(url=desktop_callback)

