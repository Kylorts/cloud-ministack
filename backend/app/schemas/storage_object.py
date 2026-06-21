from datetime import datetime
from pydantic import BaseModel


class ObjectResponse(BaseModel):
    id: int
    bucket_id: int
    object_key: str
    filename: str
    content_type: str | None
    size_bytes: int
    status: str
    uploaded_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}
