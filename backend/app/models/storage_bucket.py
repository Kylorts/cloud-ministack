import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BucketVisibility(str, enum.Enum):
    private = "private"
    public = "public"


class BucketStatus(str, enum.Enum):
    creating = "creating"
    active = "active"
    deleting = "deleting"
    deleted = "deleted"
    failed = "failed"


class StorageBucket(Base):
    __tablename__ = "storage_buckets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    subscription_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subscriptions.id"), nullable=False
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    internal_name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    visibility: Mapped[BucketVisibility] = mapped_column(
        Enum(BucketVisibility), nullable=False, default=BucketVisibility.private
    )
    status: Mapped[BucketStatus] = mapped_column(
        Enum(BucketStatus), nullable=False, default=BucketStatus.creating
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User")
    subscription: Mapped["Subscription"] = relationship("Subscription")
