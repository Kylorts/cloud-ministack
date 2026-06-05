from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.activity import log_activity
from app.core.deps import get_current_user
from app.core.security import create_access_token, verify_password
from app.database import get_db
from app.models.user import User, UserStatus
from app.schemas.auth import LoginRequest, LoginResponse, UserPublic

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
