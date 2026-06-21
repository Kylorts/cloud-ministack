"""refine ReadOnlyStorage policy document for enforcement (add s3:List*)

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-20

Dokumen ReadOnlyStorage semula hanya mengizinkan `s3:Get*` (saat policy masih
manajemen-saja). Sejak enforcement aktif di /s3, "read-only" yang masuk akal
harus mencakup operasi list (s3:ListBucket). Update agar konsisten.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "0014"
down_revision: Union[str, None] = "0013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

NEW_READONLY = (
    '{\n  "Version": "2026-06-01",\n  "Statement": [\n'
    '    { "Effect": "Allow", "Action": ["s3:Get*", "s3:List*"], "Resource": "*" }\n  ]\n}'
)
OLD_READONLY = (
    '{\n  "Version": "2026-06-01",\n  "Statement": [\n'
    '    { "Effect": "Allow", "Action": "s3:Get*", "Resource": "*" }\n  ]\n}'
)


def _set_doc(doc: str) -> None:
    op.execute(
        "UPDATE iam_policies SET document = "
        + _q(doc)
        + " WHERE name = 'ReadOnlyStorage'"
    )


def _q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def upgrade() -> None:
    _set_doc(NEW_READONLY)


def downgrade() -> None:
    _set_doc(OLD_READONLY)
