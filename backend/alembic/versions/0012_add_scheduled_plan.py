"""add_scheduled_plan_id_to_subscriptions

Revision ID: 0012
Revises: 0011
Create Date: 2026-06-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: Union[str, None] = "0011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "subscriptions",
        sa.Column("scheduled_plan_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_subscriptions_scheduled_plan",
        "subscriptions", "service_plans",
        ["scheduled_plan_id"], ["id"],
    )


def downgrade() -> None:
    op.drop_constraint("fk_subscriptions_scheduled_plan", "subscriptions", type_="foreignkey")
    op.drop_column("subscriptions", "scheduled_plan_id")
