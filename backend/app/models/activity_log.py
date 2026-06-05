import enum
from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ActorType(str, enum.Enum):
    user = "user"
    admin = "admin"
    system = "system"
    midtrans = "midtrans"


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    actor_user_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True, index=True
    )
    actor_type: Mapped[ActorType] = mapped_column(
        Enum(ActorType), nullable=False, default=ActorType.user
    )
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    target_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    target_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    activity_metadata: Mapped[dict | None] = mapped_column("metadata", JSON, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    actor: Mapped["User"] = relationship("User")
