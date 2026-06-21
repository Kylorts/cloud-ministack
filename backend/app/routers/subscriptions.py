from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.activity import log_activity
from app.core.deps import get_current_user
from app.core.pin import require_pin
from app.core import usage as usage_helper
from app.database import get_db
from app.models.access_key import AccessKey, KeyStatus
from app.models.plan import PlanCategory, ServicePlan
from app.models.subscription import (
    ACTIVE_LIKE_STATUSES,
    Subscription,
    SubscriptionStatus,
)
from app.models.user import User
from app.schemas.subscription import SubscribeRequest, SubscriptionResponse

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


def _get_active_subscription(user_id: int, db: Session, category: str | None = None) -> Subscription | None:
    """Ambil subscription yang sedang menempati slot (active-like), opsional per kategori."""
    q = db.query(Subscription).filter(
        Subscription.user_id == user_id,
        Subscription.status.in_(ACTIVE_LIKE_STATUSES),
    )
    if category:
        q = q.filter(Subscription.category == category)
    return q.order_by(Subscription.created_at.desc()).first()


def _revoke_category_keys(db: Session, user_id: int, category: str) -> int:
    """
    Cabut semua access key kategori tertentu milik user (Model A: key terikat
    ke langganan — mati saat langganan berakhir/diganti). Mengembalikan jumlah
    key yang dicabut.
    """
    keys = (
        db.query(AccessKey)
        .filter(
            AccessKey.user_id == user_id,
            AccessKey.category == category,
            AccessKey.status != KeyStatus.revoked,
        )
        .all()
    )
    now = datetime.utcnow()
    for k in keys:
        k.status = KeyStatus.revoked
        k.revoked_at = now
    return len(keys)


def _apply_scheduled(db: Session, sub: Subscription) -> bool:
    """
    Lazy-apply downgrade terjadwal: jika ada `scheduled_plan_id` dan periode
    sudah lewat → terapkan paket baru, geser periode 30 hari, recalc + evaluate
    (→ OVER_QUOTA bila perlu). Dipanggil di jalur baca. Return True bila diterapkan.
    """
    if not sub or not sub.scheduled_plan_id:
        return False
    if datetime.utcnow() < sub.current_period_end:
        return False
    new_plan = db.get(ServicePlan, sub.scheduled_plan_id)
    if not new_plan:
        sub.scheduled_plan_id = None
        db.commit()
        return False
    old_name = sub.plan.name
    now = datetime.utcnow()
    sub.plan_id = new_plan.id
    sub.scheduled_plan_id = None
    sub.current_period_start = now
    sub.current_period_end = now + timedelta(days=30)
    if sub.category == "hosting":
        usage_helper.recalculate_hosting(db, sub)
    else:
        usage_helper.recalculate(db, sub)
    usage_helper.evaluate_quota_status(db, sub)
    log_activity(
        db, actor_user_id=sub.user_id, action="PACKAGE_DOWNGRADED",
        description=f"Downgrade terjadwal diterapkan: {old_name} → {new_plan.name}",
        target_type="SUBSCRIPTION", target_id=sub.id,
    )
    db.commit()
    db.refresh(sub)
    return True


@router.get("/me", response_model=SubscriptionResponse)
def get_my_subscription(
    category: str = Query("storage"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_subscription(current_user.id, db, category=category)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Anda belum memiliki langganan aktif",
        )
    _apply_scheduled(db, sub)  # terapkan downgrade terjadwal bila sudah waktunya
    from app.core.usage import apply_grace_suspend

    apply_grace_suspend(db, sub)  # auto-suspend bila grace period habis & masih over
    return sub


@router.get("/history", response_model=list[SubscriptionResponse])
def get_subscription_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(Subscription)
        .filter(Subscription.user_id == current_user.id)
        .order_by(Subscription.created_at.desc())
        .all()
    )


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
def subscribe(
    body: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = db.get(ServicePlan, body.plan_id)
    if not plan or not plan.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paket tidak ditemukan",
        )

    category = plan.category.value if hasattr(plan.category, "value") else str(plan.category)
    now = datetime.utcnow()

    active = _get_active_subscription(current_user.id, db, category=category)

    if active:
        is_upgrade = float(plan.price) > float(active.plan.price)

        # ── UPGRADE IN-PLACE (langsung) ───────────────────────────────
        # Paket lebih mahal (kategori sama) → ubah plan pada langganan yang
        # SAMA. Access key tetap hidup (subscription_id tak berubah), limit
        # naik seketika, over_quota & dormancy pulih otomatis.
        if is_upgrade:
            active.plan_id = plan.id
            active.scheduled_plan_id = None  # upgrade membatalkan jadwal downgrade
            active.current_period_start = now
            active.current_period_end = now + timedelta(days=30)  # reset 30 hari
            if category == "hosting":
                usage_helper.recalculate_hosting(db, active)
            else:
                usage_helper.recalculate(db, active)
            usage_helper.evaluate_quota_status(db, active)
            log_activity(
                db,
                actor_user_id=current_user.id,
                action="PACKAGE_UPGRADED",
                description=f"Upgrade ke paket {plan.name}",
                target_type="SUBSCRIPTION",
                target_id=active.id,
                metadata={"plan_name": plan.name, "price": float(plan.price)},
            )
            db.commit()
            db.refresh(active)
            return active

        # ── Bukan upgrade (downgrade / paket sama) ────────────────────
        # Langganan AKTIF tak boleh diganti diam-diam → minta batalkan dulu.
        if active.status == SubscriptionStatus.active:
            label = "Hosting" if category == "hosting" else "Storage"
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Anda sudah memiliki langganan {label} aktif. Batalkan terlebih dahulu sebelum memilih paket baru.",
            )
        # Langganan non-active (over_quota/suspended) → ganti record + cabut key
        active.status = SubscriptionStatus.terminated
        active.cancelled_at = now
        _revoke_category_keys(db, current_user.id, category)

    # Buat record subscription BARU (riwayat tersimpan)
    sub = Subscription(
        user_id=current_user.id,
        plan_id=body.plan_id,
        category=category,
        status=SubscriptionStatus.active,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    db.add(sub)
    db.flush()

    # Buat usage counter untuk subscription baru, lalu recalc dari data user yang ada
    usage_helper.get_or_create_counter(db, sub)
    if category == "hosting":
        usage_helper.recalculate_hosting(db, sub)
    else:
        usage_helper.recalculate(db, sub)

    # Jika pemakaian existing melebihi limit plan baru → tandai OVER_QUOTA
    usage_helper.evaluate_quota_status(db, sub)

    log_activity(
        db,
        actor_user_id=current_user.id,
        action="PACKAGE_SUBSCRIBED",
        description=f"Berlangganan paket {plan.name}",
        target_type="SUBSCRIPTION",
        target_id=sub.id,
        metadata={"plan_name": plan.name, "price": float(plan.price)},
    )

    db.commit()
    db.refresh(sub)
    return sub


@router.delete("/me", status_code=status.HTTP_200_OK)
def cancel_subscription(
    category: str = Query("storage"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_transaction_pin: str | None = Header(default=None, alias="X-Transaction-PIN"),
):
    require_pin(current_user, x_transaction_pin)
    # _get_active_subscription sudah memfilter status active-like (termasuk
    # over_quota / suspended) — semua boleh dibatalkan, bukan hanya `active`.
    sub = _get_active_subscription(current_user.id, db, category=category)
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tidak ada langganan aktif untuk dibatalkan",
        )

    # Tier Free = lantai langganan. "Batalkan" paket berbayar = TURUN ke Free
    # (langganan tak pernah kosong). Access key dipertahankan (langganan lanjut).
    free_plan = (
        db.query(ServicePlan)
        .filter(
            ServicePlan.category == PlanCategory(category),
            ServicePlan.price == 0,
            ServicePlan.is_active.is_(True),
        )
        .order_by(ServicePlan.id.asc())
        .first()
    )
    if not free_plan:
        raise HTTPException(status_code=400, detail="Paket Free tidak tersedia.")
    if sub.plan_id == free_plan.id:
        raise HTTPException(status_code=400, detail="Anda sudah di paket Free — tidak ada yang dibatalkan.")

    old_name = sub.plan.name
    now = datetime.utcnow()
    sub.plan = free_plan
    sub.scheduled_plan_id = None         # batalkan jadwal downgrade bila ada
    sub.status = SubscriptionStatus.active  # bersihkan suspend/over_quota lama
    sub.suspended_at = None
    sub.over_quota_since = None
    sub.grace_until = None
    sub.cancelled_at = None
    sub.current_period_start = now
    sub.current_period_end = now + timedelta(days=30)

    if category == "hosting":
        usage_helper.recalculate_hosting(db, sub)
    else:
        usage_helper.recalculate(db, sub)
    usage_helper.evaluate_quota_status(db, sub)  # → over_quota bila pemakaian > limit Free

    log_activity(
        db,
        actor_user_id=current_user.id,
        action="SUBSCRIPTION_CANCELLED",
        description=f"Membatalkan paket {old_name} → kembali ke {free_plan.name}",
        target_type="SUBSCRIPTION",
        target_id=sub.id,
    )

    db.commit()
    db.refresh(sub)
    return {"message": f"Langganan diturunkan ke {free_plan.name}."}


@router.post("/schedule-downgrade", status_code=status.HTTP_200_OK)
def schedule_downgrade(
    body: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Jadwalkan downgrade ke paket lebih murah; berlaku di akhir periode."""
    plan = db.get(ServicePlan, body.plan_id)
    if not plan or not plan.is_active:
        raise HTTPException(status_code=404, detail="Paket tidak ditemukan")
    category = plan.category.value if hasattr(plan.category, "value") else str(plan.category)

    sub = _get_active_subscription(current_user.id, db, category=category)
    if not sub:
        raise HTTPException(status_code=404, detail="Tidak ada langganan aktif untuk dijadwalkan.")
    if plan.id == sub.plan_id:
        raise HTTPException(status_code=400, detail="Paket tujuan sama dengan paket saat ini.")
    if float(plan.price) >= float(sub.plan.price):
        raise HTTPException(
            status_code=400,
            detail="Penjadwalan hanya untuk downgrade (paket lebih murah). Untuk naik paket, gunakan Upgrade (langsung).",
        )

    sub.scheduled_plan_id = plan.id
    log_activity(
        db, actor_user_id=current_user.id, action="DOWNGRADE_SCHEDULED",
        description=f"Menjadwalkan downgrade ke {plan.name} pada akhir periode",
        target_type="SUBSCRIPTION", target_id=sub.id,
    )
    db.commit()
    db.refresh(sub)
    return {
        "message": f"Downgrade ke {plan.name} dijadwalkan pada akhir periode.",
        "effective_at": sub.current_period_end.isoformat(),
    }


@router.delete("/scheduled", status_code=status.HTTP_200_OK)
def cancel_scheduled(
    category: str = Query("storage"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Batalkan downgrade terjadwal."""
    sub = _get_active_subscription(current_user.id, db, category=category)
    if not sub or not sub.scheduled_plan_id:
        raise HTTPException(status_code=404, detail="Tidak ada perubahan terjadwal.")
    sub.scheduled_plan_id = None
    log_activity(
        db, actor_user_id=current_user.id, action="DOWNGRADE_SCHEDULE_CANCELLED",
        description="Membatalkan jadwal downgrade",
        target_type="SUBSCRIPTION", target_id=sub.id,
    )
    db.commit()
    return {"message": "Jadwal downgrade dibatalkan."}
