"""
Helper untuk mencatat aktivitas user/sistem ke activity_logs.

Pemanggilan tidak boleh menggagalkan request utama — jika logging error,
cukup di-skip (best-effort).
"""
from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog, ActorType


def log_activity(
    db: Session,
    *,
    actor_user_id: int | None,
    action: str,
    description: str,
    actor_type: ActorType = ActorType.user,
    target_type: str | None = None,
    target_id: int | None = None,
    metadata: dict | None = None,
    ip_address: str | None = None,
    commit: bool = False,
) -> None:
    try:
        log = ActivityLog(
            actor_user_id=actor_user_id,
            actor_type=actor_type,
            action=action,
            description=description,
            target_type=target_type,
            target_id=target_id,
            activity_metadata=metadata,
            ip_address=ip_address,
        )
        db.add(log)
        if commit:
            db.commit()
        else:
            db.flush()
    except Exception:
        # Logging tidak boleh menggagalkan operasi utama
        db.rollback() if commit else None
