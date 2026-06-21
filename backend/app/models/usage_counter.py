from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UsageCounter(Base):
    __tablename__ = "usage_counters"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    subscription_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subscriptions.id"), nullable=False, unique=True
    )
    storage_used_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    bandwidth_used_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    bucket_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    object_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    static_site_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    access_key_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    period_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    last_recalculated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    subscription: Mapped["Subscription"] = relationship("Subscription")
    user: Mapped["User"] = relationship("User")
