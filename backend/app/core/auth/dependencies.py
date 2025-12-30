from typing import Optional
from fastapi import Depends
from app.models import User, NooryxAdmin
from app.core.auth.users import fastapi_users, fastapi_users_admin
from fastapi import Depends, HTTPException

current_active_user = fastapi_users.current_user(active=True)

async def get_current_user(user: User = Depends(current_active_user)):
    return user

current_admin = fastapi_users_admin.current_user(active=True)

async def get_current_admin(user: User = Depends(current_admin)):
    return user

async def get_current_admin_optional(
) -> Optional[NooryxAdmin]:
    """Returns admin if authenticated, None otherwise (doesn't raise 401)"""
    try:
        admin = await current_admin()
        return admin
    except HTTPException:
        return None
    