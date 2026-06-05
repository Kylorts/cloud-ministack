"""create_activity_logs

Revision ID: 0007
Revises: 0006
Create Date: 2026-06-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "activity_logs",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column(
            "actor_type",
            sa.Enum("user", "admin", "system", "midtrans", name="actortype"),
            nullable=False,
            server_default="user",
        ),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("target_type", sa.String(50), nullable=True),
        sa.Column("target_id", sa.BigInteger(), nullable=True),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_activity_logs_actor_user_id", "activity_logs", ["actor_user_id"])
    op.create_index("ix_activity_logs_created_at", "activity_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_activity_logs_created_at", table_name="activity_logs")
    op.drop_index("ix_activity_logs_actor_user_id", table_name="activity_logs")
    op.drop_table("activity_logs")
