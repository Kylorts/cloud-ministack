from datetime import datetime
from pydantic import BaseModel, field_validator


class AccessKeyCreateRequest(BaseModel):
    name: str | None = None
    permission: str = "full"

    @field_validator("permission")
    @classmethod
    def validate_permission(cls, v: str) -> str:
        if v not in ("full", "read_only"):
            raise ValueError("Izin harus 'full' atau 'read_only'")
        return v


def _enum_str(v):
    return v.value if hasattr(v, "value") else v


class AccessKeyResponse(BaseModel):
    id: int
    name: str | None
    access_key_id: str
    secret_key_last4: str
    permission: str
    status: str
    category: str
    created_at: datetime
    last_used_at: datetime | None

    model_config = {"from_attributes": True}

    @field_validator("permission", "status", "category", mode="before")
    @classmethod
    def to_str(cls, v):
        return _enum_str(v)


class AccessKeyCreatedResponse(AccessKeyResponse):
    """Hanya saat pembuatan — berisi secret plaintext SEKALI."""
    secret_key: str
    mc_command: str
