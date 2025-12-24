from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import time
import jwt
import hashlib
from typing import Optional, Tuple

from app.core.rate_limiter import rate_limiter
from app.core.config import settings
from app.core.logger_config import logger


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)

    def _get_client_ip(self, request: Request) -> str:
        """
        Extract client IP with proper proxy support.
        Respects X-Forwarded-For when behind nginx reverse proxy.
        """
        # When behind nginx, check X-Forwarded-For header
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            # X-Forwarded-For can be: "client, proxy1, proxy2"
            # Take the first (leftmost) IP as the real client
            client_ip = forwarded_for.split(",")[0].strip()
            if client_ip:
                return client_ip
        
        # Fallback to X-Real-IP (another common nginx header)
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip.strip()
        
        # Final fallback to direct connection IP
        if request.client and request.client.host:
            return request.client.host
        
        return "unknown"

    def _get_client_fingerprint(self, request: Request) -> str:
        """
        Create a privacy-compliant fingerprint from IP + User-Agent + Accept-Language.
        This helps distinguish individual users behind the same IP (NAT, corporate networks).
        """
        try:
            client_ip = self._get_client_ip(request)
            user_agent = request.headers.get("user-agent", "")[:200]  # Limit length
            accept_lang = request.headers.get("accept-language", "")[:20]
            
            fingerprint_data = f"{client_ip}:{user_agent}:{accept_lang}"
            
            return hashlib.sha256(
                fingerprint_data.encode('utf-8', errors='ignore')
            ).hexdigest()[:16]
        except Exception as e:
            logger.warning(f"Fingerprint generation failed: {type(e).__name__}: {str(e)}")
            # Return a consistent fallback for this request
            return hashlib.sha256(b"fallback").hexdigest()[:16]

    def _extract_user_id(self, request: Request) -> Optional[str]:
        """
        Safely extract and verify user_id from JWT token.
        Returns None if token is invalid, expired, or missing.
        """
        token = request.cookies.get("access_token")
        
        if not token or not token.strip():
            return None
        
        try:
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                audience=["nooryx_users"],
            )
            user_id = payload.get("sub")
            
            # Validate user_id is usable (non-empty string)
            if not user_id or not isinstance(user_id, str) or not user_id.strip():
                return None
                
            return user_id.strip()
            
        except jwt.ExpiredSignatureError:
            # Token expired - this is normal, not an error
            return None
        except jwt.InvalidTokenError:
            # Invalid token - could be tampered or malformed
            return None
        except jwt.DecodeError:
            # Malformed JWT structure
            return None
        except Exception as e:
            # Unexpected error - log for monitoring
            logger.warning(
                f"Unexpected JWT decode error: {type(e).__name__}: {str(e)}",
                extra={"token_prefix": token[:20] if len(token) > 20 else token}
            )
            return None

    def _get_rate_limit_config(
        self, path: str, user_id: Optional[str]
    ) -> Tuple[str, int, float]:
        """
        Determine rate limit tier, capacity, and refill rate based on endpoint and auth status.
        Returns: (tier_name, capacity, refill_rate)
        """
        if path.startswith("/api/auth/jwt/login"):
            return ("login", 10, 0.1)  # 6/min

        elif path.startswith("/api/auth/register") or path.startswith("/api/auth/join"):
            return ("signup", 5, 0.08)  # ~5/min

        elif path.startswith("/api/auth/sessions/refresh"):
            if user_id:
                return ("auth_refresh", 200, 5)  # 300/min for authenticated
            else:
                return ("public_refresh", 50, 0.5)  # 30/min for public

        elif path.startswith("/api/auth/sessions"):
            return ("auth_session", 60, 2)  # 120/min

        elif path.startswith("/api/auth"):
            return ("auth_general", 20, 0.5)  # 30/min

        else:
            return ("default", 200, 2)  # 120/min

    def _create_rate_limit_key(
        self, user_id: Optional[str], fingerprint: str, tier: str
    ) -> str:
        """
        Create rate limit key with proper user segmentation.
        Authenticated users are tracked by user_id.
        Unauthenticated users are tracked by fingerprint.
        """
        if user_id:
            return f"user:{user_id}:{tier}"
        else:
            return f"fp:{fingerprint}:{tier}"

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        
        # Extract user identity
        user_id = self._extract_user_id(request)
        fingerprint = self._get_client_fingerprint(request)
        
        # Determine rate limit configuration
        tier, capacity, rate = self._get_rate_limit_config(path, user_id)
        
        # Create segmented key
        key = self._create_rate_limit_key(user_id, fingerprint, tier)
        
        # Execute rate limiting with failure handling
        try:
            allowed, info = await rate_limiter.is_allowed(key, capacity, rate)
        except Exception as e:
            # Rate limiter failure (Redis down, network issue, etc.)
            logger.error(
                f"Rate limiter failure - failing open",
                extra={
                    "error_type": type(e).__name__,
                    "error_msg": str(e),
                    "path": path,
                    "tier": tier,
                    "key": key,
                }
            )
            # Fail open: allow request through when rate limiter is unavailable
            response = await call_next(request)
            response.headers["X-RateLimit-Status"] = "bypassed"
            return response
        
        # Check if request is allowed
        if not allowed:
            # Calculate retry_after, ensuring it's always positive
            retry_after = max(1, int(info.get("reset_time", time.time() + 60) - time.time()))
            
            logger.warning(
                "Rate limit exceeded",
                extra={
                    "method": request.method,
                    "path": path,
                    "status_code": 429,
                    "tier": tier,
                    "user_id": user_id if user_id else "anonymous",
                    "client_ip": self._get_client_ip(request),
                    "retry_after": retry_after,
                }
            )
            
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"Too many requests. Please try again in {retry_after} seconds.",
                    "retry_after": retry_after
                },
                headers={
                    "Retry-After": str(retry_after),
                    "X-RateLimit-Limit": str(capacity),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(info.get("reset_time", time.time() + 60))),
                }
            )
        
        # Request allowed - proceed
        response = await call_next(request)
        
        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(capacity)
        response.headers["X-RateLimit-Remaining"] = str(info.get("remaining", 0))
        response.headers["X-RateLimit-Reset"] = str(int(info.get("reset_time", time.time())))
        response.headers["X-RateLimit-Tier"] = tier
        
        return response
    