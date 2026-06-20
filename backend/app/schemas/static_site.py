import re
from datetime import datetime
from pydantic import BaseModel, field_validator


class SiteCreateRequest(BaseModel):
    site_name: str

    @field_validator("site_name")
    @classmethod
    def validate_site_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 3 or len(v) > 63:
            raise ValueError("Nama situs harus antara 3–63 karakter")
        if not re.match(r"^[a-z0-9][a-z0-9\-]*[a-z0-9]$", v):
            raise ValueError(
                "Nama situs hanya boleh huruf kecil, angka, dan tanda hubung (-), "
                "tidak boleh diawali/diakhiri tanda hubung"
            )
        return v


class DeploymentResponse(BaseModel):
    id: int
    deployment_ref: str
    status: str
    file_count: int
    total_size_bytes: int
    error_message: str | None
    deployed_at: datetime | None
    created_at: datetime
    is_active: bool = False

    model_config = {"from_attributes": True}


class SiteResponse(BaseModel):
    id: int
    site_name: str
    slug: str
    domain: str | None
    status: str
    url: str = ""
    active_deployment_id: int | None
    created_at: datetime
    dormant: bool = False  # melebihi batas jumlah situs paket (terbaru) → terkunci dari deploy
    # ringkasan deployment aktif
    last_deployed_at: datetime | None = None
    total_size_bytes: int = 0
    file_count: int = 0

    model_config = {"from_attributes": True}


class SiteDetailResponse(SiteResponse):
    deployments: list[DeploymentResponse] = []
