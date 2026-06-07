from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.activity import log_activity
from app.core.deps import get_current_user
from app.core.pin import require_pin, validate_pin_format
from app.core.security import create_access_token, hash_password, verify_password
from app.database import get_db
from app.models.user import User, UserStatus
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    PinStatusResponse,
    RemovePinRequest,
    SetPinRequest,
    UserPublic,
    VerifyPinRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


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
