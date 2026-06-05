import enum
from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Enum, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class BillingPeriod(str, enum.Enum):
    monthly = "monthly"


class PlanCategory(str, enum.Enum):
    storage = "storage"
    hosting = "hosting"


class ServicePlan(Base):
    __tablename__ = "service_plans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[PlanCategory] = mapped_column(
        Enum(PlanCategory), nullable=False, default=PlanCategory.storage
    )
    price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    billing_period: Mapped[BillingPeriod] = mapped_column(
        Enum(BillingPeriod), nullable=False, default=BillingPeriod.monthly
    )
    storage_limit_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    max_file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    bandwidth_limit_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    bucket_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    static_site_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    access_key_limit: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )

    subscriptions: Mapped[list["Subscription"]] = relationship(back_populates="plan")
