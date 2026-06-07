from datetime import datetime
from pydantic import BaseModel, field_validator
import re


class BucketCreateRequest(BaseModel):
    display_name: str
    visibility: str = "private"

    @field_validator("display_name")
    @classmethod
    def validate_display_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 63:
            raise ValueError("Nama bucket harus antara 3–63 karakter")
        if not re.match(r'^[a-z0-9][a-z0-9\-]*[a-z0-9]$', v):
            raise ValueError("Nama bucket hanya boleh huruf kecil, angka, dan tanda hubung (-), tidak boleh diawali/diakhiri tanda hubung")
        return v

    @field_validator("visibility")
    @classmethod
    def validate_visibility(cls, v: str) -> str:
        if v not in ("private", "public"):
            raise ValueError("Visibilitas harus 'private' atau 'public'")
        return v


class BucketResponse(BaseModel):
    id: int
    display_name: str
    internal_name: str
    visibility: str
    status: str
    created_at: datetime
    object_count: int = 0
    total_size_bytes: int = 0
    dormant: bool = False  # melebihi batas jumlah bucket paket (terbaru) → terkunci dari upload

    model_config = {"from_attributes": True}


class BucketDetailResponse(BucketResponse):
    subscription_id: int
    updated_at: datetime
