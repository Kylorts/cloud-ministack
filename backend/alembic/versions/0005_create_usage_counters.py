"""create_usage_counters

Revision ID: 0005
Revises: 0004
Create Date: 2026-06-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "usage_counters",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("subscription_id", sa.Integer(), nullable=False),
        sa.Column("storage_used_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("bandwidth_used_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("bucket_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("object_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("static_site_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("access_key_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("period_start", sa.DateTime(), nullable=False),
        sa.Column("period_end", sa.DateTime(), nullable=False),
        sa.Column("last_recalculated_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subscription_id"], ["subscriptions.id"], ondelete="CASCADE"),
    )
    op.create_index(
        "ix_usage_counters_subscription_id",
        "usage_counters",
        ["subscription_id"],
        unique=True,
    )
    op.create_index("ix_usage_counters_user_id", "usage_counters", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_usage_counters_user_id", table_name="usage_counters")
    op.drop_index("ix_usage_counters_subscription_id", table_name="usage_counters")
    op.drop_table("usage_counters")
