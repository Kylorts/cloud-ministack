from pydantic import BaseModel, field_validator


class PlanResponse(BaseModel):
    id: int
    name: str
    description: str | None
    category: str
    price: float
    billing_period: str
    storage_limit_bytes: int
    max_file_size_bytes: int
    bandwidth_limit_bytes: int
    bucket_limit: int
    static_site_limit: int
    access_key_limit: int

    model_config = {"from_attributes": True}

    @field_validator("category", "billing_period", mode="before")
    @classmethod
    def enum_to_str(cls, v):
        return v.value if hasattr(v, "value") else v
