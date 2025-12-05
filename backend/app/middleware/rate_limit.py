from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import time

from app.core.rate_limiter import rate_limiter

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, default_capacity: int = 25, default_rate: float = 5):
        super().__init__(app)
        self.default_capacity = default_capacity
        self.default_rate = default_rate
    
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host
        key = f"ip:{client_ip}"
        
        # # Customize rate limits per endpoint
        path = request.url.path
        if path.startswith("/api/auth"):
            capacity, rate = 5, 0.1
        else:
            capacity, rate = self.default_capacity, self.default_rate
        
        allowed, info = await rate_limiter.is_allowed(key, capacity, rate)
        
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "retry_after": int(info["reset_time"] - time.time())
                },
                headers={
                    "X-RateLimit-Limit": str(self.default_capacity),
                    "X-RateLimit-Remaining": str(info["remaining"]),
                    "X-RateLimit-Reset": str(int(info["reset_time"]))
                }
            )
        
        response = await call_next(request)
        
        response.headers["X-RateLimit-Limit"] = str(self.default_capacity)
        response.headers["X-RateLimit-Remaining"] = str(info["remaining"])
        response.headers["X-RateLimit-Reset"] = str(int(info["reset_time"]))
        
        return response
    