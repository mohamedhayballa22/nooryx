from pydantic import BaseModel, EmailStr


class TeamMember(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    role: str | None = None

    model_config = {
        "from_attributes": True
    }
