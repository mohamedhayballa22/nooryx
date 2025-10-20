from fastapi import Depends
from app.models import User
from app.core.auth.users import fastapi_users

current_active_user = fastapi_users.current_user(active=True)

async def get_current_user(user: User = Depends(current_active_user)):
    return user
