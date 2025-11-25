from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi_users import BaseUserManager
from fastapi_users.exceptions import UserAlreadyExists
from app.core.auth.users import get_user_manager
from app.core.db import get_session, async_session_maker
from app.models import Organization, User, Subscription
from app.core.auth.dependencies import get_current_user
from app.core.auth.schemas import (
    OrgRegisterRequest,
    OrgRegisterResponse,
    UserCreate,
    InvitationAcceptRequest,
    InvitationAcceptResponse, 
    InvitationCreateRequest, 
)
from app.core.auth.manager import UserManager
from app.core.auth.users import get_user_db
from app.core.auth.invitations import create_invitation_token, decode_invitation_token
from uuid import UUID, uuid4
from app.services.emails.invitation import send_invitation_email, validate_invitation_email
from app.services.alert_service import AlertService
from app.core.logger_config import logger


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


@router.post("/invite", status_code=status.HTTP_204_NO_CONTENT)
async def invite_user_to_org(
    payload: InvitationCreateRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
    user = Depends(get_current_user),
):
    """Send an invitation email to join the organization."""
    org = await session.scalar(select(Organization).where(Organization.org_id == user.org_id))
    if not org:
        raise HTTPException(status_code=400, detail="Invalid organization or permission denied.")
    
    # Validate email synchronously before queuing
    normalized_email = validate_invitation_email(payload.email, user.email)

    # Check if the invited user already exists
    existing_user = await session.scalar(
        select(User.id)
        .where(User.org_id == user.org_id, User.email == payload.email)
        .limit(1)
    )

    if existing_user:
        raise HTTPException(status_code=400, detail="User is already a member in this organization.")
    
    token, expires_at = create_invitation_token(user.org_id, org.name, normalized_email)

    # Queue email sending in background
    background_tasks.add_task(
        send_invitation_email,
        to_email=normalized_email,
        org_name=org.name,
        inviter_name=user.first_name + " " + user.last_name,
        token=token,
        expires_at=expires_at,
    )
    
    return None


# Accept invitation (signup)
@router.post("/join", response_model=InvitationAcceptResponse, status_code=status.HTTP_201_CREATED)
async def accept_invitation(
    payload: InvitationAcceptRequest,
    request: Request,
    background_tasks: BackgroundTasks,
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

    # Create team member alert in background
    background_tasks.add_task(
        create_team_member_alert_task,
        org_id=org_id,
        user_id=user.id,
        first_name=user.first_name,
        last_name=user.last_name,
        email=user.email,
        role=user.role
    )

    return InvitationAcceptResponse(email=user.email, org_name=org.name)


async def create_team_member_alert_task(
    org_id: UUID,
    user_id: UUID,
    first_name: str,
    last_name: str,
    email: str,
    role: str
):
    """Background task to create team member joined alert."""
    async with async_session_maker() as session:
        try:
            alert_service = AlertService(session, org_id)
            await alert_service.create_team_member_alert(
                user_id=user_id,
                first_name=first_name,
                last_name=last_name,
                email=email,
                role=role
            )
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Failed to create team member alert: {e}", exc_info=True)
