import hashlib
import secrets
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.config import settings
from app.core.activity import log_activity
from app.core.deps import get_current_user
from app.core.email import reset_email_html, send_email
from app.core.pin import require_pin, validate_pin_format
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.password_reset import PasswordReset
from app.models.plan import PlanCategory, ServicePlan
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User, UserRole, UserStatus
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    LoginResponse,
    PinStatusResponse,
    RegisterRequest,
    RemovePinRequest,
    ResetPasswordRequest,
    SetPinRequest,
    UserPublic,
    VerifyPinRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _enroll_free_tier(db: Session, user_id: int) -> None:
    """Aktifkan tier Free (Rp0) untuk storage & hosting bagi akun baru.

    Mirip AWS Free Tier: akun langsung punya baseline gratis tanpa harus
    memilih paket dulu. Tidak menggagalkan registrasi bila paket Free tak ada.
    """
    now = datetime.utcnow()
    for category in (PlanCategory.storage, PlanCategory.hosting):
        plan = (
            db.query(ServicePlan)
            .filter(
                ServicePlan.category == category,
                ServicePlan.price == 0,
                ServicePlan.is_active.is_(True),
            )
            .order_by(ServicePlan.id.asc())
            .first()
        )
        if not plan:
            continue
        db.add(Subscription(
            user_id=user_id,
            plan_id=plan.id,
            category=category.value,
            status=SubscriptionStatus.active,
            current_period_start=now,
            current_period_end=now + timedelta(days=30),
        ))


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user: User | None = db.query(User).filter(User.email == body.email).first()

    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email atau kata sandi salah",
        )

    if user.status == UserStatus.suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun Anda telah ditangguhkan",
        )

    if user.status == UserStatus.deleted:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akun tidak ditemukan",
        )

    token = create_access_token({"sub": str(user.id), "role": user.role.value})

    log_activity(
        db,
        actor_user_id=user.id,
        action="USER_LOGIN",
        description="Berhasil masuk ke akun",
        ip_address=request.client.host if request.client else None,
        commit=True,
    )

    return LoginResponse(
        access_token=token,
        user=UserPublic.model_validate(user),
    )


# ──────────────── Lupa / reset kata sandi (via email) ────────────────
def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


_GENERIC_FORGOT = {
    "message": "Jika email terdaftar, tautan untuk mengatur ulang kata sandi telah dikirim."
}


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = str(body.email).lower().strip()
    user = db.query(User).filter(User.email == email).first()
    # Respons selalu generik → tak bisa dipakai menebak email terdaftar (enumeration).
    if user is None or user.status != UserStatus.active:
        return _GENERIC_FORGOT

    # Batalkan token lama yang belum dipakai, lalu buat satu yang baru.
    db.query(PasswordReset).filter(
        PasswordReset.user_id == user.id, PasswordReset.used_at.is_(None)
    ).delete(synchronize_session=False)

    raw = secrets.token_urlsafe(32)
    db.add(PasswordReset(
        user_id=user.id,
        token_hash=_hash_token(raw),
        expires_at=datetime.utcnow() + timedelta(minutes=settings.RESET_TOKEN_TTL_MINUTES),
    ))
    db.commit()

    link = f"{settings.APP_BASE_URL}/reset-sandi?token={raw}"
    try:
        send_email(
            user.email,
            "Atur ulang kata sandi JadeStack",
            reset_email_html(user.name, link, settings.RESET_TOKEN_TTL_MINUTES),
        )
    except Exception:
        # Kegagalan kirim email tak boleh bocor ke klien (info & UX).
        pass

    log_activity(
        db, actor_user_id=user.id, action="PASSWORD_RESET_REQUESTED",
        description="Meminta tautan reset kata sandi", commit=True,
    )
    return _GENERIC_FORGOT


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    pr = (
        db.query(PasswordReset)
        .filter(PasswordReset.token_hash == _hash_token(body.token),
                PasswordReset.used_at.is_(None))
        .first()
    )
    if pr is None or pr.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tautan reset tidak valid atau telah kedaluwarsa.",
        )

    user = db.get(User, pr.user_id)
    if user is None or user.status != UserStatus.active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Akun tidak dapat diatur ulang.",
        )

    user.password_hash = hash_password(body.new_password)
    now = datetime.utcnow()
    # Tandai token ini + semua token lain user sebagai terpakai.
    db.query(PasswordReset).filter(
        PasswordReset.user_id == user.id, PasswordReset.used_at.is_(None)
    ).update({"used_at": now}, synchronize_session=False)

    log_activity(
        db, actor_user_id=user.id, action="PASSWORD_RESET_COMPLETED",
        description="Kata sandi berhasil diatur ulang", commit=False,
    )
    db.commit()
    return {"message": "Kata sandi berhasil diperbarui. Silakan masuk."}


@router.post("/register", response_model=LoginResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    email = str(body.email).lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email sudah terdaftar. Silakan masuk atau gunakan email lain.",
        )

    user = User(
        name=body.name.strip(),
        email=email,
        password_hash=hash_password(body.password),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db.add(user)
    db.flush()

    # Akun baru langsung dapat tier Free (storage + hosting) — baseline gratis.
    _enroll_free_tier(db, user.id)

    token = create_access_token({"sub": str(user.id), "role": user.role.value})
    log_activity(
        db,
        actor_user_id=user.id,
        action="USER_REGISTERED",
        description="Mendaftar akun baru",
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    db.refresh(user)
    return LoginResponse(access_token=token, user=UserPublic.model_validate(user))


@router.get("/me", response_model=UserPublic)
def me(current_user: User = Depends(get_current_user)):
    return UserPublic.model_validate(current_user)


# ── Tahap 1: Ganti Password ─────────────────────────────────────────

@router.post("/change-password", status_code=status.HTTP_200_OK)
def change_password(
    body: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_transaction_pin: str | None = Header(default=None, alias="X-Transaction-PIN"),
):
    # Verifikasi password lama
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kata sandi saat ini salah.",
        )

    # Ganti password termasuk aksi kritis → minta PIN bila user punya PIN
    require_pin(current_user, x_transaction_pin)

    if body.new_password == body.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kata sandi baru tidak boleh sama dengan yang lama.",
        )

    current_user.password_hash = hash_password(body.new_password)

    log_activity(
        db,
        actor_user_id=current_user.id,
        action="PASSWORD_CHANGED",
        description="Mengubah kata sandi akun",
        target_type="USER",
        target_id=current_user.id,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return {"message": "Kata sandi berhasil diubah."}


# ── Tahap 2: PIN Transaksi ──────────────────────────────────────────

@router.get("/pin/status", response_model=PinStatusResponse)
def pin_status(current_user: User = Depends(get_current_user)):
    return PinStatusResponse(has_pin=bool(current_user.pin_hash))


@router.post("/pin", status_code=status.HTTP_200_OK)
def set_pin(
    body: SetPinRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Set / ubah / reset PIN selalu butuh verifikasi password
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kata sandi salah.",
        )

    validate_pin_format(body.pin)

    is_new = not current_user.pin_hash
    current_user.pin_hash = hash_password(body.pin)

    log_activity(
        db,
        actor_user_id=current_user.id,
        action="PIN_SET" if is_new else "PIN_CHANGED",
        description="Mengatur PIN Transaksi" if is_new else "Mengubah PIN Transaksi",
        target_type="USER",
        target_id=current_user.id,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return {"message": "PIN Transaksi berhasil disimpan."}


@router.post("/pin/verify", status_code=status.HTTP_200_OK)
def verify_pin(
    body: VerifyPinRequest,
    current_user: User = Depends(get_current_user),
):
    if not current_user.pin_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Anda belum mengatur PIN Transaksi.",
        )
    if not verify_password(body.pin, current_user.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "PIN_INVALID", "message": "PIN Transaksi salah."},
        )
    return {"message": "PIN benar."}


@router.delete("/pin", status_code=status.HTTP_200_OK)
def remove_pin(
    body: RemovePinRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.pin_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Anda belum mengatur PIN Transaksi.",
        )
    if not verify_password(body.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kata sandi salah.",
        )

    current_user.pin_hash = None
    log_activity(
        db,
        actor_user_id=current_user.id,
        action="PIN_REMOVED",
        description="Menonaktifkan PIN Transaksi",
        target_type="USER",
        target_id=current_user.id,
        ip_address=request.client.host if request.client else None,
    )
    db.commit()
    return {"message": "PIN Transaksi berhasil dinonaktifkan."}
