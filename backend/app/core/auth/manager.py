from fastapi_users import BaseUserManager, UUIDIDMixin
from fastapi_users.exceptions import InvalidPasswordException
from app.models import User, NooryxAdmin
from uuid import UUID
from app.core.config import settings

class UserManager(UUIDIDMixin, BaseUserManager[User, UUID]):
    reset_password_token_secret = settings.SECRET_KEY
    verification_token_secret = settings.SECRET_KEY

    async def validate_password(
        self,
        password: str,
        user: User | dict,
    ) -> None:
        """Validate password strength."""
        if len(password) < 8:
            raise InvalidPasswordException(
                reason="Password must be at least 8 characters long"
            )
        
        if password.lower() in ["password", "12345678", "123", "123456"]:
            raise InvalidPasswordException(
                reason="Password is too common"
            )
            
            
class AdminManager(UUIDIDMixin, BaseUserManager[NooryxAdmin, UUID]):
    reset_password_token_secret = settings.SECRET_KEY
    verification_token_secret = settings.SECRET_KEY

    async def validate_password(
        self,
        password: str,
        user: NooryxAdmin | dict,
    ) -> None:
        # Same rules, separate manager
        if len(password) < 8:
            raise InvalidPasswordException(
                reason="Password must be at least 8 characters long"
            )

        if password.lower() in ["password", "12345678", "123", "123456"]:
            raise InvalidPasswordException(reason="Password is too common")