import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SiteStatus(str, enum.Enum):
    active = "active"
    suspended = "suspended"
    deleted = "deleted"
    failed = "failed"


class StaticSite(Base):
    __tablename__ = "static_sites"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subscription_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subscriptions.id"), nullable=False
    )
    site_name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[SiteStatus] = mapped_column(
        Enum(SiteStatus), nullable=False, default=SiteStatus.active
    )
    active_deployment_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
    suspended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User")
