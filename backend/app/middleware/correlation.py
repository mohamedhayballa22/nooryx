import time
import uuid

import structlog
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = structlog.get_logger()


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))

        structlog.contextvars.clear_contextvars()
        context_vars = {"request_id": request_id}
        structlog.contextvars.bind_contextvars(**context_vars)

        start_time = time.time()

        try:
            response = await call_next(request)

            duration_ms = round((time.time() - start_time) * 1000, 2)
            if request.url.path not in ["/health", "/metrics"]:
                log_data = {
                    "method": request.method,
                    "path": str(request.url.path) + (f"?{request.url.query}" if request.url.query else ""),
                    "status_code": response.status_code,
                    "duration_ms": duration_ms,
                    "message": self._get_default_message(response.status_code),
                }

                if response.status_code >= 400:
                    error_detail = getattr(request.state, "error_detail", None)
                    if error_detail:
                        log_data["error"] = error_detail

                if response.status_code >= 500:
                    logger.error("http_request", **log_data)
                else:
                    logger.info("http_request", **log_data)

            response.headers["X-Request-ID"] = request_id
            return response

        except Exception as e:
            duration_ms = round((time.time() - start_time) * 1000, 2)

            log_data = {
                "method": request.method,
                "path": str(request.url.path) + (f"?{request.url.query}" if request.url.query else ""),
                "error": str(e),
                "error_type": type(e).__name__,
                "message": "Internal Server Error",
                "duration_ms": duration_ms,
                "status_code": 500,
            }

            logger.error("http_request_error", **log_data)

            return JSONResponse(
                status_code=500,
                content={"detail": "An internal server error occurred."},
                headers={"X-Request-ID": request_id},
            )

    def _get_default_message(self, status_code):
        """Get default message based on status code"""
        status_messages = {
            200: "Success",
            201: "Created",
            204: "No Content",
            400: "Bad Request",
            401: "Unauthorized",
            403: "Forbidden",
            404: "Not Found",
            422: "Validation Error",
        }

        if status_code in status_messages:
            return status_messages[status_code]
        elif status_code >= 500:
            return "Server Error"
        return "Unknown Status"
    