from datetime import datetime
from pydantic import BaseModel

from app.schemas.plan import PlanResponse


class SubscribeRequest(BaseModel):
    plan_id: int


class SubscriptionResponse(BaseModel):
    id: int
    user_id: int
    plan_id: int
    category: str
    status: str
    current_period_start: datetime
    current_period_end: datetime
    cancelled_at: datetime | None
    plan: PlanResponse

    model_config = {"from_attributes": True}
