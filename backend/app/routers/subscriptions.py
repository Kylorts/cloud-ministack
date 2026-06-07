from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.activity import log_activity
from app.core.deps import get_current_user
from app.core.pin import require_pin
from app.core import usage as usage_helper
from app.database import get_db
from app.models.plan import ServicePlan
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

    # Enforcement "1 subscription aktif per kategori" di backend
    active = _get_active_subscription(current_user.id, db, category=category)
    if active and active.status == SubscriptionStatus.active:
        label = "Hosting" if category == "hosting" else "Storage"
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Anda sudah memiliki langganan {label} aktif. Batalkan terlebih dahulu sebelum memilih paket baru.",
        )

    now = datetime.utcnow()

    # Tutup subscription lama kategori yang sama yang belum final
    if active:
        active.status = SubscriptionStatus.terminated
        active.cancelled_at = now

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
    sub = _get_active_subscription(current_user.id, db, category=category)
    if not sub or sub.status != SubscriptionStatus.active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tidak ada langganan aktif untuk dibatalkan",
        )

    sub.status = SubscriptionStatus.cancelled
    sub.cancelled_at = datetime.utcnow()

    log_activity(
        db,
        actor_user_id=current_user.id,
        action="SUBSCRIPTION_CANCELLED",
        description="Membatalkan langganan",
        target_type="SUBSCRIPTION",
        target_id=sub.id,
    )

    db.commit()
    return {"message": "Langganan berhasil dibatalkan"}
