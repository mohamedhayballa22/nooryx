from fastapi_users import FastAPIUsers
from fastapi_users.db import SQLAlchemyUserDatabase
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.models import User
from app.core.db import get_session
from app.core.auth.manager import UserManager
from app.core.auth.jwt import auth_backend

async def get_user_db(session: AsyncSession = Depends(get_session)):
    yield SQLAlchemyUserDatabase(session, User)

async def get_user_manager(user_db=Depends(get_user_db)):
    yield UserManager(user_db)

fastapi_users = FastAPIUsers[User, str](
    get_user_manager,
    [auth_backend],
)
