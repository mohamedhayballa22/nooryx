import secrets
import warnings
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def parse_cors(v: str) -> list[str]:
    """
    Helper function to parse a comma-separated string of CORS origins into a list of strings.

    Example: `BACKEND_CORS_ORIGINS=http://localhost:4200,http://localhost:3000`
    """
    if not v:
        return []

    urls = [url.strip() for url in v.split(",") if url.strip()]

    # Validate each URL but return as strings
    validated_urls = []
    for url in urls:
        # Basic checks - Pydantic's AnyUrl adds a trailing slash
        if not (url.startswith("http://") or url.startswith("https://")):
            raise ValueError(f"Invalid CORS origin: {url}")
        validated_urls.append(url)

    return validated_urls


class Settings(BaseSettings):
    """
    Main settings class for the application.
    It reads environment variables from a .env file and validates their types.
    """

    model_config = SettingsConfigDict(
        # Top level .env file (one level above ./backend/)
        env_file="../.env",
        env_ignore_empty=True,
        extra="ignore",
    )

    PROJECT_NAME: str = "Nooryx"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    HASHING_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    ENVIRONMENT: Literal["dev", "prod", "test"] = "dev"
    DATABASE_URL: str
    REDIS_URL: str
    BACKEND_CORS_ORIGINS: str = ""
    FIRST_USER_EMAIL: str = ""
    FIRST_USER_PASSWORD: str = ""
    INVITATION_TOKEN_EXPIRE_HOURS: int = 72
    ALGORITHM: str = "HS256"
    REFRESH_TOKEN_EXPIRE_DAYS: int = 14
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: str = "587"
    SMTP_USERNAME: str
    SMTP_PASSWORD: str
    FROM_EMAIL: str
    FRONTEND_URL: str = "http://nooryx.com"
    SUPPORT_EMAIL: str = "support@nooryx.com"


    @model_validator(mode="after")
    def parse_cors_origins(self) -> "Settings":
        if isinstance(self.BACKEND_CORS_ORIGINS, str):
            self.BACKEND_CORS_ORIGINS = parse_cors(self.BACKEND_CORS_ORIGINS)
        return self

    @model_validator(mode="after")
    def _check_secret_key_for_prod(self) -> "Settings":
        """
        Warns if the default generated SECRET_KEY is used in a production environment.
        """
        if self.ENVIRONMENT == "prod" and self.SECRET_KEY == secrets.token_urlsafe(32):
            warnings.warn(
                "You are running in 'prod' environment without a persistent SECRET_KEY set in your .env file. "
                "This will cause tokens to be invalidated on every app restart. "
                "Please generate a key and set it as SECRET_KEY.",
                stacklevel=1,
            )
        if self.SECRET_KEY == "changethis":
            warnings.warn(
                'The SECRET_KEY is "changethis". For security, please generate a real key.'
            )
        return self


settings = Settings()
