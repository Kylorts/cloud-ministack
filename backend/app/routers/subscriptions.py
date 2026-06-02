from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.plan import ServicePlan
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User
from app.schemas.subscription import SubscribeRequest, SubscriptionResponse

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.get("/me", response_model=SubscriptionResponse)
def get_my_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Anda belum memiliki langganan aktif",
        )
    return sub


@router.post("", response_model=SubscriptionResponse, status_code=status.HTTP_201_CREATED)
def subscribe(
    body: SubscribeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    if existing and existing.status == SubscriptionStatus.active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Anda sudah memiliki langganan aktif. Batalkan terlebih dahulu sebelum memilih paket baru.",
        )

    plan = db.get(ServicePlan, body.plan_id)
    if not plan or not plan.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Paket tidak ditemukan",
        )

    now = datetime.utcnow()

    if existing:
        existing.plan_id = body.plan_id
        existing.status = SubscriptionStatus.active
        existing.current_period_start = now
        existing.current_period_end = now + timedelta(days=30)
        existing.cancelled_at = None
        existing.suspended_at = None
        db.commit()
        db.refresh(existing)
        return existing

    sub = Subscription(
        user_id=current_user.id,
        plan_id=body.plan_id,
        status=SubscriptionStatus.active,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


@router.delete("/me", status_code=status.HTTP_200_OK)
def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = db.query(Subscription).filter(Subscription.user_id == current_user.id).first()
    if not sub or sub.status != SubscriptionStatus.active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tidak ada langganan aktif untuk dibatalkan",
        )

    sub.status = SubscriptionStatus.cancelled
    sub.cancelled_at = datetime.utcnow()
    db.commit()
    return {"message": "Langganan berhasil dibatalkan"}
