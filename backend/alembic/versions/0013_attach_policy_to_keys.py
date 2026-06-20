"""attach iam policy to access keys + seed full storage policy

Revision ID: 0013
Revises: 0012
Create Date: 2026-06-20

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: Union[str, None] = "0012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FULL_DOC = (
    '{\n  "Version": "2026-06-01",\n  "Statement": [\n'
    '    { "Effect": "Allow", "Action": "s3:*", "Resource": "*" }\n  ]\n}'
)


def upgrade() -> None:
    op.add_column(
        "access_keys",
        sa.Column("policy_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_access_keys_policy",
        "access_keys",
        "iam_policies",
        ["policy_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Tambah satu policy contoh "allow-all storage" agar user punya opsi penuh.
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
            "name": "FullStorageAccess",
            "description": "Akses penuh storage (baca, tulis, hapus) ke semua bucket.",
            "policy_type": "system",
            "document": FULL_DOC,
            "created_by": "Admin Utama",
        },
    ])


def downgrade() -> None:
    op.drop_constraint("fk_access_keys_policy", "access_keys", type_="foreignkey")
    op.drop_column("access_keys", "policy_id")
