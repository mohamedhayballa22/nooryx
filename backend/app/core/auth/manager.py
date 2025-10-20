from fastapi_users import BaseUserManager, UUIDIDMixin
from app.models import User
from uuid import UUID
from app.core.config import settings

class UserManager(UUIDIDMixin, BaseUserManager[User, UUID]):
    reset_password_token_secret = settings.SECRET_KEY
    verification_token_secret = settings.SECRET_KEY
