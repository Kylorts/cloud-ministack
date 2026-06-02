"""create_storage_objects

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "storage_objects",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("bucket_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("object_key", sa.String(1024), nullable=False),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("content_type", sa.String(127), nullable=True),
        sa.Column("size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("checksum", sa.String(255), nullable=True),
        sa.Column(
            "status",
            sa.Enum(
                "uploading", "available", "deleting", "deleted", "failed", "orphaned",
                name="objectstatus",
            ),
            nullable=False,
            server_default="uploading",
        ),
        sa.Column("uploaded_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["bucket_id"], ["storage_buckets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_storage_objects_bucket_id", "storage_objects", ["bucket_id"])
    op.create_index("ix_storage_objects_user_id", "storage_objects", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_storage_objects_user_id", table_name="storage_objects")
    op.drop_index("ix_storage_objects_bucket_id", table_name="storage_objects")
    op.drop_table("storage_objects")
