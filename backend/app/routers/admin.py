import json
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

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
    AdminTopUser, AdminTransactionDetail, AdminTransactionItem, AdminUserDetail, AdminUserItem,
    AdminUserResource, ChangePlanRequest, IamPolicyItem, IamPolicyWrite, StatsResponse,
    StatusUpdateRequest,
)

router = APIRouter(prefix="/admin", tags=["admin"])

PLATFORM_STORAGE_CAP = 1024 ** 4  # 1 TB (simulasi kapasitas platform)


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

    return StatsResponse(
        uptime_percent=99.9,
        physical_nodes_healthy=4,
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
        items.append(AdminResourceItem(
            id=s.id, name=s.site_name, owner_name=owner.name if owner else "-",
            type="Static", utilization_percent=0, status="active",
        ))

    return items


@router.get("/access-keys", response_model=list[AdminAccessKeyItem])
def list_access_keys(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    keys = db.query(AccessKey).order_by(AccessKey.created_at.desc()).limit(50).all()
    out: list[AdminAccessKeyItem] = []
    for k in keys:
        owner = db.get(User, k.user_id)
        out.append(AdminAccessKeyItem(
            id=k.id, access_key_id=k.access_key_id,
            owner_name=owner.name if owner else "-",
            status=k.status.value if hasattr(k.status, "value") else k.status,
            category=k.category,
            permission=k.permission.value if hasattr(k.permission, "value") else k.permission,
            policy_name=k.policy_name,
            last_used_at=k.last_used_at,
            created_at=k.created_at,
        ))
    return out


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

@router.get("/users", response_model=list[AdminUserItem])
def list_users(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    out = []
    for u in users:
        sub = _active_sub(db, u.id, "storage") or _active_sub(db, u.id, "hosting")
        out.append(AdminUserItem(
            id=u.id, name=u.name, email=u.email,
            role=u.role.value, status=u.status.value,
            plan_name=sub.plan.name if sub else None, created_at=u.created_at,
        ))
    return out


@router.get("/users/{user_id}", response_model=AdminUserDetail)
def user_detail(user_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    u = db.get(User, user_id)
    if not u:
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


# ════════ Fase C: Manajemen Paket ════════

def _plan_item(db: Session, p: ServicePlan) -> AdminPlanItem:
    cnt = db.query(Subscription).filter(
        Subscription.plan_id == p.id, Subscription.status.in_(ACTIVE_LIKE_STATUSES)).count()
    return AdminPlanItem(
        id=p.id, name=p.name, category=p.category.value, price=float(p.price),
        storage_limit_bytes=p.storage_limit_bytes, max_file_size_bytes=p.max_file_size_bytes,
        bandwidth_limit_bytes=p.bandwidth_limit_bytes, bucket_limit=p.bucket_limit,
        static_site_limit=p.static_site_limit, access_key_limit=p.access_key_limit,
        is_active=p.is_active, subscriber_count=cnt,
    )


@router.get("/plans", response_model=list[AdminPlanItem])
def list_plans(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    plans = db.query(ServicePlan).order_by(ServicePlan.category, ServicePlan.price).all()
    return [_plan_item(db, p) for p in plans]


def _apply_plan(p: ServicePlan, body: AdminPlanWrite):
    if body.category not in ("storage", "hosting"):
        raise HTTPException(status_code=400, detail="Kategori harus storage atau hosting.")
    p.name = body.name.strip()
    p.category = PlanCategory(body.category)
    p.price = body.price
    p.storage_limit_bytes = body.storage_limit_bytes
    p.max_file_size_bytes = body.max_file_size_bytes
    p.bandwidth_limit_bytes = body.bandwidth_limit_bytes
    p.bucket_limit = body.bucket_limit
    p.static_site_limit = body.static_site_limit
    p.access_key_limit = body.access_key_limit
    p.is_active = body.is_active


@router.post("/plans", response_model=AdminPlanItem, status_code=201)
def create_plan(body: AdminPlanWrite, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    p = ServicePlan(name="", category=PlanCategory.storage, price=0)
    _apply_plan(p, body)
    db.add(p)
    log_activity(db, actor_user_id=admin.id, actor_type=ActorType.admin,
                 action="PLAN_CREATED", description=f"Admin membuat paket {body.name}")
    db.commit(); db.refresh(p)
    return _plan_item(db, p)


@router.put("/plans/{plan_id}", response_model=AdminPlanItem)
def update_plan(plan_id: int, body: AdminPlanWrite,
                db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    p = db.get(ServicePlan, plan_id)
    if not p:
        raise HTTPException(status_code=404, detail="Paket tidak ditemukan")
    _apply_plan(p, body)
    log_activity(db, actor_user_id=admin.id, actor_type=ActorType.admin,
                 action="PLAN_UPDATED", description=f"Admin mengubah paket {p.name}")
    db.commit(); db.refresh(p)
    return _plan_item(db, p)


@router.delete("/plans/{plan_id}", status_code=200)
def delete_plan(plan_id: int, db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    p = db.get(ServicePlan, plan_id)
    if not p:
        raise HTTPException(status_code=404, detail="Paket tidak ditemukan")
    used = db.query(Subscription).filter(Subscription.plan_id == plan_id).count()
    if used > 0:
        raise HTTPException(
            status_code=409,
            detail="Paket dipakai/pernah dipakai langganan. Nonaktifkan saja, jangan hapus.",
        )
    name = p.name
    db.delete(p)
    log_activity(db, actor_user_id=admin.id, actor_type=ActorType.admin,
                 action="PLAN_DELETED", description=f"Admin menghapus paket {name}")
    db.commit()
    return {"message": "Paket dihapus."}


# ════════ Fase D: Langganan ════════

@router.get("/subscriptions", response_model=list[AdminSubscriptionItem])
def list_subscriptions(status_f: str = Query("all", alias="status"),
                       db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    q = db.query(Subscription)
    if status_f == "active":
        q = q.filter(Subscription.status == SubscriptionStatus.active)
    elif status_f == "over_quota":
        q = q.filter(Subscription.status == SubscriptionStatus.over_quota)
    elif status_f == "past_due":
        q = q.filter(Subscription.status == SubscriptionStatus.past_due)
    else:
        q = q.filter(Subscription.status.in_(ACTIVE_LIKE_STATUSES))
    subs = q.order_by(Subscription.created_at.desc()).all()
    out = []
    for s in subs:
        owner = db.get(User, s.user_id)
        out.append(AdminSubscriptionItem(
            id=s.id, client_name=owner.name if owner else "-", plan_name=s.plan.name,
            category=s.category, status=s.status.value,
            current_period_end=s.current_period_end,
            scheduled_change=(f"Downgrade → {s.scheduled_plan.name}" if s.scheduled_plan_id else None),
        ))
    return out


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


@router.post("/subscriptions/{sub_id}/change-plan", status_code=200)
def admin_change_plan(sub_id: int, body: ChangePlanRequest,
                      db: Session = Depends(get_db), admin: User = Depends(get_admin_user)):
    s = db.get(Subscription, sub_id)
    if not s:
        raise HTTPException(status_code=404, detail="Langganan tidak ditemukan")
    plan = db.get(ServicePlan, body.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Paket tidak ditemukan")
    if plan.category.value != s.category:
        raise HTTPException(status_code=400, detail="Paket harus kategori yang sama dengan langganan.")

    old_name = s.plan.name
    s.plan = plan  # set relationship (bukan hanya plan_id) agar evaluate_quota_status pakai plan baru
    if s.category == "hosting":
        usage_helper.recalculate_hosting(db, s)
    else:
        usage_helper.recalculate(db, s)
    usage_helper.evaluate_quota_status(db, s)
    log_activity(
        db, actor_user_id=admin.id, actor_type=ActorType.admin,
        action="ADMIN_PLAN_CHANGE",
        description=f"Admin mengubah paket dari {old_name} ke {plan.name}",
        target_type="SUBSCRIPTION", target_id=s.id,
    )
    db.commit()
    return {"message": f"Paket langganan diubah ke {plan.name}."}


# ════════ Fase E: Transaksi (DUMMY / simulasi — Midtrans belum terintegrasi) ════════
# Data dibangkitkan dari langganan nyata agar realistis, TIDAK tersimpan & TIDAK
# memanggil Midtrans sungguhan. Hanya untuk tampilan/placeholder.

def _tx_from_sub(db: Session, s: Subscription) -> dict:
    owner = db.get(User, s.user_id)
    paid = s.status in (SubscriptionStatus.active, SubscriptionStatus.over_quota)
    return {
        "id": s.id,
        "invoice_no": f"INV-{s.current_period_start.year}-{s.id:03d}",
        "client_name": owner.name if owner else "-",
        "amount": float(s.plan.price),
        "invoice_status": "PAID" if paid else "UNPAID",
        "midtrans_status": "settlement" if paid else "pending",
        "method": "QRIS" if s.id % 2 == 0 else "BVA",
        "date": s.current_period_start,
    }


@router.get("/transactions", response_model=list[AdminTransactionItem])
def list_transactions(db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    subs = (
        db.query(Subscription)
        .filter(Subscription.status.in_(ACTIVE_LIKE_STATUSES))
        .order_by(Subscription.created_at.desc())
        .all()
    )
    return [AdminTransactionItem(**_tx_from_sub(db, s)) for s in subs]


@router.get("/transactions/{sub_id}", response_model=AdminTransactionDetail)
def transaction_detail(sub_id: int, db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    s = db.get(Subscription, sub_id)
    if not s:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    base = _tx_from_sub(db, s)
    midtrans_id = f"MID-{s.id:06d}-SIM"
    raw = {
        "transaction_time": s.current_period_start.strftime("%Y-%m-%d %H:%M:%S"),
        "transaction_status": base["midtrans_status"],
        "transaction_id": midtrans_id,
        "status_message": "midtrans payment notification (SIMULASI)",
        "status_code": "200" if base["invoice_status"] == "PAID" else "201",
        "payment_type": base["method"].lower(),
        "order_id": base["invoice_no"],
        "gross_amount": f"{base['amount']:.2f}",
        "fraud_status": "accept",
        "currency": "IDR",
        "_note": "Data simulasi — Midtrans belum diintegrasikan.",
    }
    return AdminTransactionDetail(**base, midtrans_id=midtrans_id, raw_notification=raw)


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

    return AdminMonitoring(
        storage_used_bytes=object_bytes,
        storage_cap_bytes=PLATFORM_STORAGE_CAP,
        bandwidth_used_bytes=bandwidth_bytes,
        bucket_count=bucket_count,
        site_count=site_count,
        top_storage_users=top,
        nodes_active=4, nodes_total=4,         # simulasi
        capacity_percent=min(capacity_percent, 100),
        avg_load_percent=42,                   # simulasi
        healthy=True,
    )


@router.get("/storage-buckets", response_model=list[AdminBucketRow])
def all_buckets(q: str = Query("", alias="q"),
                db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    buckets = (
        db.query(StorageBucket)
        .filter(StorageBucket.status == BucketStatus.active)
        .order_by(StorageBucket.created_at.desc()).all()
    )
    out = []
    for b in buckets:
        owner = db.get(User, b.user_id)
        owner_name = owner.name if owner else "-"
        if q and q.lower() not in b.display_name.lower() and q.lower() not in owner_name.lower():
            continue
        stats = (
            db.query(func.count(StorageObject.id), func.coalesce(func.sum(StorageObject.size_bytes), 0))
            .filter(StorageObject.bucket_id == b.id, StorageObject.status == ObjectStatus.available)
            .first()
        )
        out.append(AdminBucketRow(
            id=b.id, name=b.display_name, owner_name=owner_name,
            object_count=int(stats[0]) if stats else 0,
            total_size_bytes=int(stats[1]) if stats else 0, status="active",
        ))
    return out


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


@router.get("/hosting-sites", response_model=list[AdminSiteRow])
def all_sites(q: str = Query("", alias="q"),
              db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    sites = (
        db.query(StaticSite)
        .filter(StaticSite.status == SiteStatus.active)
        .order_by(StaticSite.created_at.desc()).all()
    )
    out = []
    for s in sites:
        owner = db.get(User, s.user_id)
        owner_name = owner.name if owner else "-"
        if q and q.lower() not in s.site_name.lower() and q.lower() not in owner_name.lower():
            continue
        last_dep = None
        if s.active_deployment_id:
            dep = db.get(StaticSiteDeployment, s.active_deployment_id)
            if dep:
                last_dep = dep.deployed_at
        out.append(AdminSiteRow(
            id=s.id, name=s.site_name, owner_name=owner_name,
            url=f"{MON_BASE_URL}/sites/{s.slug}/", last_deployed_at=last_dep, status="active",
        ))
    return out


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
        if a.actor_type == ActorType.user and a.actor_user_id:
            owner = db.get(User, a.actor_user_id)
            actor_name = owner.name if owner else "User"
        else:
            actor_name = a.actor_type.value.capitalize()
        items.append(AdminLogItem(
            id=a.id, actor_type=a.actor_type.value, actor_name=actor_name,
            action=a.action, target=_log_target(a), ip_address=a.ip_address,
            created_at=a.created_at,
        ))
    return AdminLogPage(items=items, total=total)


@router.get("/audit", response_model=list[AdminAuditItem])
def admin_audit(q: str = Query(""), page: int = Query(1), page_size: int = Query(30),
                db: Session = Depends(get_db), _: User = Depends(get_admin_user)):
    query = db.query(ActivityLog).filter(ActivityLog.actor_type == ActorType.admin)
    if q:
        query = query.filter(ActivityLog.description.like(f"%{q}%"))
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
    return out


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
