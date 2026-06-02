import enum
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ObjectStatus(str, enum.Enum):
    uploading = "uploading"
    available = "available"
    deleting = "deleting"
    deleted = "deleted"
    failed = "failed"
    orphaned = "orphaned"


class StorageObject(Base):
    __tablename__ = "storage_objects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    bucket_id: Mapped[int] = mapped_column(Integer, ForeignKey("storage_buckets.id"), nullable=False)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    object_key: Mapped[str] = mapped_column(String(1024), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(127), nullable=True)
    size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    checksum: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[ObjectStatus] = mapped_column(
        Enum(ObjectStatus), nullable=False, default=ObjectStatus.uploading
    )
    uploaded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    bucket: Mapped["StorageBucket"] = relationship("StorageBucket")
    user: Mapped["User"] = relationship("User")
