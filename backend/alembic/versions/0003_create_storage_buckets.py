"""create_storage_buckets

Revision ID: 0003
Revises: 0002
Create Date: 2026-06-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "storage_buckets",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("subscription_id", sa.Integer(), nullable=False),
        sa.Column("display_name", sa.String(255), nullable=False),
        sa.Column("internal_name", sa.String(255), nullable=False),
        sa.Column(
            "visibility",
            sa.Enum("private", "public", name="bucketvisibility"),
            nullable=False,
            server_default="private",
        ),
        sa.Column(
            "status",
            sa.Enum("creating", "active", "deleting", "deleted", "failed", name="bucketstatus"),
            nullable=False,
            server_default="creating",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subscription_id"], ["subscriptions.id"]),
    )
    op.create_index("ix_storage_buckets_internal_name", "storage_buckets", ["internal_name"], unique=True)
    op.create_index("ix_storage_buckets_user_id", "storage_buckets", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_storage_buckets_user_id", table_name="storage_buckets")
    op.drop_index("ix_storage_buckets_internal_name", table_name="storage_buckets")
    op.drop_table("storage_buckets")
