from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import time
import jwt
import hashlib

from app.core.rate_limiter import rate_limiter
from app.core.config import settings
from app.core.logger_config import logger


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)

    def _get_client_fingerprint(self, request: Request) -> str:
        """
        Create a privacy-compliant fingerprint from IP + User-Agent + Accept-Language.
        This helps distinguish individual users behind the same IP.
        """
        client_ip = request.client.host
        user_agent = request.headers.get("user-agent", "")
        accept_lang = request.headers.get("accept-language", "")[:20]  # first 20 chars
        
        fingerprint_data = f"{client_ip}:{user_agent}:{accept_lang}"
        
        return hashlib.sha256(fingerprint_data.encode()).hexdigest()[:16]

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        
        # Retrieve and VERIFY user_id from JWT token
        user_id = None
        token = request.cookies.get("access_token")

        if token:
            try:
                # Properly verify signature using your secret key
                payload = jwt.decode(
                    token,
                    settings.SECRET_KEY,
                    algorithms=[settings.ALGORITHM],
                    audience=["nooryx_users"],
                )
                user_id = payload.get("sub")
            except jwt.ExpiredSignatureError:
                # Token expired - treat as unauthenticated
                pass
            except jwt.InvalidTokenError:
                # Invalid token - treat as unauthenticated
                pass

        # Choose the rate limit tier based on the endpoint
        if path.startswith("/api/auth/jwt/login"):
            tier = "login"
            capacity = 10
            rate = 0.1

        elif path.startswith("/api/auth/register") or path.startswith("/api/auth/join"):
            tier = "signup"
            capacity = 5
            rate = 0.08

        elif path.startswith("/api/auth/sessions/refresh"):
            # refresh must allow far more when authenticated
            if user_id:
                tier = "auth_refresh"
                capacity = 200
                rate = 5  # 300/min
            else:
                tier = "public_refresh"
                capacity = 50
                rate = 0.5

        elif path.startswith("/api/auth/sessions"):
            tier = "auth_session"
            capacity = 60
            rate = 2

        elif path.startswith("/api/auth"):
            tier = "auth_general"
            capacity = 20
            rate = 0.5

        else:
            tier = "default"
            capacity = 200
            rate = 2

        # Create key (per user if authenticated, else per fingerprint)
        if user_id:
            key = f"user:{user_id}:{tier}"
        else:
            fingerprint = self._get_client_fingerprint(request)
            key = f"fp:{fingerprint}:{tier}"

        # Execute rate limiting
        allowed, info = await rate_limiter.is_allowed(key, capacity, rate)
        if not allowed:
            logger.warning(
                "http_request_error",
                method=request.method,
                path=path,
                status_code=429,
                message="Rate limit exceeded",
                tier=tier,
            )
            
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "retry_after": int(info["reset_time"] - time.time())
                },
                headers={
                    "Retry-After": str(int(info["reset_time"] - time.time()))
                }
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(capacity)
        response.headers["X-RateLimit-Remaining"] = str(info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(int(info["reset_time"]))

        return response
    