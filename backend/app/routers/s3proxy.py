"""
Proxy storage ber-autentikasi Access Key (Enforcement Opsi A).

Klien (curl / skrip) mengakses storage memakai access key + secret via header
`X-Access-Key-Id` & `X-Secret-Key`. Backend:
  - verifikasi kunci (cocokkan secret ke hash bcrypt),
  - enforce permission Full vs Read-Only,
  - isolasi: kunci hanya bisa akses bucket milik pemiliknya,
  - hormati kuota / OVER_QUOTA / dormansi,
  - proxy operasi ke MiniStack.

Bukan S3 SigV4 — protokol header sederhana (sesuai keputusan Opsi A).
"""
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core import usage as usage_helper
from app.core.activity import log_activity
from app.core.iam import authorize
from app.core.ministack import download_object, delete_object, upload_object, ensure_object_exists, get_s3_client
from app.core.security import verify_password
from app.database import get_db
from app.models.access_key import AccessKey, KeyPermission, KeyStatus
from app.models.storage_bucket import BucketStatus, StorageBucket
from app.models.storage_object import ObjectStatus, StorageObject
from app.models.subscription import Subscription, SubscriptionStatus
from app.routers.storage import _dormant_bucket_ids

router = APIRouter(prefix="/s3", tags=["s3-proxy"])

ACCESS_STATUSES = [
    SubscriptionStatus.active,
    SubscriptionStatus.over_quota,
    SubscriptionStatus.suspended,
]


class KeyContext:
    def __init__(self, key: AccessKey, sub: Subscription):
        self.key = key
        self.sub = sub


def get_key_ctx(
    x_access_key_id: str | None = Header(default=None, alias="X-Access-Key-Id"),
    x_secret_key: str | None = Header(default=None, alias="X-Secret-Key"),
    db: Session = Depends(get_db),
) -> KeyContext:
    if not x_access_key_id or not x_secret_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sertakan header X-Access-Key-Id dan X-Secret-Key.",
        )
    key = db.query(AccessKey).filter(AccessKey.access_key_id == x_access_key_id).first()
    if (not key or key.status != KeyStatus.active
            or not verify_password(x_secret_key, key.secret_key_hash)):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access key atau secret key tidak valid.",
        )
    if key.category != "storage":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kunci ini bukan untuk layanan storage.",
        )
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == key.user_id,
            Subscription.category == "storage",
            Subscription.status.in_(ACCESS_STATUSES),
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Langganan storage untuk kunci ini tidak aktif.",
        )
    key.last_used_at = datetime.utcnow()
    db.commit()
    return KeyContext(key, sub)


def _require_write(ctx: KeyContext) -> None:
    if ctx.key.permission == KeyPermission.read_only:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kunci ini Read-Only — operasi tulis/hapus tidak diizinkan.",
        )


def _authorize(ctx: KeyContext, action: str, resource: str, *, write: bool = False) -> None:
    """
    Otorisasi sebuah operasi. Jika kunci punya IAM policy → policy yang memutuskan
    (menggantikan enum permission). Jika tidak → fallback ke permission lama
    (read_only memblok tulis; baca selalu boleh).
    """
    pol = ctx.key.policy
    if pol is not None:
        if not authorize(pol.document, action, resource):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Akses ditolak oleh IAM policy '{pol.name}' untuk {action} pada '{resource}'.",
            )
        return
    if write:
        _require_write(ctx)


def _resolve_bucket(db: Session, user_id: int, name: str) -> StorageBucket:
    """Isolasi: hanya bucket milik pemilik kunci yang bisa di-resolve."""
    b = db.query(StorageBucket).filter(
        StorageBucket.user_id == user_id,
        StorageBucket.display_name == name,
        StorageBucket.status == BucketStatus.active,
    ).first()
    if not b:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bucket '{name}' tidak ditemukan untuk kunci ini.",
        )
    return b


@router.get("/buckets")
def proxy_list_buckets(ctx: KeyContext = Depends(get_key_ctx), db: Session = Depends(get_db)):
    _authorize(ctx, "s3:ListBucket", "*")
    buckets = (
        db.query(StorageBucket)
        .filter(StorageBucket.user_id == ctx.key.user_id, StorageBucket.status == BucketStatus.active)
        .order_by(StorageBucket.created_at.asc())
        .all()
    )
    return {"buckets": [
        {"name": b.display_name, "visibility": b.visibility, "created_at": b.created_at.isoformat()}
        for b in buckets
    ]}


@router.get("/buckets/{bucket}/objects")
def proxy_list_objects(bucket: str, ctx: KeyContext = Depends(get_key_ctx), db: Session = Depends(get_db)):
    _authorize(ctx, "s3:ListBucket", bucket)
    b = _resolve_bucket(db, ctx.key.user_id, bucket)
    objs = db.query(StorageObject).filter(
        StorageObject.bucket_id == b.id, StorageObject.status == ObjectStatus.available,
    ).all()
    return {"bucket": bucket, "objects": [
        {"key": o.object_key, "size": o.size_bytes, "content_type": o.content_type,
         "last_modified": (o.uploaded_at or o.created_at).isoformat()}
        for o in objs
    ]}


@router.get("/buckets/{bucket}/objects/{object_key:path}")
def proxy_download(bucket: str, object_key: str,
                   ctx: KeyContext = Depends(get_key_ctx), db: Session = Depends(get_db)):
    _authorize(ctx, "s3:GetObject", f"{bucket}/{object_key}")
    b = _resolve_bucket(db, ctx.key.user_id, bucket)
    obj = db.query(StorageObject).filter(
        StorageObject.bucket_id == b.id,
        StorageObject.object_key == object_key,
        StorageObject.status == ObjectStatus.available,
    ).first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Objek tidak ditemukan.")
    ensure_object_exists(get_s3_client(), b.internal_name, obj.object_key, obj.content_type)
    stream = download_object(b.internal_name, obj.object_key)
    return StreamingResponse(
        stream,
        media_type=obj.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{obj.filename}"'},
    )


@router.put("/buckets/{bucket}/objects/{object_key:path}")
async def proxy_put(bucket: str, object_key: str, request: Request,
                    ctx: KeyContext = Depends(get_key_ctx), db: Session = Depends(get_db)):
    _authorize(ctx, "s3:PutObject", f"{bucket}/{object_key}", write=True)
    sub = ctx.sub
    if sub.status == SubscriptionStatus.over_quota:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Kuota terlampaui (OVER_QUOTA).")
    if sub.status == SubscriptionStatus.suspended:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Langganan disuspend.")

    b = _resolve_bucket(db, ctx.key.user_id, bucket)
    if b.id in _dormant_bucket_ids(db, ctx.key.user_id, sub.plan.bucket_limit):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bucket dorman (melebihi batas paket) — tidak bisa upload.",
        )

    data = await request.body()
    size = len(data)
    if not size:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Body kosong.")
    if size > sub.plan.max_file_size_bytes:
        max_mb = sub.plan.max_file_size_bytes // (1024 * 1024)
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail=f"Ukuran file melebihi batas paket ({max_mb} MB).")
    content_type = request.headers.get("content-type", "application/octet-stream")

    existing = db.query(StorageObject).filter(
        StorageObject.bucket_id == b.id,
        StorageObject.object_key == object_key,
        StorageObject.status == ObjectStatus.available,
    ).first()
    counter = usage_helper.get_or_create_counter(db, sub)
    old_size = existing.size_bytes if existing else 0
    if counter.storage_used_bytes - old_size + size > sub.plan.storage_limit_bytes:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            detail="Kuota penyimpanan tidak cukup.")

    etag = upload_object(b.internal_name, object_key, data, content_type)

    if existing:
        usage_helper.remove_object(db, sub, existing.size_bytes)
        existing.size_bytes = size
        existing.content_type = content_type
        existing.checksum = etag
        existing.uploaded_at = datetime.utcnow()
        usage_helper.add_object(db, sub, size)
        obj = existing
    else:
        obj = StorageObject(
            bucket_id=b.id, user_id=ctx.key.user_id,
            object_key=object_key, filename=object_key.split("/")[-1],
            content_type=content_type, size_bytes=size,
            status=ObjectStatus.available, uploaded_at=datetime.utcnow(), checksum=etag,
        )
        db.add(obj)
        usage_helper.add_object(db, sub, size)

    db.flush()
    usage_helper.evaluate_quota_status(db, sub)
    log_activity(
        db, actor_user_id=ctx.key.user_id, action="FILE_UPLOADED",
        description=f"Upload '{object_key}' ke bucket '{b.display_name}' via access key",
        target_type="OBJECT", target_id=obj.id,
    )
    db.commit()
    return {"message": "ok", "bucket": bucket, "key": object_key, "size": size, "etag": etag}


@router.delete("/buckets/{bucket}/objects/{object_key:path}")
def proxy_delete(bucket: str, object_key: str,
                 ctx: KeyContext = Depends(get_key_ctx), db: Session = Depends(get_db)):
    _authorize(ctx, "s3:DeleteObject", f"{bucket}/{object_key}", write=True)
    b = _resolve_bucket(db, ctx.key.user_id, bucket)
    obj = db.query(StorageObject).filter(
        StorageObject.bucket_id == b.id,
        StorageObject.object_key == object_key,
        StorageObject.status == ObjectStatus.available,
    ).first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Objek tidak ditemukan.")

    try:
        delete_object(b.internal_name, obj.object_key)
    except Exception:
        pass  # tetap tandai terhapus di DB

    obj.status = ObjectStatus.deleted
    obj.deleted_at = datetime.utcnow()
    usage_helper.remove_object(db, ctx.sub, obj.size_bytes)
    usage_helper.evaluate_quota_status(db, ctx.sub)
    log_activity(
        db, actor_user_id=ctx.key.user_id, action="FILE_DELETED",
        description=f"Hapus '{object_key}' dari bucket '{b.display_name}' via access key",
        target_type="OBJECT", target_id=obj.id,
    )
    db.commit()
    return {"message": "deleted", "bucket": bucket, "key": object_key}
