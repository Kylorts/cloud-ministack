import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SubscriptionStatus(str, enum.Enum):
    active = "active"
    pending_payment = "pending_payment"
    past_due = "past_due"
    over_quota = "over_quota"
    suspended = "suspended"
    cancelled = "cancelled"
    expired = "expired"
    terminated = "terminated"


# Status yang dianggap "menempati slot" — user tidak boleh punya 2 sekaligus
ACTIVE_LIKE_STATUSES = [
    SubscriptionStatus.active,
    SubscriptionStatus.pending_payment,
    SubscriptionStatus.past_due,
    SubscriptionStatus.over_quota,
    SubscriptionStatus.suspended,
]


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False, index=True
    )
    plan_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("service_plans.id"), nullable=False
    )
    # Downgrade terjadwal: paket tujuan yang berlaku di current_period_end
    scheduled_plan_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("service_plans.id"), nullable=True
    )
    category: Mapped[str] = mapped_column(
        String(20), nullable=False, default="storage", index=True
    )
    status: Mapped[SubscriptionStatus] = mapped_column(
        Enum(SubscriptionStatus), nullable=False, default=SubscriptionStatus.active
    )
    current_period_start: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    current_period_end: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    grace_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    over_quota_since: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    user: Mapped["User"] = relationship(back_populates="subscription")
    plan: Mapped["ServicePlan"] = relationship(back_populates="subscriptions", foreign_keys=[plan_id])
    scheduled_plan: Mapped["ServicePlan | None"] = relationship(
        "ServicePlan", foreign_keys=[scheduled_plan_id]
    )

    @property
    def scheduled_plan_name(self) -> str | None:
        return self.scheduled_plan.name if self.scheduled_plan else None
