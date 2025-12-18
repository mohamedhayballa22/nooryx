from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from starlette.types import ASGIApp
from app.core.config import settings
from app.core.auth.csrf_utils import verify_csrf_token
from app.core.logger_config import logger


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection middleware using double-submit cookie pattern.
    
    - Validates CSRF token on state-changing methods (POST, PUT, PATCH, DELETE)
    - Skips validation in dev environment
    - Skips validation for exempt paths (login, public endpoints)
    - Token is validated by comparing cookie value with header value
    """
    
    # Paths that don't require CSRF validation
    EXEMPT_PATHS = {
        "/api/auth/jwt/login",
        "/api/auth/register",
        "/openapi.json",
        "/api-docs",
        "/redoc",
        "/health",
        "/api/webhooks",
        "/api/auth/sessions/refresh",
        "/api/auth/join",
        "/api/waitlist",
        # TODO: Add specific webhooks to exempt paths
    }
    
    # Methods that require CSRF validation
    PROTECTED_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
    
    def __init__(self, app: ASGIApp):
        super().__init__(app)
    
    async def dispatch(self, request: Request, call_next) -> Response:
        # Optionally disable CSRF in non-production environments
        if not settings.CSRF_ENABLED:
            return await call_next(request)
        
        # Skip for exempt paths
        if any(request.url.path.startswith(path) for path in self.EXEMPT_PATHS):
            return await call_next(request)
        
        # Skip for safe methods
        if request.method not in self.PROTECTED_METHODS:
            return await call_next(request)
        
        # Get CSRF token from cookie
        csrf_cookie = request.cookies.get(settings.CSRF_COOKIE_NAME)
        
        # Get CSRF token from header
        csrf_header = request.headers.get(settings.CSRF_HEADER_NAME)
        
        # Validate both exist
        if not csrf_cookie or not csrf_header:
            logger.warning(
                "csrf_validation_failed",
                reason="missing_token",
                path=request.url.path,
                method=request.method,
                has_cookie=bool(csrf_cookie),
                has_header=bool(csrf_header),
            )
            return JSONResponse(
                status_code=403,
                content={
                    "error": {
                        "type": "csrf_error",
                        "message": "CSRF token missing",
                    }
                },
            )
        
        # Validate tokens match
        if csrf_cookie != csrf_header:
            logger.warning(
                "csrf_validation_failed",
                reason="token_mismatch",
                path=request.url.path,
                method=request.method,
            )
            return JSONResponse(
                status_code=403,
                content={
                    "error": {
                        "type": "csrf_error",
                        "message": "CSRF token mismatch",
                    }
                },
            )
        
        # Validate token signature and expiration
        if not verify_csrf_token(csrf_cookie):
            logger.warning(
                "csrf_validation_failed",
                reason="invalid_or_expired",
                path=request.url.path,
                method=request.method,
            )
            return JSONResponse(
                status_code=403,
                content={
                    "error": {
                        "type": "csrf_error",
                        "message": "CSRF token invalid or expired",
                    }
                },
            )
        
        # Token is valid, proceed with request
        return await call_next(request)
    