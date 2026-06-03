"""
Seed script: insert default users and service plans.
Run: python seed.py
"""
from app.database import SessionLocal
from app.models.user import User, UserRole, UserStatus
from app.models.plan import ServicePlan, BillingPeriod
from app.models.subscription import Subscription       # noqa: F401 — wajib agar relasi SQLAlchemy resolve
from app.models.storage_bucket import StorageBucket    # noqa: F401
from app.models.storage_object import StorageObject    # noqa: F401
from app.core.security import hash_password

# 1 GB  = 1_073_741_824 bytes
# 1 MB  = 1_048_576 bytes

USER_SEEDS = [
    {
        "name": "Administrator",
        "email": "admin@iniawan.id",
        "password": "admin123",
        "role": UserRole.admin,
    },
    {
        "name": "Dika",
        "email": "dika@iniawan.id",
        "password": "user123",
        "role": UserRole.user,
    },
]

PLAN_SEEDS = [
    {
        "name": "Storage Lite",
        "description": "Paket penyimpanan dasar untuk kebutuhan personal.",
        "price": 5000.00,
        "billing_period": BillingPeriod.monthly,
        "storage_limit_bytes": 1 * 1_073_741_824,       # 1 GB
        "max_file_size_bytes": 50 * 1_048_576,           # 50 MB
        "bandwidth_limit_bytes": 100 * 1_048_576,        # 100 MB
        "bucket_limit": 1,
        "static_site_limit": 0,
        "access_key_limit": 1,
    },
    {
        "name": "Storage Basic",
        "description": "Paket penyimpanan untuk kebutuhan tim kecil.",
        "price": 10000.00,
        "billing_period": BillingPeriod.monthly,
        "storage_limit_bytes": 2 * 1_073_741_824,        # 2 GB
        "max_file_size_bytes": 100 * 1_048_576,           # 100 MB
        "bandwidth_limit_bytes": 300 * 1_048_576,         # 300 MB
        "bucket_limit": 2,
        "static_site_limit": 0,
        "access_key_limit": 2,
    },
    {
        "name": "Storage Plus",
        "description": "Paket penyimpanan untuk kebutuhan bisnis yang lebih besar.",
        "price": 20000.00,
        "billing_period": BillingPeriod.monthly,
        "storage_limit_bytes": 3 * 1_073_741_824,        # 3 GB
        "max_file_size_bytes": 250 * 1_048_576,           # 250 MB
        "bandwidth_limit_bytes": 1 * 1_073_741_824,       # 1 GB
        "bucket_limit": 3,
        "static_site_limit": 0,
        "access_key_limit": 3,
    },
]


def seed_users(db):
    inserted = 0
    for data in USER_SEEDS:
        exists = db.query(User).filter(User.email == data["email"]).first()
        if exists:
            print(f"  skip  {data['email']} (sudah ada)")
            continue
        user = User(
            name=data["name"],
            email=data["email"],
            password_hash=hash_password(data["password"]),
            role=data["role"],
            status=UserStatus.active,
        )
        db.add(user)
        inserted += 1
        print(f"  +     {data['email']} ({data['role'].value})")
    return inserted


def seed_plans(db):
    inserted = 0
    for data in PLAN_SEEDS:
        exists = db.query(ServicePlan).filter(ServicePlan.name == data["name"]).first()
        if exists:
            print(f"  skip  {data['name']} (sudah ada)")
            continue
        plan = ServicePlan(**data)
        db.add(plan)
        inserted += 1
        print(f"  +     {data['name']} (Rp{data['price']:,.0f}/bulan)")
    return inserted


def seed():
    db = SessionLocal()
    try:
        print("\n[Users]")
        u = seed_users(db)

        print("\n[Service Plans]")
        p = seed_plans(db)

        db.commit()
        print(f"\nSelesai — {u} user, {p} plan ditambahkan.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
