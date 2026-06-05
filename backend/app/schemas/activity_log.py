from datetime import datetime
from pydantic import BaseModel, field_validator


class ActivityLogResponse(BaseModel):
    id: int
    actor_type: str
    action: str
    target_type: str | None
    target_id: int | None
    description: str
    ip_address: str | None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("actor_type", mode="before")
    @classmethod
    def enum_to_str(cls, v):
        return v.value if hasattr(v, "value") else v
