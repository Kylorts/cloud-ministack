import re
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.pin import require_pin
from app.core.ministack import (
    create_bucket, delete_bucket,
    upload_object, download_object, delete_object,
    get_s3_client, _ensure_bucket_exists,
)
from app.core import usage as usage_helper
from app.core.activity import log_activity
from app.database import get_db
from app.models.storage_bucket import BucketStatus, BucketVisibility, StorageBucket
from app.models.storage_object import ObjectStatus, StorageObject
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.usage_counter import UsageCounter
from app.models.user import User
from app.schemas.storage_bucket import BucketCreateRequest, BucketDetailResponse, BucketResponse
from app.schemas.storage_object import ObjectResponse

router = APIRouter(prefix="/storage", tags=["storage"])


# Status yang masih boleh mengakses & mengelola data (lihat/download/hapus)
ACCESS_STATUSES = [
    SubscriptionStatus.active,
    SubscriptionStatus.over_quota,
    SubscriptionStatus.suspended,
]


def _get_active_subscription(user_id: int, db: Session) -> Subscription:
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user_id,
            Subscription.status.in_(ACCESS_STATUSES),
            Subscription.category == "storage",
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda belum memiliki langganan Storage aktif. Pilih paket Storage terlebih dahulu.",
        )
    return sub


def _require_can_add(sub: Subscription) -> None:
    """Blok penambahan resource baru jika OVER_QUOTA (byte) atau SUSPENDED."""
    if sub.status == SubscriptionStatus.over_quota:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Kuota terlampaui (OVER_QUOTA). Anda masih bisa melihat, mengunduh, dan menghapus, "
                   "tetapi tidak bisa menambah resource baru. Kurangi pemakaian atau upgrade paket.",
        )
    if sub.status == SubscriptionStatus.suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Langganan Anda sedang disuspend. Hubungi admin atau perbarui langganan.",
        )


def _dormant_bucket_ids(db: Session, user_id: int, limit: int | None) -> set[int]:
    """
    ID bucket yang DORMAN: bila jumlah bucket aktif > limit paket, bucket
    TERBARU yang melebihi batas dianggap dorman (terkunci dari upload).
    Bucket terlama (sampai sebatas limit) tetap aktif.
    """
    if not limit:
        return set()
    rows = (
        db.query(StorageBucket.id)
        .filter(
            StorageBucket.user_id == user_id,
            StorageBucket.status == BucketStatus.active,
        )
        .order_by(StorageBucket.created_at.asc())
        .all()
    )
    ids = [r.id for r in rows]
    return set(ids[limit:])  # sisanya (terbaru) di luar batas → dorman


def _make_internal_name(user_id: int, display_name: str, db: Session) -> str:
    base = f"u{user_id}-{display_name}"
    base = re.sub(r"[^a-z0-9\-]", "-", base.lower())
    base = re.sub(r"-+", "-", base).strip("-")[:63]

    candidate = base
    counter = 1
    while db.query(StorageBucket).filter(StorageBucket.internal_name == candidate).first():
        candidate = f"{base[:59]}-{counter}"
        counter += 1
    return candidate


@router.get("/usage")
def get_storage_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_subscription(current_user.id, db)
    counter = usage_helper.get_or_create_counter(db, sub)
    usage_helper.evaluate_quota_status(db, sub)  # lazy-check: pulihkan/aktifkan over_quota
    db.commit()

    used_bytes = counter.storage_used_bytes
    return {
        "subscription_status": sub.status.value if hasattr(sub.status, "value") else sub.status,
        "storage_used_bytes": used_bytes,
        "storage_limit_bytes": sub.plan.storage_limit_bytes,
        "storage_percent": round((used_bytes / sub.plan.storage_limit_bytes) * 100, 1) if sub.plan.storage_limit_bytes else 0,
        "bandwidth_used_bytes": counter.bandwidth_used_bytes,
        "bandwidth_limit_bytes": sub.plan.bandwidth_limit_bytes,
        "bucket_count": counter.bucket_count,
        "bucket_limit": sub.plan.bucket_limit,
        "object_count": counter.object_count,
        "access_key_count": counter.access_key_count,
        "access_key_limit": sub.plan.access_key_limit,
        "static_site_count": counter.static_site_count,
        "static_site_limit": sub.plan.static_site_limit,
        "max_file_size_bytes": sub.plan.max_file_size_bytes,
        "period_start": counter.period_start,
        "period_end": counter.period_end,
    }


@router.get("/buckets", response_model=list[BucketResponse])
def list_buckets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_subscription(current_user.id, db)
    dormant_ids = _dormant_bucket_ids(db, current_user.id, sub.plan.bucket_limit)

    buckets = (
        db.query(StorageBucket)
        .filter(
            StorageBucket.user_id == current_user.id,
            StorageBucket.status != BucketStatus.deleted,
        )
        .order_by(StorageBucket.created_at.desc())
        .all()
    )

    # Tambah stats per bucket
    result = []
    for bucket in buckets:
        stats = (
            db.query(
                func.count(StorageObject.id).label("object_count"),
                func.coalesce(func.sum(StorageObject.size_bytes), 0).label("total_size_bytes"),
            )
            .filter(
                StorageObject.bucket_id == bucket.id,
                StorageObject.status == ObjectStatus.available,
            )
            .first()
        )
        bucket.object_count = stats.object_count if stats else 0
        bucket.total_size_bytes = int(stats.total_size_bytes) if stats else 0
        bucket.dormant = bucket.id in dormant_ids
        result.append(bucket)

    return result


@router.post("/buckets", response_model=BucketDetailResponse, status_code=status.HTTP_201_CREATED)
def create_bucket_endpoint(
    body: BucketCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_subscription(current_user.id, db)
    _require_can_add(sub)

    active_count = (
        db.query(StorageBucket)
        .filter(
            StorageBucket.user_id == current_user.id,
            StorageBucket.status.in_([BucketStatus.creating, BucketStatus.active]),
        )
        .count()
    )
    if active_count >= sub.plan.bucket_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Batas bucket paket Anda adalah {sub.plan.bucket_limit}. Upgrade paket untuk menambah lebih banyak bucket.",
        )

    internal_name = _make_internal_name(current_user.id, body.display_name, db)

    bucket = StorageBucket(
        user_id=current_user.id,
        subscription_id=sub.id,
        display_name=body.display_name,
        internal_name=internal_name,
        visibility=BucketVisibility(body.visibility),
        status=BucketStatus.creating,
    )
    db.add(bucket)
    db.flush()

    try:
        create_bucket(internal_name)
        bucket.status = BucketStatus.active
    except Exception as e:
        bucket.status = BucketStatus.failed
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gagal membuat bucket di MiniStack: {str(e)}",
        )

    # Update usage counter
    usage_helper.add_bucket(db, sub)
    usage_helper.evaluate_quota_status(db, sub)

    log_activity(
        db,
        actor_user_id=current_user.id,
        action="BUCKET_CREATED",
        description=f"Membuat bucket '{bucket.display_name}'",
        target_type="BUCKET",
        target_id=bucket.id,
    )

    db.commit()
    db.refresh(bucket)
    return bucket


@router.get("/buckets/{bucket_id}", response_model=BucketDetailResponse)
def get_bucket(
    bucket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_subscription(current_user.id, db)

    bucket = db.query(StorageBucket).filter(
        StorageBucket.id == bucket_id,
        StorageBucket.user_id == current_user.id,
        StorageBucket.status != BucketStatus.deleted,
    ).first()

    if not bucket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bucket tidak ditemukan")

    bucket.dormant = bucket.id in _dormant_bucket_ids(db, current_user.id, sub.plan.bucket_limit)
    return bucket


def _get_storage_used_bytes(user_id: int, db: Session) -> int:
    result = (
        db.query(func.coalesce(func.sum(StorageObject.size_bytes), 0))
        .join(StorageBucket, StorageObject.bucket_id == StorageBucket.id)
        .filter(
            StorageBucket.user_id == user_id,
            StorageObject.status == ObjectStatus.available,
        )
        .scalar()
    )
    return int(result)


def _get_bucket_or_404(bucket_id: int, user_id: int, db: Session) -> StorageBucket:
    bucket = db.query(StorageBucket).filter(
        StorageBucket.id == bucket_id,
        StorageBucket.user_id == user_id,
        StorageBucket.status == BucketStatus.active,
    ).first()
    if not bucket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bucket tidak ditemukan")
    return bucket


# ── Object endpoints ───────────────────────────────────────────────

@router.get("/buckets/{bucket_id}/objects", response_model=list[ObjectResponse])
def list_objects(
    bucket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from botocore.exceptions import ClientError as BotoClientError

    sub = _get_active_subscription(current_user.id, db)
    bucket = _get_bucket_or_404(bucket_id, current_user.id, db)

    db_objects = (
        db.query(StorageObject)
        .filter(
            StorageObject.bucket_id == bucket_id,
            StorageObject.status == ObjectStatus.available,
        )
        .all()
    )

    if db_objects:
        # Sinkronisasi dengan MiniStack — 1 API call untuk semua file
        s3 = get_s3_client()
        try:
            _ensure_bucket_exists(s3, bucket.internal_name)
            response = s3.list_objects_v2(Bucket=bucket.internal_name)
            existing_keys = {
                obj["Key"]
                for obj in response.get("Contents", [])
            }
            # Hapus dari DB file yang tidak ada di MiniStack
            cleaned = []
            for obj in db_objects:
                if obj.object_key in existing_keys:
                    cleaned.append(obj)
                else:
                    db.delete(obj)
            if len(cleaned) < len(db_objects):
                # Ada object yang hilang → recalc counter agar akurat
                db.flush()
                usage_helper.recalculate(db, sub)
                usage_helper.evaluate_quota_status(db, sub)
                db.commit()
            db_objects = cleaned
        except BotoClientError:
            pass  # Jika MiniStack tidak bisa diakses, tetap tampilkan dari DB

    return sorted(db_objects, key=lambda o: o.uploaded_at or o.created_at, reverse=True)


@router.post(
    "/buckets/{bucket_id}/objects",
    response_model=ObjectResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_file(
    bucket_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_subscription(current_user.id, db)
    _require_can_add(sub)
    bucket = _get_bucket_or_404(bucket_id, current_user.id, db)

    # Bucket dorman (melebihi batas jumlah paket) → tidak boleh upload
    if bucket.id in _dormant_bucket_ids(db, current_user.id, sub.plan.bucket_limit):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bucket ini dorman karena melebihi batas jumlah bucket paket Anda. "
                   "Upgrade paket atau hapus bucket lain untuk mengaktifkannya kembali.",
        )

    file_data = await file.read()
    file_size = len(file_data)

    if file_size > sub.plan.max_file_size_bytes:
        max_mb = sub.plan.max_file_size_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Ukuran file melebihi batas paket Anda ({max_mb} MB).",
        )

    counter = usage_helper.get_or_create_counter(db, sub)
    used_bytes = counter.storage_used_bytes
    if used_bytes + file_size > sub.plan.storage_limit_bytes:
        sisa_mb = (sub.plan.storage_limit_bytes - used_bytes) // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Kuota storage hampir habis. Sisa: {sisa_mb} MB. Upgrade paket untuk menambah kapasitas.",
        )

    content_type = file.content_type or "application/octet-stream"
    object_key = file.filename or "untitled"

    obj = StorageObject(
        bucket_id=bucket.id,
        user_id=current_user.id,
        object_key=object_key,
        filename=object_key,
        content_type=content_type,
        size_bytes=file_size,
        status=ObjectStatus.uploading,
    )
    db.add(obj)
    db.flush()

    try:
        checksum = upload_object(bucket.internal_name, object_key, file_data, content_type)
        obj.status = ObjectStatus.available
        obj.checksum = checksum
        obj.uploaded_at = datetime.utcnow()
    except Exception as e:
        obj.status = ObjectStatus.failed
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gagal mengunggah file ke MiniStack: {str(e)}",
        )

    # Update usage counter
    usage_helper.add_object(db, sub, file_size)
    usage_helper.evaluate_quota_status(db, sub)

    log_activity(
        db,
        actor_user_id=current_user.id,
        action="FILE_UPLOADED",
        description=f"Mengunggah file '{obj.filename}' ke bucket '{bucket.display_name}'",
        target_type="OBJECT",
        target_id=obj.id,
        metadata={"size_bytes": file_size, "bucket": bucket.display_name},
    )

    db.commit()
    db.refresh(obj)
    return obj


@router.get("/buckets/{bucket_id}/objects/{object_id}/download")
def download_file(
    bucket_id: int,
    object_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_subscription(current_user.id, db)
    bucket = _get_bucket_or_404(bucket_id, current_user.id, db)

    obj = db.query(StorageObject).filter(
        StorageObject.id == object_id,
        StorageObject.bucket_id == bucket_id,
        StorageObject.status == ObjectStatus.available,
    ).first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File tidak ditemukan")

    # Cek keberadaan file di MiniStack SEBELUM streaming dimulai
    # agar error bisa di-handle dengan benar (setelah StreamingResponse dimulai sudah 200)
    from botocore.exceptions import ClientError as BotoClientError

    s3 = get_s3_client()
    try:
        _ensure_bucket_exists(s3, bucket.internal_name)
        s3.head_object(Bucket=bucket.internal_name, Key=obj.object_key)
    except BotoClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("404", "NoSuchKey"):
            # File tidak ada di MiniStack — hapus permanen dari database + update counter
            usage_helper.remove_object(db, sub, obj.size_bytes)
            db.delete(obj)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File tidak ditemukan di storage dan telah dihapus dari sistem.",
            )
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(e))

    stream = download_object(bucket.internal_name, obj.object_key)
    return StreamingResponse(
        stream,
        media_type=obj.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{obj.filename}"'},
    )


@router.delete("/buckets/{bucket_id}/objects/{object_id}", status_code=status.HTTP_200_OK)
def delete_file(
    bucket_id: int,
    object_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_subscription(current_user.id, db)
    bucket = _get_bucket_or_404(bucket_id, current_user.id, db)

    obj = db.query(StorageObject).filter(
        StorageObject.id == object_id,
        StorageObject.bucket_id == bucket_id,
        StorageObject.status == ObjectStatus.available,
    ).first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File tidak ditemukan")

    freed_bytes = obj.size_bytes
    obj.status = ObjectStatus.deleting
    db.flush()

    try:
        delete_object(bucket.internal_name, obj.object_key)
    except Exception as e:
        obj.status = ObjectStatus.available
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gagal menghapus file dari MiniStack: {str(e)}",
        )

    obj.status = ObjectStatus.deleted
    obj.deleted_at = datetime.utcnow()

    # Update usage counter
    usage_helper.remove_object(db, sub, freed_bytes)
    usage_helper.evaluate_quota_status(db, sub)  # mungkin sudah kembali di bawah limit

    log_activity(
        db,
        actor_user_id=current_user.id,
        action="FILE_DELETED",
        description=f"Menghapus file '{obj.filename}' dari bucket '{bucket.display_name}'",
        target_type="OBJECT",
        target_id=obj.id,
    )

    db.commit()
    return {"message": "File berhasil dihapus"}


# ── Empty bucket (hapus semua file) ────────────────────────────────

@router.post("/buckets/{bucket_id}/empty", status_code=status.HTTP_200_OK)
def empty_bucket(
    bucket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_subscription(current_user.id, db)
    bucket = _get_bucket_or_404(bucket_id, current_user.id, db)

    objs = db.query(StorageObject).filter(
        StorageObject.bucket_id == bucket.id,
        StorageObject.status == ObjectStatus.available,
    ).all()
    if not objs:
        return {"message": "Bucket sudah kosong", "deleted": 0}

    # Hapus seluruh object di MiniStack
    s3 = get_s3_client()
    try:
        _ensure_bucket_exists(s3, bucket.internal_name)
        resp = s3.list_objects_v2(Bucket=bucket.internal_name)
        for o in resp.get("Contents", []):
            s3.delete_object(Bucket=bucket.internal_name, Key=o["Key"])
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gagal mengosongkan bucket di MiniStack: {str(e)}",
        )

    now = datetime.utcnow()
    for o in objs:
        o.status = ObjectStatus.deleted
        o.deleted_at = now
    db.flush()

    # Hitung ulang counter dari data + cek pemulihan kuota
    usage_helper.recalculate(db, sub)
    usage_helper.evaluate_quota_status(db, sub)

    log_activity(
        db,
        actor_user_id=current_user.id,
        action="FILE_DELETED",
        description=f"Mengosongkan bucket '{bucket.display_name}' ({len(objs)} file dihapus)",
        target_type="BUCKET",
        target_id=bucket.id,
    )
    db.commit()
    return {"message": f"{len(objs)} file berhasil dihapus", "deleted": len(objs)}


# ── Delete bucket ──────────────────────────────────────────────────

@router.delete("/buckets/{bucket_id}", status_code=status.HTTP_200_OK)
def delete_bucket_endpoint(
    bucket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_transaction_pin: str | None = Header(default=None, alias="X-Transaction-PIN"),
):
    require_pin(current_user, x_transaction_pin)
    sub = _get_active_subscription(current_user.id, db)

    bucket = db.query(StorageBucket).filter(
        StorageBucket.id == bucket_id,
        StorageBucket.user_id == current_user.id,
        StorageBucket.status == BucketStatus.active,
    ).first()

    if not bucket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bucket tidak ditemukan")

    # Bucket hanya boleh dihapus jika KOSONG (seperti S3 asli).
    object_count = (
        db.query(func.count(StorageObject.id))
        .filter(
            StorageObject.bucket_id == bucket.id,
            StorageObject.status == ObjectStatus.available,
        )
        .scalar()
    )
    if object_count and int(object_count) > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kosongkan bucket terlebih dahulu sebelum menghapus. "
                   "Hapus semua file di dalamnya, lalu coba lagi.",
        )

    bucket.status = BucketStatus.deleting
    db.flush()

    try:
        # Bucket sudah kosong → cukup hapus bucket-nya di MiniStack
        delete_bucket(bucket.internal_name)
    except Exception as e:
        bucket.status = BucketStatus.active
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gagal menghapus bucket dari MiniStack: {str(e)}",
        )

    bucket.status = BucketStatus.deleted
    bucket.deleted_at = datetime.utcnow()

    # Update usage counter (tidak ada byte/object yang dibebaskan — sudah kosong)
    usage_helper.remove_bucket(db, sub)
    usage_helper.evaluate_quota_status(db, sub)  # mungkin sudah kembali di bawah limit

    log_activity(
        db,
        actor_user_id=current_user.id,
        action="BUCKET_DELETED",
        description=f"Menghapus bucket '{bucket.display_name}'",
        target_type="BUCKET",
        target_id=bucket.id,
    )

    db.commit()
    return {"message": "Bucket berhasil dihapus"}
