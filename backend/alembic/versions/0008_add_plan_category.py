"""add_plan_category

Tambah kolom category (storage/hosting) ke service_plans & subscriptions.

Revision ID: 0008
Revises: 0007
Create Date: 2026-06-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "service_plans",
        sa.Column(
            "category",
            sa.Enum("storage", "hosting", name="plancategory"),
            nullable=False,
            server_default="storage",
        ),
    )
    op.add_column(
        "subscriptions",
        sa.Column("category", sa.String(20), nullable=False, server_default="storage"),
    )
    op.create_index("ix_subscriptions_category", "subscriptions", ["category"])


def downgrade() -> None:
    op.drop_index("ix_subscriptions_category", table_name="subscriptions")
    op.drop_column("subscriptions", "category")
    op.drop_column("service_plans", "category")
