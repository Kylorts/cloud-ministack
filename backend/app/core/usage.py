"""
Helper untuk usage_counters.

Counter di-update secara incremental (tambah/kurang) setiap aksi
storage. Tersedia juga fungsi recalculate() sebagai sumber kebenaran
jika counter drift dari data sebenarnya di storage_objects.
"""
from datetime import datetime

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.storage_bucket import BucketStatus, StorageBucket
from app.models.storage_object import ObjectStatus, StorageObject
from app.models.subscription import Subscription
from app.models.usage_counter import UsageCounter


def _compute_from_data(db: Session, user_id: int) -> dict:
    """Hitung nilai usage sebenarnya dari storage_objects & storage_buckets."""
    storage_used = (
        db.query(func.coalesce(func.sum(StorageObject.size_bytes), 0))
        .join(StorageBucket, StorageObject.bucket_id == StorageBucket.id)
        .filter(
            StorageBucket.user_id == user_id,
            StorageObject.status == ObjectStatus.available,
        )
        .scalar()
    )
    object_count = (
        db.query(func.count(StorageObject.id))
        .join(StorageBucket, StorageObject.bucket_id == StorageBucket.id)
        .filter(
            StorageBucket.user_id == user_id,
            StorageObject.status == ObjectStatus.available,
        )
        .scalar()
    )
    bucket_count = (
        db.query(func.count(StorageBucket.id))
        .filter(
            StorageBucket.user_id == user_id,
            StorageBucket.status.in_([BucketStatus.creating, BucketStatus.active]),
        )
        .scalar()
    )
    return {
        "storage_used_bytes": int(storage_used),
        "object_count": int(object_count),
        "bucket_count": int(bucket_count),
    }


def _compute_hosting(db: Session, user_id: int) -> dict:
    """Hitung usage hosting: jumlah situs aktif & total ukuran build deployment aktif."""
    from app.models.static_site import SiteStatus, StaticSite
    from app.models.static_site_deployment import StaticSiteDeployment

    sites = (
        db.query(StaticSite)
        .filter(
            StaticSite.user_id == user_id,
            StaticSite.status.in_([SiteStatus.active, SiteStatus.suspended]),
        )
        .all()
    )
    site_count = len(sites)
    build_size = 0
    for site in sites:
        if site.active_deployment_id:
            dep = db.get(StaticSiteDeployment, site.active_deployment_id)
            if dep:
                build_size += dep.total_size_bytes
    return {"static_site_count": site_count, "build_size_bytes": build_size}


def get_or_create_counter(db: Session, subscription: Subscription) -> UsageCounter:
    counter = (
        db.query(UsageCounter)
        .filter(UsageCounter.subscription_id == subscription.id)
        .first()
    )
    if counter:
        return counter

    # Counter baru → hitung dari data user yang sudah ada (bukan nol)
    if subscription.category == "hosting":
        h = _compute_hosting(db, subscription.user_id)
        storage_used, object_count, bucket_count, site_count = (
            h["build_size_bytes"], 0, 0, h["static_site_count"],
        )
    else:
        s = _compute_from_data(db, subscription.user_id)
        storage_used, object_count, bucket_count, site_count = (
            s["storage_used_bytes"], s["object_count"], s["bucket_count"], 0,
        )

    counter = UsageCounter(
        user_id=subscription.user_id,
        subscription_id=subscription.id,
        storage_used_bytes=storage_used,
        bandwidth_used_bytes=0,
        bucket_count=bucket_count,
        object_count=object_count,
        static_site_count=site_count,
        access_key_count=0,
        period_start=subscription.current_period_start,
        period_end=subscription.current_period_end,
        last_recalculated_at=datetime.utcnow(),
    )
    db.add(counter)
    db.flush()
    return counter


def recalculate_hosting(db: Session, subscription: Subscription) -> UsageCounter:
    """Hitung ulang counter hosting (jumlah situs & total build size)."""
    counter = get_or_create_counter(db, subscription)
    h = _compute_hosting(db, subscription.user_id)
    counter.static_site_count = h["static_site_count"]
    counter.storage_used_bytes = h["build_size_bytes"]
    counter.last_recalculated_at = datetime.utcnow()
    return counter


def add_object(db: Session, subscription: Subscription, size_bytes: int) -> None:
    counter = get_or_create_counter(db, subscription)
    counter.storage_used_bytes += size_bytes
    counter.object_count += 1


def remove_object(db: Session, subscription: Subscription, size_bytes: int) -> None:
    counter = get_or_create_counter(db, subscription)
    counter.storage_used_bytes = max(0, counter.storage_used_bytes - size_bytes)
    counter.object_count = max(0, counter.object_count - 1)


def add_bucket(db: Session, subscription: Subscription) -> None:
    counter = get_or_create_counter(db, subscription)
    counter.bucket_count += 1


def remove_bucket(db: Session, subscription: Subscription, freed_bytes: int = 0, freed_objects: int = 0) -> None:
    counter = get_or_create_counter(db, subscription)
    counter.bucket_count = max(0, counter.bucket_count - 1)
    if freed_bytes:
        counter.storage_used_bytes = max(0, counter.storage_used_bytes - freed_bytes)
    if freed_objects:
        counter.object_count = max(0, counter.object_count - freed_objects)


def recalculate(db: Session, subscription: Subscription) -> UsageCounter:
    """Hitung ulang counter dari data sebenarnya di storage_objects & storage_buckets."""
    counter = get_or_create_counter(db, subscription)
    computed = _compute_from_data(db, subscription.user_id)
    counter.storage_used_bytes = computed["storage_used_bytes"]
    counter.object_count = computed["object_count"]
    counter.bucket_count = computed["bucket_count"]
    counter.last_recalculated_at = datetime.utcnow()
    return counter
