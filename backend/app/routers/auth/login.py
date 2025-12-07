from fastapi import APIRouter, Depends, Response, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_session
from app.core.auth.manager import UserManager
from app.core.auth.users import get_user_manager
from app.core.auth.jwt import get_jwt_strategy, cookie_transport
from app.core.auth.csrf_utils import create_csrf_token_with_timestamp
from app.core.config import settings

router = APIRouter()


@router.post("/login")
async def login(
    response: Response,
    credentials: OAuth2PasswordRequestForm = Depends(),
    user_manager: UserManager = Depends(get_user_manager),
    session: AsyncSession = Depends(get_session),
):
    """
    Custom login endpoint that sets both access token and CSRF token.
    
    This endpoint:
    1. Validates user credentials
    2. Issues an access token (JWT) as an HTTP-only cookie
    3. Issues a CSRF token as a readable cookie for client-side access
    4. Returns user information
    
    The CSRF token is required for all subsequent state-changing operations.
    """
    # Authenticate user
    user = await user_manager.authenticate(credentials)
    
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LOGIN_BAD_CREDENTIALS",
        )
    
    # Generate JWT access token
    jwt_strategy = get_jwt_strategy()
    access_token = await jwt_strategy.write_token(user)
    
    # Set access token cookie
    response.set_cookie(
        key=cookie_transport.cookie_name,
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=cookie_transport.cookie_max_age,
        path="/",
    )
    
    # Generate and set CSRF token (only in prod)
    if settings.ENVIRONMENT != "dev":
        csrf_token = create_csrf_token_with_timestamp()
        response.set_cookie(
            key=settings.CSRF_COOKIE_NAME,
            value=csrf_token,
            httponly=False,  # Must be readable by JS
            secure=True,
            samesite="lax",
            max_age=settings.CSRF_TOKEN_EXPIRE_MINUTES * 60,
            path="/",
        )
    
    # Return user info
    return {
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
    }
    