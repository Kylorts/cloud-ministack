"""create_plans_and_subscriptions

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "service_plans",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Numeric(12, 2), nullable=False),
        sa.Column(
            "billing_period",
            sa.Enum("monthly", name="billingperiod"),
            nullable=False,
            server_default="monthly",
        ),
        sa.Column("storage_limit_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("max_file_size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("bandwidth_limit_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("bucket_limit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("static_site_limit", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("access_key_limit", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "subscriptions",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("plan_id", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "active",
                "pending_payment",
                "past_due",
                "suspended",
                "cancelled",
                "expired",
                name="subscriptionstatus",
            ),
            nullable=False,
            server_default="active",
        ),
        sa.Column("current_period_start", sa.DateTime(), nullable=False),
        sa.Column("current_period_end", sa.DateTime(), nullable=False),
        sa.Column("grace_until", sa.DateTime(), nullable=True),
        sa.Column("over_quota_since", sa.DateTime(), nullable=True),
        sa.Column("suspended_at", sa.DateTime(), nullable=True),
        sa.Column("cancelled_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["plan_id"], ["service_plans.id"]),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_subscriptions_user_id", table_name="subscriptions")
    op.drop_table("subscriptions")
    op.drop_table("service_plans")
