import json
import os
import time
import urllib.request
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.config import settings
from app.core import usage as usage_helper
from app.core.activity import log_activity
from app.core.deps import get_admin_user, get_db
from app.database import get_db as _get_db  # noqa
from app.models.access_key import AccessKey, KeyStatus
from app.models.activity_log import ActivityLog, ActorType
from app.models.iam_policy import IamPolicy, PolicyType
from app.models.plan import PlanCategory, ServicePlan
from app.models.static_site import SiteStatus, StaticSite
from app.models.static_site_deployment import StaticSiteDeployment
from app.models.storage_bucket import BucketStatus, StorageBucket
from app.models.storage_object import ObjectStatus, StorageObject
from app.models.subscription import ACTIVE_LIKE_STATUSES, Subscription, SubscriptionStatus
from app.models.usage_counter import UsageCounter
from app.models.user import User, UserRole, UserStatus
from app.schemas.admin import (
    AdminAccessKeyItem, AdminActivityItem, AdminAuditItem, AdminBucketDetail, AdminBucketObject,
    AdminBucketRow, AdminLogItem, AdminLogPage, AdminMonitoring, AdminPlanChange, AdminPlanItem,
    AdminPlanWrite, AdminResourceItem, AdminSiteRow, AdminSubscriptionDetail, AdminSubscriptionItem,
    AdminSubHistoryItem, AdminTopUser, AdminTransactionDetail, AdminTransactionItem, AdminUserDetail, AdminUserItem, AdminUserPackage,
    AdminUserResource, ChangePlanRequest, IamPolicyItem, IamPolicyWrite, Page, ServiceStatus, StatsResponse,
    StatusUpdateRequest,
)

router = APIRouter(prefix="/admin", tags=["admin"])

PLATFORM_STORAGE_CAP = 1024 ** 4  # 1 TB (simulasi kapasitas platform)

# Waktu proses backend mulai → untuk uptime nyata.
_BOOT_MONO = time.monotonic()


def _check_db(db: Session) -> bool:
    try:
        db.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def _check_ministack() -> bool:
    try:
        urllib.request.urlopen(settings.MINISTACK_ENDPOINT + "/_ministack/health", timeout=2)
        return True
    except Exception:
        return False


def _platform_health(db: Session) -> dict:
    """Status NYATA service inti (tanpa Mailpit) + uptime & load proses backend."""
    services = [
        ("Backend API", True),                 # endpoint ini merespons → backend up
        ("Database (MySQL)", _check_db(db)),
        ("MiniStack (S3)", _check_ministack()),
    ]
    active = sum(1 for _, up in services if up)
    try:
        load1 = os.getloadavg()[0]
        cores = os.cpu_count() or 1
        load_pct = min(round(load1 / cores * 100), 100)
    except (OSError, AttributeError):
        load_pct = 0
    return {
        "services": services,
        "active": active,
        "total": len(services),
        "healthy": active == len(services),
        "uptime_seconds": int(time.monotonic() - _BOOT_MONO),
        "load_percent": load_pct,
    }


def _owner_storage_limit(db: Session, user_id: int) -> int:
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user_id,
            Subscription.category == "storage",
            Subscription.status.in_(ACTIVE_LIKE_STATUSES),
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )
    return sub.plan.storage_limit_bytes if sub else 0


def _owner_hosting_limit(db: Session, user_id: int) -> int:
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user_id,
            Subscription.category == "hosting",
            Subscription.status.in_(ACTIVE_LIKE_STATUSES),
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )
    return sub.plan.storage_limit_bytes if sub else 0  # limit = total build hosting


@router.get("/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    active_clients = db.query(User).filter(
        User.role == UserRole.user, User.status == UserStatus.active
    ).count()
    active_subscriptions = db.query(Subscription).filter(
        Subscription.status.in_(ACTIVE_LIKE_STATUSES)
    ).count()

    month_start = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    new_clients = db.query(User).filter(
        User.role == UserRole.user, User.created_at >= month_start
    ).count()

    object_bytes = int(
        db.query(func.coalesce(func.sum(StorageObject.size_bytes), 0))
        .filter(StorageObject.status == ObjectStatus.available)
        .scalar()
    )
    hosting_bytes = int(
        db.query(func.coalesce(func.sum(StaticSiteDeployment.total_size_bytes), 0))
        .join(StaticSite, StaticSite.active_deployment_id == StaticSiteDeployment.id)
        .filter(StaticSite.status == SiteStatus.active)
        .scalar()
    )

    health = _platform_health(db)
    return StatsResponse(
        uptime_seconds=health["uptime_seconds"],
        services_healthy=health["active"],
        services_total=health["total"],
        system_healthy=health["healthy"],
        active_clients=active_clients,
        active_subscriptions=active_subscriptions,
        new_clients_this_month=new_clients,
        storage_used_bytes=object_bytes + hosting_bytes,
        storage_cap_bytes=PLATFORM_STORAGE_CAP,
        object_storage_bytes=object_bytes,
        hosting_build_bytes=hosting_bytes,
    )


@router.get("/resources", response_model=list[AdminResourceItem])
def list_resources(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    items: list[AdminResourceItem] = []

    buckets = (
        db.query(StorageBucket)
        .filter(StorageBucket.status == BucketStatus.active)
        .order_by(StorageBucket.created_at.desc())
        .limit(15)
        .all()
    )
    for b in buckets:
        owner = db.get(User, b.user_id)
        used = int(
            db.query(func.coalesce(func.sum(StorageObject.size_bytes), 0))
            .filter(StorageObject.bucket_id == b.id, StorageObject.status == ObjectStatus.available)
            .scalar()
        )
        limit_b = _owner_storage_limit(db, b.user_id)
        util = round(used / limit_b * 100) if limit_b else 0
        items.append(AdminResourceItem(
            id=b.id, name=b.display_name, owner_name=owner.name if owner else "-",
            type="S3-Compat", utilization_percent=min(util, 100), status="active",
        ))

    sites = (
        db.query(StaticSite)
        .filter(StaticSite.status == SiteStatus.active)
        .order_by(StaticSite.created_at.desc())
        .limit(10)
        .all()
    )
    for s in sites:
        owner = db.get(User, s.user_id)
        # Ukuran build situs = total_size_bytes deployment aktif.
        build = 0
        if s.active_deployment_id:
            build = int(
                db.query(func.coalesce(func.sum(StaticSiteDeployment.total_size_bytes), 0))
                .filter(StaticSiteDeployment.id == s.active_deployment_id)
                .scalar()
            )
        limit_h = _owner_hosting_limit(db, s.user_id)
        util = round(build / limit_h * 100) if limit_h else 0
        items.append(AdminResourceItem(
            id=s.id, name=s.site_name, owner_name=owner.name if owner else "-",
            type="Static", utilization_percent=min(util, 100), status="active",
        ))

    return items


@router.get("/access-keys", response_model=Page[AdminAccessKeyItem])
def list_access_keys(q: str = Query(""), page: int = Query(1), page_size: int = Query(15),
                     db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    keys = db.query(AccessKey).order_by(AccessKey.created_at.desc()).all()
    matched = []
    for k in keys:
        owner = db.get(User, k.user_id)
        owner_name = owner.name if owner else "-"
        if q and q.lower() not in k.access_key_id.lower() and q.lower() not in owner_name.lower():
            continue
        matched.append((k, owner_name))
    total = len(matched)
    start = max(page - 1, 0) * page_size
    out: list[AdminAccessKeyItem] = []
    for k, owner_name in matched[start:start + page_size]:
        out.append(AdminAccessKeyItem(
            id=k.id, access_key_id=k.access_key_id,
            owner_name=owner_name,
            status=k.status.value if hasattr(k.status, "value") else k.status,
            category=k.category,
            permission=k.permission.value if hasattr(k.permission, "value") else k.permission,
            policy_name=k.policy_name,
            last_used_at=k.last_used_at,
            created_at=k.created_at,
        ))
    return Page[AdminAccessKeyItem](items=out, total=total)


# ════════ Helpers ════════

def _active_sub(db: Session, user_id: int, category: str):
    return (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user_id,
            Subscription.category == category,
            Subscription.status.in_(ACTIVE_LIKE_STATUSES),
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )


def _user_storage_used(db: Session, user_id: int) -> int:
    return int(
        db.query(func.coalesce(func.sum(StorageObject.size_bytes), 0))
        .join(StorageBucket, StorageObject.bucket_id == StorageBucket.id)
        .filter(StorageBucket.user_id == user_id, StorageObject.status == ObjectStatus.available)
        .scalar()
    )


# ════════ Fase B: Manajemen Pengguna ════════

@router.get("/users", response_model=Page[AdminUserItem])
def list_users(q: str = Query(""), page: int = Query(1), page_size: int = Query(15),
               db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    from sqlalchemy import or_
    # Manajemen Pengguna = daftar KLIEN; akun admin tidak ditampilkan.
    base = db.query(User).filter(User.role == UserRole.user)
    if q:
        like = f"%{q}%"
        base = base.filter(or_(User.name.like(like), User.email.like(like)))
    base = base.order_by(User.created_at.desc())
    total = base.count()
    users = base.offset(max(page - 1, 0) * page_size).limit(page_size).all()
    out = []
    for u in users:
        storage = _active_sub(db, u.id, "storage")
        hosting = _active_sub(db, u.id, "hosting")
        packages = [
            AdminUserPackage(category=cat, plan_name=s.plan.name, status=s.status.value)
            for s, cat in ((storage, "storage"), (hosting, "hosting")) if s
        ]
        primary = storage or hosting
        out.append(AdminUserItem(
            id=u.id, name=u.name, email=u.email,
            role=u.role.value, status=u.status.value,
            plan_name=primary.plan.name if primary else None,
            packages=packages, created_at=u.created_at,
        ))
    return Page[AdminUserItem](items=out, total=total)


@router.get("/users/{user_id}", response_model=AdminUserDetail)
def user_detail(user_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    u = db.get(User, user_id)
    if not u or u.role == UserRole.admin:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")

    storage_sub = _active_sub(db, u.id, "storage")
    hosting_sub = _active_sub(db, u.id, "hosting")

    bucket_count = db.query(StorageBucket).filter(
        StorageBucket.user_id == u.id, StorageBucket.status == BucketStatus.active).count()
    site_count = db.query(StaticSite).filter(
        StaticSite.user_id == u.id, StaticSite.status == SiteStatus.active).count()
    key_count = db.query(AccessKey).filter(
        AccessKey.user_id == u.id, AccessKey.status != KeyStatus.revoked).count()

    hosting_counter = None
    if hosting_sub:
        hosting_counter = db.query(UsageCounter).filter(
            UsageCounter.subscription_id == hosting_sub.id).first()

    resources = []
    for b in db.query(StorageBucket).filter(
            StorageBucket.user_id == u.id, StorageBucket.status == BucketStatus.active).all():
        resources.append(AdminUserResource(id=b.id, name=b.display_name, type="Object Storage", status="active"))
    for s in db.query(StaticSite).filter(
            StaticSite.user_id == u.id, StaticSite.status == SiteStatus.active).all():
        resources.append(AdminUserResource(id=s.id, name=s.site_name, type="Static Hosting", status="active"))

    acts = (
        db.query(ActivityLog)
        .filter(ActivityLog.actor_user_id == u.id)
        .order_by(ActivityLog.created_at.desc()).limit(10).all()
    )
    activities = [AdminActivityItem(
        id=a.id, action=a.action, description=a.description,
        ip_address=a.ip_address, created_at=a.created_at) for a in acts]

    return AdminUserDetail(
        id=u.id, name=u.name, email=u.email, role=u.role.value, status=u.status.value,
        created_at=u.created_at,
        bucket_count=bucket_count, bucket_limit=storage_sub.plan.bucket_limit if storage_sub else 0,
        site_count=site_count, site_limit=hosting_sub.plan.static_site_limit if hosting_sub else 0,
        access_key_count=key_count,
        access_key_limit=(storage_sub.plan.access_key_limit if storage_sub else
                          (hosting_sub.plan.access_key_limit if hosting_sub else 0)),
        storage_used_bytes=_user_storage_used(db, u.id),
        storage_limit_bytes=storage_sub.plan.storage_limit_bytes if storage_sub else 0,
        bandwidth_used_bytes=hosting_counter.bandwidth_used_bytes if hosting_counter else 0,
        bandwidth_limit_bytes=hosting_sub.plan.bandwidth_limit_bytes if hosting_sub else 0,
        storage_plan_name=storage_sub.plan.name if storage_sub else None,
        hosting_plan_name=hosting_sub.plan.name if hosting_sub else None,
        resources=resources, activities=activities,
    )


@router.post("/users/{user_id}/status", status_code=200)
def set_user_status(user_id: int, body: StatusUpdateRequest,
                    db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    if u.id == admin.id:
        raise HTTPException(status_code=400, detail="Tidak bisa mengubah status akun sendiri.")
    if body.status not in ("active", "suspended"):
        raise HTTPException(status_code=400, detail="Status harus active atau suspended.")
    u.status = UserStatus(body.status)
    log_activity(
        db, actor_user_id=admin.id, actor_type=ActorType.admin,
        action="USER_STATUS_CHANGED",
        description=f"Admin mengubah status {u.email} menjadi {body.status}",
        target_type="USER", target_id=u.id,
    )
    db.commit()
    return {"message": f"Status pengguna diubah menjadi {body.status}."}


# ════════ Fase C: Manajemen Paket — DIHAPUS ════════
# Admin TIDAK punya wewenang apa pun atas katalog paket: tidak ada list/create/
# update/delete dan tidak ada force-change-plan. Harga & limit paket = konfigurasi
# tingkat-sistem (seed/kode). Keputusan keamanan: mencegah penyalahgunaan global
# (insider threat) — admin nakal tak bisa mengubah kuota/harga seluruh pelanggan
# maupun memindah paket seseorang.


# ════════ Fase D: Langganan ════════

@router.get("/subscriptions", response_model=Page[AdminSubscriptionItem])
def list_subscriptions(status_f: str = Query("all", alias="status"),
                       q: str = Query(""), page: int = Query(1), page_size: int = Query(15),
                       db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    query = db.query(Subscription)
    if status_f == "active":
        query = query.filter(Subscription.status == SubscriptionStatus.active)
    elif status_f == "over_quota":
        query = query.filter(Subscription.status == SubscriptionStatus.over_quota)
    elif status_f == "past_due":
        query = query.filter(Subscription.status == SubscriptionStatus.past_due)
    else:
        query = query.filter(Subscription.status.in_(ACTIVE_LIKE_STATUSES))
    subs = query.order_by(Subscription.created_at.desc()).all()
    # Filter cari (nama klien / paket / kategori) lalu paginasi.
    rows = []
    for s in subs:
        owner = db.get(User, s.user_id)
        client_name = owner.name if owner else "-"
        if q:
            ql = q.lower()
            if ql not in client_name.lower() and ql not in s.plan.name.lower() and ql not in s.category.lower():
                continue
        rows.append(AdminSubscriptionItem(
            id=s.id, client_name=client_name, plan_name=s.plan.name,
            category=s.category, status=s.status.value,
            current_period_end=s.current_period_end,
            scheduled_change=(f"Downgrade → {s.scheduled_plan.name}" if s.scheduled_plan_id else None),
        ))
    total = len(rows)
    start = max(page - 1, 0) * page_size
    return Page[AdminSubscriptionItem](items=rows[start:start + page_size], total=total)


@router.get("/subscriptions/{sub_id}", response_model=AdminSubscriptionDetail)
def subscription_detail(sub_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    s = db.get(Subscription, sub_id)
    if not s:
        raise HTTPException(status_code=404, detail="Langganan tidak ditemukan")
    owner = db.get(User, s.user_id)
    counter = db.query(UsageCounter).filter(UsageCounter.subscription_id == s.id).first()

    hist_actions = ["PACKAGE_SUBSCRIBED", "PACKAGE_UPGRADED", "SUBSCRIPTION_CANCELLED", "ADMIN_PLAN_CHANGE"]
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.actor_user_id == s.user_id, ActivityLog.action.in_(hist_actions))
        .order_by(ActivityLog.created_at.desc()).limit(15).all()
    )
    history = [AdminPlanChange(
        created_at=a.created_at, action=a.action, detail=a.description,
        by=("Admin" if a.actor_type == ActorType.admin else "Sistem" if a.actor_type == ActorType.system else "Klien"),
    ) for a in logs]

    return AdminSubscriptionDetail(
        id=s.id, client_name=owner.name if owner else "-",
        client_email=owner.email if owner else "-",
        plan_name=s.plan.name, category=s.category, status=s.status.value, price=float(s.plan.price),
        current_period_start=s.current_period_start, current_period_end=s.current_period_end,
        grace_until=s.grace_until, suspended_at=s.suspended_at,
        storage_used_bytes=counter.storage_used_bytes if counter else 0,
        storage_limit_bytes=s.plan.storage_limit_bytes,
        bandwidth_used_bytes=counter.bandwidth_used_bytes if counter else 0,
        bandwidth_limit_bytes=s.plan.bandwidth_limit_bytes,
        history=history,
    )


@router.post("/subscriptions/{sub_id}/fast-forward", status_code=200)
def admin_fast_forward(sub_id: int, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    """DEMO: majukan periode ke masa lalu lalu terapkan downgrade terjadwal (jika ada)."""
    from app.routers.subscriptions import _apply_scheduled
    s = db.get(Subscription, sub_id)
    if not s:
        raise HTTPException(status_code=404, detail="Langganan tidak ditemukan")
    s.current_period_end = datetime.utcnow() - timedelta(minutes=1)
    db.commit()
    applied = _apply_scheduled(db, s)
    return {
        "message": "Downgrade terjadwal diterapkan." if applied else "Periode dimajukan (tak ada jadwal downgrade).",
        "applied": applied,
    }


@router.post("/subscriptions/{sub_id}/mark-past-due", status_code=200)
def admin_mark_past_due(sub_id: int, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    """DEMO: tandai langganan NUNGGAK (past_due). Selama nunggak, langganan terkunci
    dari perubahan paket; dan begitu KLIEN membuka langganannya, otomatis TURUN ke Free
    (lihat apply_past_due_fallback). Di dunia nyata past_due datang dari tagihan tak
    terbayar (Midtrans, di-descope); di sini di-set manual untuk peragaan.
    """
    s = db.get(Subscription, sub_id)
    if not s:
        raise HTTPException(status_code=404, detail="Langganan tidak ditemukan")
    if s.status in (SubscriptionStatus.cancelled, SubscriptionStatus.expired, SubscriptionStatus.terminated):
        raise HTTPException(status_code=400, detail="Langganan sudah berakhir.")
    if s.status == SubscriptionStatus.suspended:
        raise HTTPException(status_code=400, detail="Langganan sedang disuspend; unsuspend dulu.")
    if s.status == SubscriptionStatus.past_due:
        raise HTTPException(status_code=400, detail="Langganan sudah nunggak.")
    if float(s.plan.price) == 0:
        raise HTTPException(status_code=400, detail="Paket Free tidak bisa nunggak (tak ada tagihan).")
    s.status = SubscriptionStatus.past_due
    s.current_period_end = datetime.utcnow() - timedelta(days=1)
    log_activity(
        db, actor_user_id=admin.id, actor_type=ActorType.admin,
        action="SUBSCRIPTION_MARKED_PAST_DUE",
        description="Admin menandai langganan nunggak (past_due) — simulasi.",
        target_type="SUBSCRIPTION", target_id=s.id,
    )
    db.commit()
    return {"message": "Langganan ditandai nunggak (past_due). Akan otomatis turun ke Free saat klien membukanya."}


@router.post("/subscriptions/{sub_id}/suspend", status_code=200)
def admin_suspend_subscription(sub_id: int, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    """Suspend langganan klien secara manual (override admin)."""
    s = db.get(Subscription, sub_id)
    if not s:
        raise HTTPException(status_code=404, detail="Langganan tidak ditemukan")
    if s.status in (SubscriptionStatus.cancelled, SubscriptionStatus.expired, SubscriptionStatus.terminated):
        raise HTTPException(status_code=400, detail="Langganan sudah berakhir, tidak bisa di-suspend.")
    if s.status == SubscriptionStatus.suspended:
        raise HTTPException(status_code=400, detail="Langganan sudah dalam status suspended.")
    s.status = SubscriptionStatus.suspended
    s.suspended_at = datetime.utcnow()
    log_activity(
        db, actor_user_id=admin.id, actor_type=ActorType.admin,
        action="SUBSCRIPTION_SUSPENDED",
        description="Admin men-suspend langganan secara manual.",
        target_type="SUBSCRIPTION", target_id=s.id,
    )
    db.commit()
    return {"message": "Langganan disuspend."}


@router.post("/subscriptions/{sub_id}/unsuspend", status_code=200)
def admin_unsuspend_subscription(sub_id: int, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    """Pulihkan langganan dari status suspended. Status final dihitung ulang (active/over_quota)."""
    s = db.get(Subscription, sub_id)
    if not s:
        raise HTTPException(status_code=404, detail="Langganan tidak ditemukan")
    if s.status != SubscriptionStatus.suspended:
        raise HTTPException(status_code=400, detail="Langganan tidak sedang suspended.")
    s.status = SubscriptionStatus.active
    s.suspended_at = None
    s.over_quota_since = None
    s.grace_until = None
    # Hitung ulang: jika masih melebihi limit, kembali over_quota dengan grace baru.
    usage_helper.evaluate_quota_status(db, s)
    log_activity(
        db, actor_user_id=admin.id, actor_type=ActorType.admin,
        action="SUBSCRIPTION_UNSUSPENDED",
        description="Admin memulihkan langganan dari status suspended.",
        target_type="SUBSCRIPTION", target_id=s.id,
    )
    db.commit()
    return {"message": f"Langganan dipulihkan (status: {s.status.value})."}


@router.post("/subscriptions/{sub_id}/expire-grace", status_code=200)
def admin_expire_grace(sub_id: int, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    """DEMO: habiskan grace period sekarang lalu jalankan auto-suspend (untuk uji tanpa nunggu 7 hari)."""
    s = db.get(Subscription, sub_id)
    if not s:
        raise HTTPException(status_code=404, detail="Langganan tidak ditemukan")
    if s.status != SubscriptionStatus.over_quota:
        raise HTTPException(status_code=400, detail="Langganan tidak sedang OVER_QUOTA, tak ada grace untuk dihabiskan.")
    s.grace_until = datetime.utcnow() - timedelta(minutes=1)
    db.commit()
    suspended = usage_helper.apply_grace_suspend(db, s)
    return {
        "message": "Grace habis → langganan disuspend otomatis." if suspended
                   else "Grace dihabiskan, tapi pemakaian sudah di bawah limit (tidak disuspend).",
        "suspended": suspended,
    }


@router.post("/subscriptions/{sub_id}/repair", status_code=200)
def admin_repair_subscription(sub_id: int, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    """Perbaiki langganan: hitung ulang counter pemakaian dari data nyata + evaluasi status.

    Membereskan 'error langganan' seperti angka kuota drift atau OVER_QUOTA yang nyangkut.
    Non-destruktif (tidak mengubah paket/harga).
    """
    s = db.get(Subscription, sub_id)
    if not s:
        raise HTTPException(status_code=404, detail="Langganan tidak ditemukan")
    if s.category == "hosting":
        usage_helper.recalculate_hosting(db, s)
    else:
        usage_helper.recalculate(db, s)
    usage_helper.evaluate_quota_status(db, s)
    log_activity(
        db, actor_user_id=admin.id, actor_type=ActorType.admin,
        action="SUBSCRIPTION_REPAIRED",
        description=f"Admin memperbaiki (recalc) langganan {s.plan.name}",
        target_type="SUBSCRIPTION", target_id=s.id,
    )
    db.commit()
    return {"message": f"Langganan diperbaiki — counter dihitung ulang, status: {s.status.value}."}


# Force Change Plan (admin memindah paket langganan klien) DIHAPUS — rawan disalahgunakan
# admin (mis. menurunkan paket klien sepihak). Perubahan paket hanya boleh dilakukan
# oleh KLIEN sendiri lewat upgrade/downgrade.


# ════════ Riwayat Langganan (dulu "Transaksi") ════════
# Pembayaran di-descope → halaman ini menjadi riwayat EVENT langganan berhasil
# yang diambil dari activity log (berlangganan/upgrade/downgrade), bukan invoice dummy.

_SUB_EVENT_ACTIONS = ["PACKAGE_SUBSCRIBED", "PACKAGE_UPGRADED", "PACKAGE_DOWNGRADED"]


@router.get("/subscription-history", response_model=Page[AdminSubHistoryItem])
def subscription_history(q: str = Query(""), page: int = Query(1), page_size: int = Query(15),
                         db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    logs = (
        db.query(ActivityLog)
        .filter(ActivityLog.action.in_(_SUB_EVENT_ACTIONS))
        .order_by(ActivityLog.created_at.desc())
        .all()
    )
    rows = []
    for a in logs:
        owner = db.get(User, a.actor_user_id) if a.actor_user_id else None
        client = owner.name if owner else "-"
        if q:
            ql = q.lower()
            if ql not in client.lower() and ql not in (a.description or "").lower():
                continue
        rows.append(AdminSubHistoryItem(
            id=a.id, client_name=client, action=a.action,
            detail=a.description, created_at=a.created_at,
        ))
    total = len(rows)
    start = max(page - 1, 0) * page_size
    return Page[AdminSubHistoryItem](items=rows[start:start + page_size], total=total)


# ════════ Fase F: Monitoring Sumber Daya ════════

MON_BASE_URL = "http://localhost:8000"


@router.get("/monitoring", response_model=AdminMonitoring)
def monitoring(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    object_bytes = int(
        db.query(func.coalesce(func.sum(StorageObject.size_bytes), 0))
        .filter(StorageObject.status == ObjectStatus.available).scalar()
    )
    bandwidth_bytes = int(
        db.query(func.coalesce(func.sum(UsageCounter.bandwidth_used_bytes), 0)).scalar()
    )
    bucket_count = db.query(StorageBucket).filter(StorageBucket.status == BucketStatus.active).count()
    site_count = db.query(StaticSite).filter(StaticSite.status == SiteStatus.active).count()

    rows = (
        db.query(StorageBucket.user_id, func.coalesce(func.sum(StorageObject.size_bytes), 0).label("used"))
        .join(StorageObject, StorageObject.bucket_id == StorageBucket.id)
        .filter(StorageObject.status == ObjectStatus.available)
        .group_by(StorageBucket.user_id)
        .order_by(func.coalesce(func.sum(StorageObject.size_bytes), 0).desc())
        .limit(3).all()
    )
    top = []
    for user_id, used in rows:
        owner = db.get(User, user_id)
        top.append(AdminTopUser(name=owner.name if owner else "-", used_bytes=int(used)))

    capacity_percent = round(object_bytes / PLATFORM_STORAGE_CAP * 100) if PLATFORM_STORAGE_CAP else 0
    health = _platform_health(db)

    return AdminMonitoring(
        storage_used_bytes=object_bytes,
        storage_cap_bytes=PLATFORM_STORAGE_CAP,
        bandwidth_used_bytes=bandwidth_bytes,
        bucket_count=bucket_count,
        site_count=site_count,
        top_storage_users=top,
        nodes_active=health["active"], nodes_total=health["total"],
        capacity_percent=min(capacity_percent, 100),
        avg_load_percent=health["load_percent"],
        healthy=health["healthy"],
        uptime_seconds=health["uptime_seconds"],
        services=[ServiceStatus(name=n, healthy=up) for n, up in health["services"]],
    )


@router.get("/storage-buckets", response_model=Page[AdminBucketRow])
def all_buckets(q: str = Query("", alias="q"), page: int = Query(1), page_size: int = Query(15),
                db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    buckets = (
        db.query(StorageBucket)
        .filter(StorageBucket.status != BucketStatus.deleted)  # termasuk creating/failed agar bisa diperbaiki
        .order_by(StorageBucket.created_at.desc()).all()
    )
    # Filter (nama bucket / pemilik) lalu paginasi di sisi server.
    matched = []
    for b in buckets:
        owner = db.get(User, b.user_id)
        owner_name = owner.name if owner else "-"
        if q and q.lower() not in b.display_name.lower() and q.lower() not in owner_name.lower():
            continue
        matched.append((b, owner_name))
    total = len(matched)
    start = max(page - 1, 0) * page_size
    out = []
    for b, owner_name in matched[start:start + page_size]:
        stats = (
            db.query(func.count(StorageObject.id), func.coalesce(func.sum(StorageObject.size_bytes), 0))
            .filter(StorageObject.bucket_id == b.id, StorageObject.status == ObjectStatus.available)
            .first()
        )
        out.append(AdminBucketRow(
            id=b.id, name=b.display_name, owner_name=owner_name,
            object_count=int(stats[0]) if stats else 0,
            total_size_bytes=int(stats[1]) if stats else 0,
            status=b.status.value if hasattr(b.status, "value") else b.status,
        ))
    return Page[AdminBucketRow](items=out, total=total)


@router.get("/storage-buckets/{bucket_id}", response_model=AdminBucketDetail)
def bucket_detail(bucket_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    b = db.query(StorageBucket).filter(StorageBucket.id == bucket_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bucket tidak ditemukan")
    owner = db.get(User, b.user_id)
    objs = db.query(StorageObject).filter(
        StorageObject.bucket_id == b.id, StorageObject.status == ObjectStatus.available).all()
    total = sum(o.size_bytes for o in objs)
    return AdminBucketDetail(
        id=b.id, name=b.display_name, owner_name=owner.name if owner else "-",
        visibility=b.visibility.value if hasattr(b.visibility, "value") else b.visibility,
        object_count=len(objs), total_size_bytes=total,
        objects=[AdminBucketObject(
            key=o.object_key, size_bytes=o.size_bytes,
            content_type=o.content_type, uploaded_at=o.uploaded_at or o.created_at) for o in objs],
    )


@router.post("/storage-buckets/{bucket_id}/repair", status_code=200)
def admin_repair_bucket(bucket_id: int, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    """Perbaiki bucket: pastikan ada di MiniStack, self-heal objek yang hilang,
    betulkan status macet (creating/failed → active), lalu hitung ulang counter pemilik.
    """
    from app.core.ministack import get_s3_client, ensure_object_exists, _ensure_bucket_exists

    b = db.query(StorageBucket).filter(StorageBucket.id == bucket_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Bucket tidak ditemukan")
    if b.status == BucketStatus.deleted:
        raise HTTPException(status_code=400, detail="Bucket sudah dihapus, tak bisa diperbaiki.")

    s3 = get_s3_client()
    _ensure_bucket_exists(s3, b.internal_name)
    if b.status in (BucketStatus.creating, BucketStatus.failed):
        b.status = BucketStatus.active

    objs = db.query(StorageObject).filter(
        StorageObject.bucket_id == b.id, StorageObject.status == ObjectStatus.available).all()
    synced = 0
    for o in objs:
        if ensure_object_exists(s3, b.internal_name, o.object_key, o.content_type):
            synced += 1

    sub = _active_sub(db, b.user_id, "storage")
    if sub:
        usage_helper.recalculate(db, sub)
        usage_helper.evaluate_quota_status(db, sub)

    log_activity(
        db, actor_user_id=admin.id, actor_type=ActorType.admin,
        action="BUCKET_REPAIRED",
        description=f"Admin memperbaiki bucket '{b.display_name}' ({synced} objek tersinkron)",
        target_type="BUCKET", target_id=b.id,
    )
    db.commit()
    return {"message": f"Bucket diperbaiki — {synced} objek tersinkron, status: {b.status.value}."}


@router.get("/hosting-sites", response_model=Page[AdminSiteRow])
def all_sites(q: str = Query("", alias="q"), page: int = Query(1), page_size: int = Query(15),
              db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    sites = (
        db.query(StaticSite)
        .filter(StaticSite.status == SiteStatus.active)
        .order_by(StaticSite.created_at.desc()).all()
    )
    matched = []
    for s in sites:
        owner = db.get(User, s.user_id)
        owner_name = owner.name if owner else "-"
        if q and q.lower() not in s.site_name.lower() and q.lower() not in owner_name.lower():
            continue
        matched.append((s, owner_name))
    total = len(matched)
    start = max(page - 1, 0) * page_size
    out = []
    for s, owner_name in matched[start:start + page_size]:
        last_dep = None
        if s.active_deployment_id:
            dep = db.get(StaticSiteDeployment, s.active_deployment_id)
            if dep:
                last_dep = dep.deployed_at
        out.append(AdminSiteRow(
            id=s.id, name=s.site_name, owner_name=owner_name,
            url=f"{MON_BASE_URL}/sites/{s.slug}/", last_deployed_at=last_dep, status="active",
        ))
    return Page[AdminSiteRow](items=out, total=total)


# ════════ Fase G: Keamanan & Log Sistem ════════

import re as _re


def _log_target(a: ActivityLog) -> str:
    m = _re.search(r"'([^']+)'", a.description or "")
    if m:
        return m[1]
    em = _re.search(r"[\w.+-]+@[\w-]+\.[\w.-]+", a.description or "")
    if em:
        return em.group(0)
    if a.target_type:
        return f"{a.target_type} #{a.target_id}" if a.target_id else a.target_type
    return "-"


_TYPE_PREFIX = {
    "storage": ("FILE_", "BUCKET_"),
    "hosting": ("STATIC_SITE",),
    "key": ("ACCESS_KEY",),
    "security": ("PIN_", "PASSWORD_"),
    "account": ("USER_LOGIN", "USER_REGISTERED", "USER_STATUS"),
    "billing": ("PACKAGE_", "SUBSCRIPTION_"),
    "admin": ("PLAN_", "ADMIN_"),
}


@router.post("/access-keys/{key_id}/revoke", status_code=200)
def admin_revoke_key(key_id: int, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    k = db.get(AccessKey, key_id)
    if not k:
        raise HTTPException(status_code=404, detail="Access key tidak ditemukan")
    if k.status == KeyStatus.revoked:
        raise HTTPException(status_code=400, detail="Kunci sudah dicabut")
    k.status = KeyStatus.revoked
    k.revoked_at = datetime.utcnow()
    log_activity(
        db, actor_user_id=admin.id, actor_type=ActorType.admin,
        action="ADMIN_KEY_REVOKED",
        description=f"Admin mencabut access key {k.access_key_id}",
        target_type="ACCESS_KEY", target_id=k.id,
    )
    db.commit()
    return {"message": "Access key dicabut."}


@router.get("/logs", response_model=AdminLogPage)
def system_logs(actor: str = Query("all"), type_f: str = Query("all", alias="type"),
                q: str = Query(""), page: int = Query(1), page_size: int = Query(15),
                db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    query = db.query(ActivityLog)
    if actor in ("user", "admin", "system", "midtrans"):
        query = query.filter(ActivityLog.actor_type == ActorType(actor))
    if type_f in _TYPE_PREFIX:
        prefixes = _TYPE_PREFIX[type_f]
        conds = [ActivityLog.action.like(f"{p}%") for p in prefixes]
        from sqlalchemy import or_
        query = query.filter(or_(*conds))
    if q:
        query = query.filter(ActivityLog.description.like(f"%{q}%"))

    total = query.count()
    rows = (
        query.order_by(ActivityLog.created_at.desc())
        .offset(max(page - 1, 0) * page_size).limit(page_size).all()
    )
    items = []
    for a in rows:
        # Peran sebenarnya pelaku (untuk pill): resolusi dari user, bukan sekadar
        # actor_type tersimpan — mis. login oleh admin tercatat actor_type=user,
        # tapi pill harus tampil "Admin".
        if a.actor_type == ActorType.system:
            actor_name, actor_role = "Sistem", "system"
        elif a.actor_user_id:
            owner = db.get(User, a.actor_user_id)
            actor_name = owner.name if owner else "User"
            actor_role = "admin" if (owner and owner.role == UserRole.admin) else "user"
        else:
            actor_name = a.actor_type.value.capitalize()
            actor_role = a.actor_type.value
        items.append(AdminLogItem(
            id=a.id, actor_type=a.actor_type.value, actor_role=actor_role, actor_name=actor_name,
            action=a.action, target=_log_target(a), ip_address=a.ip_address,
            created_at=a.created_at,
        ))
    return AdminLogPage(items=items, total=total)


@router.get("/audit", response_model=Page[AdminAuditItem])
def admin_audit(q: str = Query(""), page: int = Query(1), page_size: int = Query(15),
                db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    query = db.query(ActivityLog).filter(ActivityLog.actor_type == ActorType.admin)
    if q:
        query = query.filter(ActivityLog.description.like(f"%{q}%"))
    total = query.count()
    rows = (
        query.order_by(ActivityLog.created_at.desc())
        .offset(max(page - 1, 0) * page_size).limit(page_size).all()
    )
    out = []
    for a in rows:
        admin_user = db.get(User, a.actor_user_id) if a.actor_user_id else None
        out.append(AdminAuditItem(
            id=a.id,
            admin_name=admin_user.name if admin_user else "Admin",
            affected=_log_target(a),
            action=a.action,
            note=a.description,
            created_at=a.created_at,
        ))
    return Page[AdminAuditItem](items=out, total=total)


# ── IAM Policy (manajemen saja, belum di-enforce) ──

def _policy_item(p: IamPolicy) -> IamPolicyItem:
    return IamPolicyItem(
        id=p.id, name=p.name, description=p.description,
        policy_type=p.policy_type.value if hasattr(p.policy_type, "value") else p.policy_type,
        document=p.document, created_by=p.created_by, created_at=p.created_at,
    )


def _validate_json(doc: str):
    try:
        json.loads(doc)
    except Exception:
        raise HTTPException(status_code=400, detail="Dokumen policy harus JSON valid.")


@router.get("/iam-policies", response_model=list[IamPolicyItem])
def list_policies(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    pols = db.query(IamPolicy).order_by(IamPolicy.created_at.asc()).all()
    return [_policy_item(p) for p in pols]


@router.post("/iam-policies", response_model=IamPolicyItem, status_code=201)
def create_policy(body: IamPolicyWrite, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    _validate_json(body.document)
    p = IamPolicy(
        name=body.name.strip(), description=(body.description or None),
        policy_type=PolicyType.custom, document=body.document, created_by=admin.name,
    )
    db.add(p)
    log_activity(db, actor_user_id=admin.id, actor_type=ActorType.admin,
                 action="IAM_POLICY_CREATED", description=f"Admin membuat policy {body.name}")
    db.commit(); db.refresh(p)
    return _policy_item(p)


@router.put("/iam-policies/{policy_id}", response_model=IamPolicyItem)
def update_policy(policy_id: int, body: IamPolicyWrite,
                  db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    p = db.get(IamPolicy, policy_id)
    if not p:
        raise HTTPException(status_code=404, detail="Policy tidak ditemukan")
    if p.policy_type == PolicyType.system:
        raise HTTPException(status_code=400, detail="Policy System tidak bisa diubah.")
    _validate_json(body.document)
    p.name = body.name.strip()
    p.description = body.description or None
    p.document = body.document
    log_activity(db, actor_user_id=admin.id, actor_type=ActorType.admin,
                 action="IAM_POLICY_UPDATED", description=f"Admin mengubah policy {p.name}")
    db.commit(); db.refresh(p)
    return _policy_item(p)


@router.delete("/iam-policies/{policy_id}", status_code=200)
def delete_policy(policy_id: int, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    p = db.get(IamPolicy, policy_id)
    if not p:
        raise HTTPException(status_code=404, detail="Policy tidak ditemukan")
    if p.policy_type == PolicyType.system:
        raise HTTPException(status_code=400, detail="Policy System tidak bisa dihapus.")
    name = p.name
    db.delete(p)
    log_activity(db, actor_user_id=admin.id, actor_type=ActorType.admin,
                 action="IAM_POLICY_DELETED", description=f"Admin menghapus policy {name}")
    db.commit()
    return {"message": "Policy dihapus."}
