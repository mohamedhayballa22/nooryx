from fastapi_users.authentication import JWTStrategy, AuthenticationBackend, CookieTransport
from app.core.config import settings


cookie_transport = CookieTransport(
    cookie_max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    cookie_name="access_token",
    cookie_secure=True,
    cookie_httponly=True,
)

def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(
        secret=settings.SECRET_KEY,
        lifetime_seconds=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        token_audience=["nooryx_users"],
    )

auth_backend = AuthenticationBackend(
    name="jwt",
    transport=cookie_transport,
    get_strategy=get_jwt_strategy,
)
