"""
Helper untuk mencatat aktivitas user/sistem ke activity_logs.

Pemanggilan tidak boleh menggagalkan request utama — jika logging error,
cukup di-skip (best-effort).
"""
from contextvars import ContextVar

from sqlalchemy.orm import Session

from app.models.activity_log import ActivityLog, ActorType

# Diisi per-request oleh middleware (lihat main.py). log_activity memakainya
# sebagai IP default untuk aksi user/admin, sehingga setiap endpoint tak perlu
# meneruskan request secara manual. Aksi sistem dibiarkan tanpa IP.
request_ip: ContextVar[str | None] = ContextVar("request_ip", default=None)


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
    # IP otomatis dari konteks request untuk aksi user/admin; aksi sistem tetap kosong.
    if ip_address is None and actor_type != ActorType.system:
        ip_address = request_ip.get()
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
