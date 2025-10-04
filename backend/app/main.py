from fastapi import FastAPI
from fastapi_pagination import add_pagination
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute
from starlette.requests import Request
from starlette.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.exceptions import RequestValidationError

from app.core.config import settings
from app.core.logger_config import logger
from app.middleware.rate_limit import RateLimitMiddleware
from app.middleware.correlation import CorrelationIdMiddleware
from app.routers import actions, inventory, transactions


def custom_generate_unique_id(route: APIRoute) -> str:
    if route.tags:
        tag = route.tags[0]
    else:
        tag = route.name

    return f"{tag}-{route.name}"


app = FastAPI(
    title="Nooryx",
    generate_unique_id_function=custom_generate_unique_id,
    debug=settings.ENVIRONMENT == "dev",
)

# Correlation/Request tracking
app.add_middleware(CorrelationIdMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting
app.add_middleware(
    RateLimitMiddleware,
    default_capacity=25,
    default_rate=5,
)

# Include Routers
app.include_router(actions.router, tags=["Stock Actions"])
app.include_router(inventory.router, tags=["Inventory"])
app.include_router(transactions.router, tags=["Transactions"])

add_pagination(app)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for any unhandled exceptions."""
    logger.error(
        "unhandled_exception",
        method=request.method,
        path=request.url.path,
        error=str(exc),
        error_type=type(exc).__name__,
    )
    return JSONResponse(
        status_code=500, content={"detail": "An internal server error occurred."}
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions (400, 404, etc.)"""
    request.state.error_detail = exc.detail
    return JSONResponse(
        status_code=exc.status_code, content={"error": {"detail": exc.detail}}
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Transform Pydantic validation errors into a consistent, minimal error envelope."""
    errors = []
    for err in exc.errors():
        field = ".".join(map(str, err.get("loc", [])))
        if field.startswith("body."):
            field = field[5:]

        errors.append(
            {
                "field": field,
                "error": err.get("msg"),
            }
        )
    request.state.error_detail = errors
    
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "type": "validation_error",
                "message": "Invalid request payload",
                "details": errors,
            }
        },
    )
