"""
PIN Transaksi — step-up auth untuk aksi kritis.

PIN bersifat OPSIONAL: jika user belum set PIN (pin_hash None),
aksi kritis tetap diizinkan tanpa PIN.

Jika user PUNYA PIN, aksi kritis WAJIB menyertakan PIN yang benar
melalui header `X-Transaction-PIN`.
"""
import re

from fastapi import HTTPException, status

from app.core.security import verify_password
from app.models.user import User

PIN_PATTERN = re.compile(r"^\d{6}$")


def validate_pin_format(pin: str) -> None:
    """PIN harus tepat 6 digit angka."""
    if not pin or not PIN_PATTERN.match(pin):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN harus terdiri dari 6 digit angka.",
        )


def require_pin(user: User, pin: str | None) -> None:
    """
    Dipanggil di awal endpoint aksi kritis.

    - Tidak punya PIN  → lolos (PIN opsional).
    - Punya PIN, tapi PIN tidak dikirim → 403 dengan kode PIN_REQUIRED.
    - Punya PIN, tapi salah            → 403 dengan kode PIN_INVALID.
    """
    if not user.pin_hash:
        return

    if not pin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "PIN_REQUIRED", "message": "Aksi ini memerlukan PIN Transaksi."},
        )

    if not verify_password(pin, user.pin_hash):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "PIN_INVALID", "message": "PIN Transaksi salah."},
        )
