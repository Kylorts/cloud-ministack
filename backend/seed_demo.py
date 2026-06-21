"""
Demo seed script — 3 user dengan skenario limit berbeda.

Cara menjalankan:
    docker exec cloud-ministack-backend-1 python seed_demo.py

Cara reset (hapus semua demo user lalu buat ulang):
    docker exec cloud-ministack-backend-1 python seed_demo.py --reset

Skenario:
    1. demo-bucket@iniawan.id  — Basic plan, 2/2 bucket (tidak bisa tambah bucket)
    2. demo-size@iniawan.id    — Lite plan, storage PENUH (tidak bisa upload apapun)
    3. demo-quota@iniawan.id   — Lite plan, storage 88% (warning, masih bisa upload kecil)

Password semua: demo123
"""

import sys
from datetime import datetime, timedelta
from app.database import SessionLocal
from app.models.user import User, UserRole, UserStatus
from app.models.plan import ServicePlan
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.storage_bucket import StorageBucket, BucketStatus, BucketVisibility
from app.models.storage_object import StorageObject, ObjectStatus
from app.models.usage_counter import UsageCounter
from app.core.security import hash_password
from app.core.ministack import get_s3_client, _ensure_bucket_exists
from app.core import usage as usage_helper

MB = 1_048_576
GB = 1_073_741_824

PLACEHOLDER = b"demo-placeholder"
DEMO_EMAILS = [
    "demo-bucket@iniawan.id",
    "demo-size@iniawan.id",
    "demo-quota@iniawan.id",
]


# ─── helpers ──────────────────────────────────────────────────────

def get_plan(db, name):
    plan = db.query(ServicePlan).filter(ServicePlan.name == name).first()
    if not plan:
        raise RuntimeError(f"Plan '{name}' tidak ditemukan. Jalankan seed.py terlebih dahulu.")
    return plan


def create_user(db, name, email):
    user = User(
        name=name,
        email=email,
        password_hash=hash_password("demo123"),
        role=UserRole.user,
        status=UserStatus.active,
    )
    db.add(user)
    db.flush()
    return user


def create_subscription(db, user_id, plan_id):
    now = datetime.utcnow()
    sub = Subscription(
        user_id=user_id,
        plan_id=plan_id,
        status=SubscriptionStatus.active,
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    db.add(sub)
    db.flush()
    return sub


def make_bucket(db, user_id, sub_id, display_name, internal_name, visibility=BucketVisibility.private):
    client = get_s3_client()
    _ensure_bucket_exists(client, internal_name)
    bucket = StorageBucket(
        user_id=user_id,
        subscription_id=sub_id,
        display_name=display_name,
        internal_name=internal_name,
        visibility=visibility,
        status=BucketStatus.active,
    )
    db.add(bucket)
    db.flush()
    return bucket


def make_object(db, bucket, user_id, filename, demo_size_bytes, content_type="application/octet-stream"):
    """Upload placeholder ke MiniStack, simpan demo size di DB."""
    client = get_s3_client()
    client.put_object(Bucket=bucket.internal_name, Key=filename, Body=PLACEHOLDER, ContentType=content_type)
    obj = StorageObject(
        bucket_id=bucket.id,
        user_id=user_id,
        object_key=filename,
        filename=filename,
        content_type=content_type,
        size_bytes=demo_size_bytes,
        status=ObjectStatus.available,
        uploaded_at=datetime.utcnow(),
        checksum="demo",
    )
    db.add(obj)
    return obj


# ─── reset ────────────────────────────────────────────────────────

def reset_demo(db):
    print("[Reset] Menghapus semua data demo...")
    for email in DEMO_EMAILS:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            continue

        bucket_ids = [
            b.id for b in db.query(StorageBucket.id)
            .filter(StorageBucket.user_id == user.id).all()
        ]

        # Urutan delete sesuai dependency (bulk + flush tiap langkah)
        if bucket_ids:
            db.query(StorageObject).filter(StorageObject.bucket_id.in_(bucket_ids)).delete(synchronize_session=False)
        db.query(StorageObject).filter(StorageObject.user_id == user.id).delete(synchronize_session=False)
        db.flush()
        db.query(StorageBucket).filter(StorageBucket.user_id == user.id).delete(synchronize_session=False)
        db.flush()
        db.query(UsageCounter).filter(UsageCounter.user_id == user.id).delete(synchronize_session=False)
        db.flush()
        db.query(Subscription).filter(Subscription.user_id == user.id).delete(synchronize_session=False)
        db.flush()
        db.delete(user)
        db.flush()
        print(f"  hapus {email}")
    db.commit()
    print("[Reset] Selesai.\n")


# ─── Skenario 1: Bucket Limit ─────────────────────────────────────
def seed_bucket_limit(db):
    print("[Skenario 1] Bucket Limit — Basic plan, 2/2 bucket")
    user = create_user(db, "Demo Bucket Limit", "demo-bucket@iniawan.id")
    plan = get_plan(db, "Storage Basic")   # bucket_limit = 2
    sub  = create_subscription(db, user.id, plan.id)

    b1 = make_bucket(db, user.id, sub.id, "project-assets",  f"u{user.id}-project-assets")
    b2 = make_bucket(db, user.id, sub.id, "backup-database", f"u{user.id}-backup-database")

    make_object(db, b1, user.id, "index.html",             int(0.4 * MB), "text/html")
    make_object(db, b1, user.id, "logo.png",               2 * MB,        "image/png")
    make_object(db, b1, user.id, "bundle.js",              5 * MB,        "application/javascript")
    make_object(db, b2, user.id, "backup-2026-06-01.sql", 10 * MB,        "application/octet-stream")
    make_object(db, b2, user.id, "backup-2026-05-01.sql",  8 * MB,        "application/octet-stream")

    db.flush()
    usage_helper.recalculate(db, sub)
    print(f"  ✓  {user.email} | 2 bucket dibuat → tombol buat bucket hilang")


# ─── Skenario 2: Storage Penuh ────────────────────────────────────
def seed_storage_full(db):
    print("[Skenario 2] Storage Penuh — Lite plan, 1GB/1GB (tidak bisa upload)")
    user = create_user(db, "Demo Storage Penuh", "demo-size@iniawan.id")
    plan = get_plan(db, "Storage Lite")    # storage_limit = 1GB
    sub  = create_subscription(db, user.id, plan.id)

    b = make_bucket(db, user.id, sub.id, "full-storage", f"u{user.id}-full-storage")

    # Total = 1GB persis → storage 100% penuh
    files = [
        ("archive-data-2025.zip",    300 * MB, "application/zip"),
        ("video-project-final.mp4",  280 * MB, "video/mp4"),
        ("database-backup-full.sql", 250 * MB, "application/octet-stream"),
        ("dataset-complete.csv",     int(49.5 * MB), "text/csv"),
        ("report-q4-2025.pdf",       int(49.5 * MB), "application/pdf"),
        ("assets-bundle.tar.gz",     int(49 * MB),   "application/gzip"),
        ("config-all.json",          int(45.5 * MB), "application/json"),
        ("readme.txt",               int(0.5 * MB),  "text/plain"),
    ]

    total = 0
    for fname, size, ctype in files:
        make_object(db, b, user.id, fname, size, ctype)
        total += size

    db.flush()
    usage_helper.recalculate(db, sub)
    pct = round(total / GB * 100)
    print(f"  ✓  {user.email} | {total // MB} MB / 1024 MB ({pct}%) → tidak bisa upload apapun")


# ─── Skenario 3: Quota Hampir Penuh ───────────────────────────────
def seed_quota_almost_full(db):
    print("[Skenario 3] Quota Hampir Penuh — Lite plan, 88% terpakai")
    user = create_user(db, "Demo Quota Hampir Penuh", "demo-quota@iniawan.id")
    plan = get_plan(db, "Storage Lite")
    sub  = create_subscription(db, user.id, plan.id)

    b = make_bucket(db, user.id, sub.id, "large-storage", f"u{user.id}-large-storage")

    # Total ~880MB = 88% dari 1GB
    files = [
        ("archive-project-2025.zip",   220 * MB, "application/zip"),
        ("database-dump-full.sql",     200 * MB, "application/octet-stream"),
        ("video-recording-01.mp4",     200 * MB, "video/mp4"),
        ("backup-images.tar.gz",       180 * MB, "application/gzip"),
        ("report-annual-2025.pdf",     int(49.5 * MB), "application/pdf"),
        ("dataset-training.csv",        90 * MB,        "text/csv"),
        ("config-backup.json",          int(0.5 * MB),  "application/json"),
        ("readme.md",                   int(0.02 * MB), "text/plain"),
    ]

    total = 0
    for fname, size, ctype in files:
        make_object(db, b, user.id, fname, size, ctype)
        total += size

    db.flush()
    usage_helper.recalculate(db, sub)
    pct = round(total / GB * 100)
    sisa = (GB - total) // MB
    print(f"  ✓  {user.email} | {total // MB} MB / 1024 MB ({pct}%) | sisa {sisa} MB")


# ─── Main ─────────────────────────────────────────────────────────

def seed():
    db = SessionLocal()
    try:
        seed_bucket_limit(db)
        seed_storage_full(db)
        seed_quota_almost_full(db)
        db.commit()
        print("\n✓ Semua demo data berhasil dibuat.")
        print("\nCredentials (password: demo123):")
        print("  demo-bucket@iniawan.id → Basic plan, 2/2 bucket (tidak bisa buat bucket baru)")
        print("  demo-size@iniawan.id   → Lite plan, storage PENUH (tidak bisa upload)")
        print("  demo-quota@iniawan.id  → Lite plan, 88% penuh (warning, sisa ~144 MB)")
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
            reset_demo(db)
        finally:
            db.close()

    seed()
