"""create_access_keys

Revision ID: 0010
Revises: 0009
Create Date: 2026-06-07

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: Union[str, None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "access_keys",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("subscription_id", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(20), nullable=False, server_default="storage"),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("access_key_id", sa.String(128), nullable=False),
        sa.Column("secret_key_hash", sa.String(255), nullable=False),
        sa.Column("secret_key_last4", sa.String(8), nullable=False),
        sa.Column(
            "permission",
            sa.Enum("full", "read_only", name="keypermission"),
            nullable=False,
            server_default="full",
        ),
        sa.Column(
            "status",
            sa.Enum("active", "disabled", "revoked", "expired", name="keystatus"),
            nullable=False,
            server_default="active",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("last_used_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subscription_id"], ["subscriptions.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_access_keys_user_id", "access_keys", ["user_id"])
    op.create_index("ix_access_keys_category", "access_keys", ["category"])
    op.create_index("ix_access_keys_access_key_id", "access_keys", ["access_key_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_access_keys_access_key_id", table_name="access_keys")
    op.drop_index("ix_access_keys_category", table_name="access_keys")
    op.drop_index("ix_access_keys_user_id", table_name="access_keys")
    op.drop_table("access_keys")
