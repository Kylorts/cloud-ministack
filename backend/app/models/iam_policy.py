import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PolicyType(str, enum.Enum):
    system = "system"
    custom = "custom"


class IamPolicy(Base):
    __tablename__ = "iam_policies"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    policy_type: Mapped[PolicyType] = mapped_column(
        Enum(PolicyType), nullable=False, default=PolicyType.custom
    )
    document: Mapped[str] = mapped_column(Text, nullable=False)  # dokumen JSON (string)
    created_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
