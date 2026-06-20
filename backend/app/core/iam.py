"""
Mesin evaluasi IAM policy (subset gaya AWS) untuk enforcement access key di /s3.

Dokumen policy berbentuk JSON:
    {
      "Version": "2026-06-01",
      "Statement": [
        { "Effect": "Allow", "Action": "s3:Get*", "Resource": "*" },
        { "Effect": "Deny",  "Action": "s3:DeleteObject", "Resource": "rahasia/*" }
      ]
    }

Aturan yang didukung (disederhanakan):
  - `Action`   : string atau list; wildcard glob (`s3:*`, `s3:Get*`, `*`).
  - `Resource` : string atau list; ARN disederhanakan tanpa prefix arn:aws:s3:::
                 contoh: `*`, `<bucket>`, `<bucket>/*`, `<bucket>/<key>`.
  - `Effect`   : "Allow" / "Deny".
  - Evaluasi: **default deny**; **explicit Deny menang** atas Allow (seperti AWS).

Action storage yang dipakai proxy: s3:ListBucket, s3:GetObject, s3:PutObject,
s3:DeleteObject.
"""
import fnmatch
import json


def _as_list(v) -> list:
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


def _matches(value: str, pattern: str) -> bool:
    """Cocokkan glob case-sensitive; '*' cocok dengan apa saja."""
    if pattern == "*":
        return True
    return fnmatch.fnmatchcase(value, pattern)


def authorize(document, action: str, resource: str) -> bool:
    """
    True jika `action` atas `resource` diizinkan oleh dokumen policy.
    Dokumen tak valid / kosong → ditolak (default deny).
    """
    try:
        doc = json.loads(document) if isinstance(document, str) else document
    except Exception:
        return False
    if not isinstance(doc, dict):
        return False

    statements = doc.get("Statement", [])
    if isinstance(statements, dict):
        statements = [statements]
    if not isinstance(statements, list):
        return False

    allowed = False
    for st in statements:
        if not isinstance(st, dict):
            continue
        actions = _as_list(st.get("Action"))
        resources = _as_list(st.get("Resource"))
        a_match = any(_matches(action, p) for p in actions)
        r_match = any(_matches(resource, p) for p in resources)
        if not (a_match and r_match):
            continue
        effect = st.get("Effect")
        if effect == "Deny":
            return False  # explicit deny langsung menang
        if effect == "Allow":
            allowed = True
    return allowed
