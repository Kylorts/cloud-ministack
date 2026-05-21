"""
Seed script: insert default admin and regular user.
Run: python seed.py
"""
from app.database import SessionLocal
from app.models.user import User, UserRole, UserStatus
from app.core.security import hash_password

SEEDS = [
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


def seed():
    db = SessionLocal()
    try:
        inserted = 0
        for data in SEEDS:
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

        db.commit()
        print(f"\nSelesai — {inserted} user ditambahkan.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
