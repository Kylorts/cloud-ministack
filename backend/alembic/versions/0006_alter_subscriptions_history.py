"""alter_subscriptions_history

- Ubah unique index user_id jadi non-unique (agar bisa simpan riwayat subscription)
- Tambah status enum: over_quota, terminated

Revision ID: 0006
Revises: 0005
Create Date: 2026-06-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


OLD_STATUS = sa.Enum(
    "active", "pending_payment", "past_due",
    "suspended", "cancelled", "expired",
    name="subscriptionstatus",
)
NEW_STATUS = sa.Enum(
    "active", "pending_payment", "past_due", "over_quota",
    "suspended", "cancelled", "expired", "terminated",
    name="subscriptionstatus",
)


def _find_user_fk(conn) -> str | None:
    return conn.execute(sa.text(
        """
        SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'subscriptions'
          AND COLUMN_NAME = 'user_id'
          AND REFERENCED_TABLE_NAME = 'users'
        LIMIT 1
        """
    )).scalar()


def upgrade() -> None:
    conn = op.get_bind()

    # 1. Drop FK user_id (sementara) agar index unique-nya bisa diganti
    fk = _find_user_fk(conn)
    if fk:
        op.drop_constraint(fk, "subscriptions", type_="foreignkey")

    # 2. Ganti unique index → non-unique
    op.drop_index("ix_subscriptions_user_id", table_name="subscriptions")
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"], unique=False)

    # 3. Recreate FK user_id → users.id
    op.create_foreign_key(
        "fk_subscriptions_user_id", "subscriptions", "users",
        ["user_id"], ["id"], ondelete="CASCADE",
    )

    # 4. Tambah nilai enum baru pada kolom status
    op.alter_column(
        "subscriptions", "status",
        existing_type=OLD_STATUS, type_=NEW_STATUS,
        existing_nullable=False,
    )


def downgrade() -> None:
    conn = op.get_bind()

    op.alter_column(
        "subscriptions", "status",
        existing_type=NEW_STATUS, type_=OLD_STATUS,
        existing_nullable=False,
    )

    fk = _find_user_fk(conn)
    if fk:
        op.drop_constraint(fk, "subscriptions", type_="foreignkey")
    op.drop_index("ix_subscriptions_user_id", table_name="subscriptions")
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"], unique=True)
    op.create_foreign_key(
        "fk_subscriptions_user_id", "subscriptions", "users",
        ["user_id"], ["id"], ondelete="CASCADE",
    )
