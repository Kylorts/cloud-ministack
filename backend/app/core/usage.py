"""
Helper untuk usage_counters.

Counter di-update secara incremental (tambah/kurang) setiap aksi
storage. Tersedia juga fungsi recalculate() sebagai sumber kebenaran
jika counter drift dari data sebenarnya di storage_objects.
"""
from datetime import datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.storage_bucket import BucketStatus, StorageBucket
from app.models.storage_object import ObjectStatus, StorageObject
from app.models.subscription import Subscription
from app.models.usage_counter import UsageCounter

# Lama grace period setelah masuk OVER_QUOTA sebelum sistem men-suspend.
GRACE_PERIOD_DAYS = 7


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


def is_over_limit(subscription: Subscription, counter: UsageCounter) -> bool:
    """
    Cek apakah pemakaian melebihi limit plan — HANYA dimensi KAPASITAS (byte).

    Kelebihan JUMLAH (bucket/situs) tidak lagi memicu OVER_QUOTA langganan;
    itu ditangani lewat *dormancy per-resource* (resource terlama tetap aktif,
    yang berlebih/terbaru dorman). Lihat _dormant_bucket_ids / _dormant_site_ids.
    """
    plan = subscription.plan
    if plan.storage_limit_bytes and counter.storage_used_bytes > plan.storage_limit_bytes:
        return True
    return False


def evaluate_quota_status(db: Session, subscription) -> None:
    """
    Transisi status active <-> over_quota berdasarkan usage saat ini.
    Dipanggil setelah perubahan plan / recalc. Tidak menyentuh status
    final (cancelled/expired/terminated/suspended ditangani terpisah).
    """
    from app.models.subscription import SubscriptionStatus

    counter = get_or_create_counter(db, subscription)
    over = is_over_limit(subscription, counter)

    if over and subscription.status == SubscriptionStatus.active:
        now = datetime.utcnow()
        subscription.status = SubscriptionStatus.over_quota
        subscription.over_quota_since = now
        subscription.grace_until = now + timedelta(days=GRACE_PERIOD_DAYS)
    elif not over and subscription.status == SubscriptionStatus.over_quota:
        subscription.status = SubscriptionStatus.active
        subscription.over_quota_since = None
        subscription.grace_until = None


def apply_grace_suspend(db: Session, subscription) -> bool:
    """
    Lazy-check grace period: jika langganan OVER_QUOTA dan grace period sudah
    habis sementara pemakaian masih melebihi limit, sistem men-suspend langganan
    secara otomatis. Dikembalikan True jika terjadi transisi suspend.

    Tidak auto-pulih dari suspended (keputusan: hanya admin yang bisa unsuspend).
    """
    from app.models.activity_log import ActorType
    from app.models.subscription import SubscriptionStatus

    if subscription.status != SubscriptionStatus.over_quota:
        return False
    if not subscription.grace_until or datetime.utcnow() <= subscription.grace_until:
        return False

    # Pastikan memang masih melebihi limit sebelum men-suspend.
    counter = get_or_create_counter(db, subscription)
    if not is_over_limit(subscription, counter):
        return False

    subscription.status = SubscriptionStatus.suspended
    subscription.suspended_at = datetime.utcnow()
    try:
        from app.core.activity import log_activity

        log_activity(
            db,
            actor_user_id=subscription.user_id,
            actor_type=ActorType.system,
            action="SUBSCRIPTION_SUSPENDED",
            description=(
                "Langganan disuspend otomatis: grace period habis dan pemakaian "
                "masih melebihi kuota."
            ),
            target_type="subscription",
            target_id=subscription.id,
        )
    except Exception:
        pass
    db.commit()
    return True


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
