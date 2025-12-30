from fastapi_users import FastAPIUsers
from fastapi_users.db import SQLAlchemyUserDatabase
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import User, NooryxAdmin
from app.core.db import get_session
from app.core.auth.manager import UserManager, AdminManager
from app.core.auth.jwt import auth_backend, admin_auth_backend

async def get_user_db(session: AsyncSession = Depends(get_session)):
    yield SQLAlchemyUserDatabase(session, User)

async def get_user_manager(user_db=Depends(get_user_db)):
    yield UserManager(user_db)

fastapi_users = FastAPIUsers[User, str](
    get_user_manager,
    [auth_backend],
)

# Admin authentication 
async def get_admin_db(session: AsyncSession = Depends(get_session)):
    yield SQLAlchemyUserDatabase(session, NooryxAdmin)


async def get_admin_manager(admin_db=Depends(get_admin_db)):
    yield AdminManager(admin_db)


fastapi_users_admin = FastAPIUsers[NooryxAdmin, str](
    get_admin_manager,
    [admin_auth_backend],
)

