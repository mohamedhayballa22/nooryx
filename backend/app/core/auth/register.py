from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi_users import BaseUserManager
from fastapi_users.exceptions import UserAlreadyExists
from app.core.auth.users import get_user_manager
from app.core.db import get_session
from app.models import Organization, User, Subscription
from app.core.auth.dependencies import get_current_user
from app.core.auth.schemas import (
    OrgRegisterRequest,
    OrgRegisterResponse,
    UserCreate,
    InvitationAcceptRequest,
    InvitationAcceptResponse, 
    InvitationCreateRequest, 
    InvitationCreateResponse,
)
from app.core.auth.manager import UserManager
from app.core.auth.users import get_user_db
from app.core.auth.invitations import create_invitation_token, decode_invitation_token
from uuid import UUID, uuid4


router = APIRouter()

@router.post("/register-new-org", response_model=OrgRegisterResponse, status_code=status.HTTP_201_CREATED)
async def register_new_org(
    payload: OrgRegisterRequest,
    session: AsyncSession = Depends(get_session),
    user_db=Depends(get_user_db),
):
    """Creates a new organization, its initial subscription, and first user atomically."""
    org_data = payload.org
    user_data = payload.user

    # Check if org name already exists
    existing_org = await session.scalar(
        select(Organization).where(Organization.name == org_data.name)
    )
    if existing_org:
        raise HTTPException(status_code=400, detail="Organization name already exists")

    # Create Organization
    new_org = Organization(
        org_id=uuid4(),
        name=org_data.name,
        currency=org_data.currency,
        valuation_method=org_data.valuation_method,
    )
    session.add(new_org)
    await session.flush()  # ensures org_id is available

    # Create Subscription (default plan)
    new_subscription = Subscription(
        org_id=new_org.org_id,
    )
    session.add(new_subscription)
    await session.flush()

    # Create the first user tied to the org
    user_manager = UserManager(user_db)
    user_data.org_id = new_org.org_id
    try:
        user = await user_manager.create(user_data, safe=True)
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    await session.commit()

    return OrgRegisterResponse(
        org_id=new_org.org_id,
        user_id=user.id,
        email=user.email,
        org_name=new_org.name,
    )


# Issue invitation link
@router.post("/invite", response_model=InvitationCreateResponse, status_code=status.HTTP_201_CREATED)
async def invite_user_to_org(
    payload: InvitationCreateRequest,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user),
):
    """Generate a signed invitation link for a user to join the organization."""
    org = await session.scalar(select(Organization).where(Organization.org_id == user.org_id))
    if not org:
        raise HTTPException(status_code=400, detail="Invalid organization or permission denied.")

    token, expires_at = create_invitation_token(user.org_id, org.name, payload.email)

    return InvitationCreateResponse(token=token, expires_at=expires_at)


# Accept invitation (signup)
@router.post("/join", response_model=InvitationAcceptResponse, status_code=status.HTTP_201_CREATED)
async def accept_invitation(
    payload: InvitationAcceptRequest,
    request: Request,
    user_manager: BaseUserManager[User, UUID] = Depends(get_user_manager),
    session: AsyncSession = Depends(get_session),
):
    """Accept an invitation using a token and create the user account."""
    try:
        data = decode_invitation_token(payload.token)
        org_id = UUID(data["org_id"])
        email = data["email"]
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation.")

    org = await session.scalar(select(Organization).where(Organization.org_id == org_id))
    if not org:
        raise HTTPException(status_code=400, detail="Invalid or expired invitation.")

    user_create = UserCreate(
        email=email,
        password=payload.password,
        org_id=org_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
    )

    try:
        user = await user_manager.create(user_create, safe=True, request=request)
    except UserAlreadyExists:
        raise HTTPException(status_code=400, detail="User already registered or invitation invalid.")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Registration failed: {str(e)}")

    return InvitationAcceptResponse(email=user.email, org_name=org.name)
