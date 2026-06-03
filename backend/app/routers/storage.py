import re
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.core.ministack import (
    create_bucket, delete_bucket,
    upload_object, download_object, delete_object,
)
from app.database import get_db
from app.models.storage_bucket import BucketStatus, BucketVisibility, StorageBucket
from app.models.storage_object import ObjectStatus, StorageObject
from app.models.subscription import Subscription, SubscriptionStatus
from app.models.user import User
from app.schemas.storage_bucket import BucketCreateRequest, BucketDetailResponse, BucketResponse
from app.schemas.storage_object import ObjectResponse

router = APIRouter(prefix="/storage", tags=["storage"])


def _get_active_subscription(user_id: int, db: Session) -> Subscription:
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user_id,
            Subscription.status == SubscriptionStatus.active,
        )
        .first()
    )
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda belum memiliki langganan aktif. Pilih paket terlebih dahulu.",
        )
    return sub


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
    used_bytes = _get_storage_used_bytes(current_user.id, db)
    bucket_count = (
        db.query(StorageBucket)
        .filter(
            StorageBucket.user_id == current_user.id,
            StorageBucket.status.in_([BucketStatus.creating, BucketStatus.active]),
        )
        .count()
    )
    return {
        "storage_used_bytes": used_bytes,
        "storage_limit_bytes": sub.plan.storage_limit_bytes,
        "storage_percent": round((used_bytes / sub.plan.storage_limit_bytes) * 100, 1) if sub.plan.storage_limit_bytes else 0,
        "bucket_count": bucket_count,
        "bucket_limit": sub.plan.bucket_limit,
        "max_file_size_bytes": sub.plan.max_file_size_bytes,
        "bandwidth_limit_bytes": sub.plan.bandwidth_limit_bytes,
    }


@router.get("/buckets", response_model=list[BucketResponse])
def list_buckets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_active_subscription(current_user.id, db)

    buckets = (
        db.query(StorageBucket)
        .filter(
            StorageBucket.user_id == current_user.id,
            StorageBucket.status != BucketStatus.deleted,
        )
        .order_by(StorageBucket.created_at.desc())
        .all()
    )
    return buckets


@router.post("/buckets", response_model=BucketDetailResponse, status_code=status.HTTP_201_CREATED)
def create_bucket_endpoint(
    body: BucketCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_subscription(current_user.id, db)

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

    db.commit()
    db.refresh(bucket)
    return bucket


@router.get("/buckets/{bucket_id}", response_model=BucketDetailResponse)
def get_bucket(
    bucket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_active_subscription(current_user.id, db)

    bucket = db.query(StorageBucket).filter(
        StorageBucket.id == bucket_id,
        StorageBucket.user_id == current_user.id,
        StorageBucket.status != BucketStatus.deleted,
    ).first()

    if not bucket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bucket tidak ditemukan")
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
    from app.core.ministack import get_s3_client, _ensure_bucket_exists

    _get_active_subscription(current_user.id, db)
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
    bucket = _get_bucket_or_404(bucket_id, current_user.id, db)

    file_data = await file.read()
    file_size = len(file_data)

    if file_size > sub.plan.max_file_size_bytes:
        max_mb = sub.plan.max_file_size_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Ukuran file melebihi batas paket Anda ({max_mb} MB).",
        )

    used_bytes = _get_storage_used_bytes(current_user.id, db)
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
    _get_active_subscription(current_user.id, db)
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
    from app.core.ministack import get_s3_client, _ensure_bucket_exists

    s3 = get_s3_client()
    try:
        _ensure_bucket_exists(s3, bucket.internal_name)
        s3.head_object(Bucket=bucket.internal_name, Key=obj.object_key)
    except BotoClientError as e:
        code = e.response["Error"]["Code"]
        if code in ("404", "NoSuchKey"):
            # File tidak ada di MiniStack — hapus permanen dari database
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
    _get_active_subscription(current_user.id, db)
    bucket = _get_bucket_or_404(bucket_id, current_user.id, db)

    obj = db.query(StorageObject).filter(
        StorageObject.id == object_id,
        StorageObject.bucket_id == bucket_id,
        StorageObject.status == ObjectStatus.available,
    ).first()
    if not obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File tidak ditemukan")

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
    db.commit()
    return {"message": "File berhasil dihapus"}


# ── Delete bucket ──────────────────────────────────────────────────

@router.delete("/buckets/{bucket_id}", status_code=status.HTTP_200_OK)
def delete_bucket_endpoint(
    bucket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_active_subscription(current_user.id, db)

    bucket = db.query(StorageBucket).filter(
        StorageBucket.id == bucket_id,
        StorageBucket.user_id == current_user.id,
        StorageBucket.status == BucketStatus.active,
    ).first()

    if not bucket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bucket tidak ditemukan")

    bucket.status = BucketStatus.deleting
    db.flush()

    try:
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
    db.commit()
    return {"message": "Bucket berhasil dihapus"}
