import enum
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DeploymentStatus(str, enum.Enum):
    pending = "pending"
    deploying = "deploying"
    success = "success"
    failed = "failed"
    rolled_back = "rolled_back"


class StaticSiteDeployment(Base):
    __tablename__ = "static_site_deployments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    site_id: Mapped[int] = mapped_column(Integer, ForeignKey("static_sites.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False)
    source_bucket_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("storage_buckets.id"), nullable=True
    )
    deployment_ref: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    deployment_path: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[DeploymentStatus] = mapped_column(
        Enum(DeploymentStatus), nullable=False, default=DeploymentStatus.pending
    )
    file_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    deployed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now()
    )

    site: Mapped["StaticSite"] = relationship("StaticSite")
