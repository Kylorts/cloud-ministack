import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class KeyPermission(str, enum.Enum):
    full = "full"
    read_only = "read_only"


class KeyStatus(str, enum.Enum):
    active = "active"
    disabled = "disabled"
    revoked = "revoked"
    expired = "expired"


class AccessKey(Base):
    __tablename__ = "access_keys"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    subscription_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("subscriptions.id"), nullable=False, index=True
    )
    category: Mapped[str] = mapped_column(String(20), nullable=False, default="storage", index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    access_key_id: Mapped[str] = mapped_column(String(128), nullable=False, unique=True)
    secret_key_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    secret_key_last4: Mapped[str] = mapped_column(String(8), nullable=False)
    permission: Mapped[KeyPermission] = mapped_column(
        Enum(KeyPermission), nullable=False, default=KeyPermission.full
    )
    status: Mapped[KeyStatus] = mapped_column(
        Enum(KeyStatus), nullable=False, default=KeyStatus.active
    )
    # IAM policy yang dilekatkan (opsional). Bila ada, policy ini yang menentukan
    # otorisasi di proxy /s3 (menggantikan enum permission).
    policy_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("iam_policies.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    user: Mapped["User"] = relationship("User")
    subscription: Mapped["Subscription"] = relationship("Subscription")
    policy: Mapped["IamPolicy | None"] = relationship("IamPolicy")

    @property
    def policy_name(self) -> str | None:
        return self.policy.name if self.policy else None
