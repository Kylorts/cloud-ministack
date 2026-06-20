"""create_iam_policies

Revision ID: 0011
Revises: 0010
Create Date: 2026-06-13

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: Union[str, None] = "0010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

READONLY_DOC = (
    '{\n  "Version": "2026-06-01",\n  "Statement": [\n'
    '    { "Effect": "Allow", "Action": "s3:Get*", "Resource": "*" }\n  ]\n}'
)
HOSTING_DOC = (
    '{\n  "Version": "2026-06-01",\n  "Statement": [\n'
    '    { "Effect": "Allow", "Action": "hosting:*", "Resource": "*" }\n  ]\n}'
)


def upgrade() -> None:
    op.create_table(
        "iam_policies",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "policy_type",
            sa.Enum("system", "custom", name="policytype"),
            nullable=False,
            server_default="custom",
        ),
        sa.Column("document", sa.Text(), nullable=False),
        sa.Column("created_by", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )

    policies = sa.table(
        "iam_policies",
        sa.column("name", sa.String),
        sa.column("description", sa.Text),
        sa.column("policy_type", sa.String),
        sa.column("document", sa.Text),
        sa.column("created_by", sa.String),
    )
    op.bulk_insert(policies, [
        {
            "name": "ReadOnlyStorage",
            "description": "Memberikan akses baca (GET) ke seluruh object storage.",
            "policy_type": "system",
            "document": READONLY_DOC,
            "created_by": "Admin Utama",
        },
        {
            "name": "FullAccessHosting",
            "description": "Memberikan akses penuh untuk deploy situs statis.",
            "policy_type": "custom",
            "document": HOSTING_DOC,
            "created_by": "Administrator",
        },
    ])


def downgrade() -> None:
    op.drop_table("iam_policies")
