import secrets
import string
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.activity import log_activity
from app.core.deps import get_current_user
from app.core.pin import require_pin
from app.core.security import hash_password
from app.database import get_db
from app.models.access_key import AccessKey, KeyPermission, KeyStatus
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User
from app.schemas.access_key import (
    AccessKeyCreatedResponse, AccessKeyCreateRequest, AccessKeyResponse,
)

router = APIRouter(prefix="/access-keys", tags=["access-keys"])

MINISTACK_PUBLIC_ENDPOINT = "http://localhost:4566"
ACCESS_STATUSES = [
    SubscriptionStatus.active,
    SubscriptionStatus.over_quota,
    SubscriptionStatus.suspended,
]


def _get_sub(user_id: int, category: str, db: Session) -> Subscription:
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user_id,
            Subscription.category == category,
            Subscription.status.in_(ACCESS_STATUSES),
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )
    if not sub:
        label = "Hosting" if category == "hosting" else "Storage"
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Anda belum memiliki langganan {label} aktif. Pilih paket {label} terlebih dahulu.",
        )
    return sub


def _gen_access_key_id() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "AKIAJADE" + "".join(secrets.choice(alphabet) for _ in range(12))


def _gen_secret() -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(40))


@router.get("", response_model=list[AccessKeyResponse])
def list_keys(
    category: str = Query("storage"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Tidak wajib punya subscription untuk sekadar melihat daftar (bisa kosong)
    keys = (
        db.query(AccessKey)
        .filter(
            AccessKey.user_id == current_user.id,
            AccessKey.category == category,
            AccessKey.status != KeyStatus.revoked,
        )
        .order_by(AccessKey.created_at.desc())
        .all()
    )
    # sertakan juga yang revoked di urutan bawah (untuk riwayat)
    revoked = (
        db.query(AccessKey)
        .filter(
            AccessKey.user_id == current_user.id,
            AccessKey.category == category,
            AccessKey.status == KeyStatus.revoked,
        )
        .order_by(AccessKey.created_at.desc())
        .all()
    )
    return keys + revoked


@router.post("", response_model=AccessKeyCreatedResponse, status_code=status.HTTP_201_CREATED)
def create_key(
    body: AccessKeyCreateRequest,
    category: str = Query("storage"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_sub(current_user.id, category, db)

    # OVER_QUOTA / suspended → tidak boleh tambah kunci
    if sub.status == SubscriptionStatus.over_quota:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kuota terlampaui (OVER_QUOTA). Tidak bisa membuat access key baru.",
        )
    if sub.status == SubscriptionStatus.suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Langganan disuspend. Tidak bisa membuat access key baru.",
        )

    # Cek limit access key dari paket
    active_count = (
        db.query(AccessKey)
        .filter(
            AccessKey.user_id == current_user.id,
            AccessKey.category == category,
            AccessKey.status.in_([KeyStatus.active, KeyStatus.disabled]),
        )
        .count()
    )
    if active_count >= sub.plan.access_key_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Batas access key paket Anda adalah {sub.plan.access_key_limit}. "
                   f"Cabut kunci lama atau upgrade paket.",
        )

    # Generate
    while True:
        access_key_id = _gen_access_key_id()
        if not db.query(AccessKey).filter(AccessKey.access_key_id == access_key_id).first():
            break
    secret = _gen_secret()

    key = AccessKey(
        user_id=current_user.id,
        subscription_id=sub.id,
        category=category,
        name=(body.name or None),
        access_key_id=access_key_id,
        secret_key_hash=hash_password(secret),
        secret_key_last4=secret[-4:],
        permission=KeyPermission(body.permission),
        status=KeyStatus.active,
    )
    db.add(key)
    db.flush()

    log_activity(
        db,
        actor_user_id=current_user.id,
        action="ACCESS_KEY_CREATED",
        description=f"Membuat access key ({category}){' - ' + body.name if body.name else ''}",
        target_type="ACCESS_KEY",
        target_id=key.id,
    )
    db.commit()
    db.refresh(key)

    base = AccessKeyResponse.model_validate(key).model_dump()
    return AccessKeyCreatedResponse(
        **base,
        secret_key=secret,
        mc_command=f"mc alias set myministack {MINISTACK_PUBLIC_ENDPOINT} {access_key_id} {secret}",
    )


@router.post("/{key_id}/revoke", status_code=status.HTTP_200_OK)
def revoke_key(
    key_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_transaction_pin: str | None = Header(default=None, alias="X-Transaction-PIN"),
):
    require_pin(current_user, x_transaction_pin)

    key = db.query(AccessKey).filter(
        AccessKey.id == key_id,
        AccessKey.user_id == current_user.id,
    ).first()
    if not key:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Access key tidak ditemukan")
    if key.status == KeyStatus.revoked:
        raise HTTPException(status_code=400, detail="Kunci sudah dicabut")

    key.status = KeyStatus.revoked
    key.revoked_at = datetime.utcnow()

    log_activity(
        db,
        actor_user_id=current_user.id,
        action="ACCESS_KEY_REVOKED",
        description=f"Mencabut access key {key.access_key_id}",
        target_type="ACCESS_KEY",
        target_id=key.id,
    )
    db.commit()
    return {"message": "Access key berhasil dicabut"}
