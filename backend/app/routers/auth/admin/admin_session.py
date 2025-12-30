from fastapi import APIRouter, Depends, Response, status
from app.models import NooryxAdmin
from app.core.auth.jwt import admin_cookie_transport
from app.core.auth.dependencies import get_current_admin

router = APIRouter()

@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout_admin(
    response: Response,
):
    response.delete_cookie(
        key=admin_cookie_transport.cookie_name,
        path="/",
        secure=True,
        httponly=True,
        samesite="lax"
    )
    response.delete_cookie(
        key="admin_csrf_token",
        path="/",
        secure=True,
        httponly=False,
        samesite="lax"
    )

    return


@router.get("/current")
async def get_current_admin_session(
    admin: NooryxAdmin = Depends(get_current_admin),
):
    return {
        "id": str(admin.id),
        "email": admin.email,
    }
