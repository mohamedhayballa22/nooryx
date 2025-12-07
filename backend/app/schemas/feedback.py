from pydantic import BaseModel, Field, field_validator

class FeedbackCreateRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)
    category: str | None = Field(None, max_length=100)
    metadata: dict | None = Field(None, alias="metadata")
    
    @field_validator("message")
    @classmethod
    def message_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Feedback message cannot be empty")
        return v.strip()
    