from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.auth.dependencies import get_current_user
from app.core.auth.tenant_dependencies import get_tenant_session
from app.models import User
from app.schemas.team import TeamMember
from typing import List


router = APIRouter()


@router.get("/members", response_model=List[TeamMember])
async def list_team_members(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_tenant_session),
):
    """
    Get all team members in the current user's organization, excluding the current user.
    
    Returns a list of team members with their basic information and role.
    """
    stmt = (
        select(User)
        .where(
            User.id != current_user.id
        )
        .order_by(User.first_name, User.last_name)
    )
    
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    return [
        TeamMember(
            first_name=user.first_name,
            last_name=user.last_name,
            email=user.email,
            role=user.role
        )
        for user in users
    ]
