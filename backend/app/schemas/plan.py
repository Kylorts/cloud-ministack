from datetime import datetime
from pydantic import BaseModel


class PlanResponse(BaseModel):
    id: int
    name: str
    description: str | None
    price: float
    billing_period: str
    storage_limit_bytes: int
    max_file_size_bytes: int
    bandwidth_limit_bytes: int
    bucket_limit: int
    static_site_limit: int
    access_key_limit: int

    model_config = {"from_attributes": True}
