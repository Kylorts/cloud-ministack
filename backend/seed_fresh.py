"""
Seed user "polos" — tanpa langganan apa pun.

User ini tidak punya subscription storage/hosting, tidak punya bucket,
situs, maupun access key. Berguna untuk menguji alur onboarding /
state kosong (belum pilih paket).

Cara menjalankan:
    docker exec cloud-ministack-backend-1 python seed_fresh.py

Cara reset (hapus user fresh lalu buat ulang):
    docker exec cloud-ministack-backend-1 python seed_fresh.py --reset

Credentials:
    demo-fresh@iniawan.id  /  demo123
"""

import sys

# Import semua model agar relationship SQLAlchemy ter-resolve
from app.models import (  # noqa: F401
    user, plan, subscription, storage_bucket, storage_object,
    usage_counter, static_site, static_site_deployment,
    activity_log, access_key,
)
from app.database import SessionLocal
from app.models.user import User, UserRole, UserStatus
from app.core.security import hash_password

FRESH_EMAIL = "demo-fresh@iniawan.id"
FRESH_NAME = "Demo Tanpa Langganan"
FRESH_PASSWORD = "demo123"


def reset_fresh(db):
    u = db.query(User).filter(User.email == FRESH_EMAIL).first()
    if u:
        db.delete(u)
        db.commit()
        print(f"[Reset] Hapus {FRESH_EMAIL}")
    else:
        print(f"[Reset] {FRESH_EMAIL} tidak ada, lewati.")


def seed():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == FRESH_EMAIL).first()
        if existing:
            print(f"User {FRESH_EMAIL} sudah ada (id={existing.id}). "
                  f"Jalankan dengan --reset untuk membuat ulang.")
            return

        u = User(
            name=FRESH_NAME,
            email=FRESH_EMAIL,
            password_hash=hash_password(FRESH_PASSWORD),
            role=UserRole.user,
            status=UserStatus.active,
        )
        db.add(u)
        db.commit()
        print("\n✓ User polos berhasil dibuat (tanpa langganan apa pun).")
        print(f"\nCredentials:\n  {FRESH_EMAIL}  /  {FRESH_PASSWORD}")
        print("  → tidak ada subscription, bucket, situs, atau access key.")
    except Exception as e:
        db.rollback()
        print(f"\n✗ ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    if "--reset" in sys.argv:
        db = SessionLocal()
        try:
            reset_fresh(db)
        finally:
            db.close()
    seed()
