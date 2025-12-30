from fastapi import APIRouter, Depends, Response, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from app.core.auth.manager import UserManager
from app.core.auth.users import get_admin_manager
from app.core.auth.jwt import get_admin_jwt_strategy, admin_cookie_transport
from app.core.auth.csrf_utils import create_csrf_token_with_timestamp
from app.core.config import settings

router = APIRouter()


@router.post("/login", status_code=status.HTTP_204_NO_CONTENT)
async def admin_login(
    response: Response,
    credentials: OAuth2PasswordRequestForm = Depends(),
    admin_manager: UserManager = Depends(get_admin_manager),
):
    """
    Admin login endpoint that sets both access token and CSRF token.
    
    This endpoint:
    1. Validates admin credentials
    2. Issues an admin access token (JWT) as an HTTP-only cookie
    3. Issues an admin CSRF token as a readable cookie for client-side access
    4. Returns admin information
    
    The admin CSRF token is required for all subsequent state-changing operations.
    """
    # Authenticate admin
    admin = await admin_manager.authenticate(credentials)
    
    if admin is None or not admin.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="LOGIN_BAD_CREDENTIALS",
        )
    
    # Generate JWT access token
    jwt_strategy = get_admin_jwt_strategy()
    access_token = await jwt_strategy.write_token(admin)
    
    # Set admin access token cookie
    response.set_cookie(
        key=admin_cookie_transport.cookie_name,
        value=access_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=admin_cookie_transport.cookie_max_age,
        path="/",
    )
    
    # Generate and set admin CSRF token
    if settings.CSRF_ENABLED:
        csrf_token = create_csrf_token_with_timestamp()
        response.set_cookie(
            key="admin_csrf_token",
            value=csrf_token,
            httponly=False,  # Must be readable by JS
            secure=True,
            samesite="lax",
            max_age=settings.CSRF_TOKEN_EXPIRE_MINUTES * 60,
            path="/",
        )
    
    # Return admin info
    return 
    