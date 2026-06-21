"""create_static_hosting

Tabel static_sites & static_site_deployments.

Revision ID: 0009
Revises: 0008
Create Date: 2026-06-05

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "static_sites",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("subscription_id", sa.Integer(), nullable=False),
        sa.Column("site_name", sa.String(255), nullable=False),
        sa.Column("slug", sa.String(255), nullable=False),
        sa.Column("domain", sa.String(255), nullable=True),
        sa.Column(
            "status",
            sa.Enum("active", "suspended", "deleted", "failed", name="sitestatus"),
            nullable=False,
            server_default="active",
        ),
        sa.Column("active_deployment_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("suspended_at", sa.DateTime(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["subscription_id"], ["subscriptions.id"]),
    )
    op.create_index("ix_static_sites_user_id", "static_sites", ["user_id"])
    op.create_index("ix_static_sites_slug", "static_sites", ["slug"], unique=True)

    op.create_table(
        "static_site_deployments",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("site_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("source_bucket_id", sa.Integer(), nullable=True),
        sa.Column("deployment_ref", sa.String(64), nullable=False),
        sa.Column("deployment_path", sa.String(512), nullable=False),
        sa.Column(
            "status",
            sa.Enum("pending", "deploying", "success", "failed", "rolled_back", name="deploymentstatus"),
            nullable=False,
            server_default="pending",
        ),
        sa.Column("file_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("deployed_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["site_id"], ["static_sites.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_bucket_id"], ["storage_buckets.id"]),
    )
    op.create_index("ix_ssd_site_id", "static_site_deployments", ["site_id"])
    op.create_index("ix_ssd_deployment_ref", "static_site_deployments", ["deployment_ref"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_ssd_deployment_ref", table_name="static_site_deployments")
    op.drop_index("ix_ssd_site_id", table_name="static_site_deployments")
    op.drop_table("static_site_deployments")
    op.drop_index("ix_static_sites_slug", table_name="static_sites")
    op.drop_index("ix_static_sites_user_id", table_name="static_sites")
    op.drop_table("static_sites")
