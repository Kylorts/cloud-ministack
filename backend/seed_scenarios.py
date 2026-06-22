"""
Seed demo SKENARIO SIKLUS LANGGANAN — 3 keadaan untuk demonstrasi.

Cara jalan:
    docker compose exec backend python seed_scenarios.py
Reset (hapus 3 akun skenario lalu buat ulang):
    docker compose exec backend python seed_scenarios.py --reset

Skenario (password semua: demo123):
  1. demo-nunggak@iniawan.id  — Klien NUNGGAK: langganan status `past_due`.
     Admin melihatnya terkunci; begitu klien ini login & membuka Langganan,
     OTOMATIS turun ke paket Free (apply_past_due_fallback).
  2. demo-suspend@iniawan.id  — Klien DISUSPEND karena nunggak lewat batas:
     langganan status `suspended` (grace habis 7 hari lalu, suspended kemarin).
  3. demo-banned@iniawan.id   — Akun DISUSPEND ADMIN: user.status = suspended
     (login diblokir 403), langganan tetap aktif.

Catatan: pembayaran DI-DESCOPE, jadi `past_due`/"nunggak" tak terjadi otomatis —
state ini diset langsung untuk keperluan demo (di dunia nyata datang dari Midtrans).
"""
import sys
from datetime import datetime, timedelta

from app.database import SessionLocal
# import semua model agar relationship resolve di skrip standalone
from app.models import (  # noqa: F401
    plan, subscription, user, access_key, iam_policy,
    storage_bucket, storage_object, usage_counter, activity_log,
    static_site, static_site_deployment,
)
from app.models.user import User, UserRole, UserStatus
from app.models.plan import ServicePlan
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.activity_log import ActivityLog
from app.core.security import hash_password

EMAILS = ["demo-nunggak@iniawan.id", "demo-suspend@iniawan.id", "demo-banned@iniawan.id"]


def get_plan(db, name):
    p = db.query(ServicePlan).filter(ServicePlan.name == name).first()
    if not p:
        raise RuntimeError(f"Plan '{name}' tidak ada. Jalankan seed.py dulu.")
    return p


def mk_user(db, name, email, status=UserStatus.active):
    u = User(name=name, email=email, password_hash=hash_password("demo123"),
             role=UserRole.user, status=status)
    db.add(u)
    db.flush()
    return u


def mk_sub(db, user_id, plan_id, **kw):
    now = datetime.utcnow()
    sub = Subscription(
        user_id=user_id, plan_id=plan_id, category="storage",
        current_period_start=now - timedelta(days=30),
        current_period_end=now + timedelta(days=30),
        status=SubscriptionStatus.active,
    )
    for k, v in kw.items():
        setattr(sub, k, v)
    db.add(sub)
    db.flush()
    return sub


def reset(db):
    print("[Reset] hapus akun skenario...")
    for email in EMAILS:
        u = db.query(User).filter(User.email == email).first()
        if not u:
            continue
        db.query(Subscription).filter(Subscription.user_id == u.id).delete(synchronize_session=False)
        db.query(ActivityLog).filter(ActivityLog.actor_user_id == u.id).delete(synchronize_session=False)
        db.flush()
        db.delete(u)
        print(f"  hapus {email}")
    db.commit()


def seed():
    db = SessionLocal()
    try:
        now = datetime.utcnow()
        lite = get_plan(db, "Storage Lite")

        # 1) Klien NUNGGAK (past_due, periode lewat 5 hari)
        u1 = mk_user(db, "Demo Klien Nunggak", "demo-nunggak@iniawan.id")
        mk_sub(db, u1.id, lite.id,
               status=SubscriptionStatus.past_due,
               current_period_start=now - timedelta(days=35),
               current_period_end=now - timedelta(days=5))

        # 2) Klien DISUSPEND karena nunggak lewat batas grace
        u2 = mk_user(db, "Demo Klien Disuspend (Nunggak)", "demo-suspend@iniawan.id")
        mk_sub(db, u2.id, lite.id,
               status=SubscriptionStatus.suspended,
               current_period_start=now - timedelta(days=40),
               current_period_end=now - timedelta(days=10),
               over_quota_since=now - timedelta(days=14),
               grace_until=now - timedelta(days=7),
               suspended_at=now - timedelta(days=1))

        # 3) Akun DISUSPEND ADMIN (login diblokir), langganan tetap aktif
        u3 = mk_user(db, "Demo Akun Disuspend Admin", "demo-banned@iniawan.id",
                     status=UserStatus.suspended)
        mk_sub(db, u3.id, lite.id, status=SubscriptionStatus.active)

        db.commit()
        print("\n✓ 3 skenario dibuat (password: demo123):")
        print("  demo-nunggak@iniawan.id  → langganan PAST_DUE (nunggak 5 hari)")
        print("  demo-suspend@iniawan.id  → langganan SUSPENDED (nunggak lewat grace)")
        print("  demo-banned@iniawan.id   → AKUN suspended admin (login diblokir 403)")
    except Exception as e:
        db.rollback()
        print(f"✗ ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    if "--reset" in sys.argv:
        db = SessionLocal()
        try:
            reset(db)
        finally:
            db.close()
    seed()
