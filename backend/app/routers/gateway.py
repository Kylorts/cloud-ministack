from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core import usage as usage_helper
from app.core.ministack import get_hosting_file
from app.database import get_db
from app.models.static_site import SiteStatus, StaticSite
from app.models.static_site_deployment import StaticSiteDeployment
from app.models.subscription import ACTIVE_LIKE_STATUSES, Subscription, SubscriptionStatus

router = APIRouter(tags=["gateway"])


SUSPENDED_HTML = """<!doctype html><html><head><meta charset="utf-8">
<title>Service Suspended</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;
height:100vh;margin:0;background:#f9fafb;color:#374151;text-align:center}</style></head>
<body><div><h1>Layanan Ditangguhkan</h1><p>Situs ini sedang tidak aktif.</p></div></body></html>"""

BANDWIDTH_HTML = """<!doctype html><html><head><meta charset="utf-8">
<title>Bandwidth Limit Exceeded</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;
height:100vh;margin:0;background:#f9fafb;color:#374151;text-align:center}</style></head>
<body><div><h1>Kuota Bandwidth Habis</h1>
<p>Situs ini melebihi kuota bandwidth bulanan. Coba lagi periode berikutnya, atau hubungi pemilik untuk upgrade paket.</p>
</div></body></html>"""

NOTDEPLOYED_HTML = """<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Belum Dipublikasikan — JadeStack</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#062F28;color:#eafff0;padding:24px}
  .card{max-width:480px;text-align:center}
  .badge{display:inline-flex;align-items:center;gap:8px;background:rgba(159,232,112,.12);color:#9FE870;
    border:1px solid rgba(159,232,112,.3);border-radius:999px;padding:6px 14px;font-size:13px;font-weight:600;margin-bottom:26px}
  .dot{width:8px;height:8px;border-radius:50%;background:#9FE870;display:inline-block;
    box-shadow:0 0 0 0 rgba(159,232,112,.6);animation:pulse 2s infinite}
  @keyframes pulse{70%{box-shadow:0 0 0 10px rgba(159,232,112,0)}100%{box-shadow:0 0 0 0 rgba(159,232,112,0)}}
  h1{font-size:28px;margin:0 0 14px;font-weight:700;letter-spacing:-.01em}
  p{margin:0;color:#a7c4b5;line-height:1.65;font-size:15px}
  .logo{margin-top:44px;font-weight:800;letter-spacing:-.02em;color:#9FE870;font-size:18px}
  .logo span{color:#eafff0}
</style></head>
<body><div class="card">
  <div class="badge"><span class="dot"></span> Menunggu Deployment</div>
  <h1>Situs ini belum dipublikasikan</h1>
  <p>Pemilik situs belum mengunggah konten apa pun. Halaman akan tampil otomatis
  setelah deployment pertama selesai. Silakan kembali lagi nanti.</p>
  <div class="logo">JADE<span>STACK</span></div>
</div></body></html>"""


def _hosting_sub(db: Session, site: StaticSite):
    """Langganan hosting AKTIF pemilik situs (fallback ke subscription_id situs)."""
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == site.user_id,
            Subscription.category == "hosting",
            Subscription.status.in_(ACTIVE_LIKE_STATUSES),
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )
    return sub or db.get(Subscription, site.subscription_id)


def _subscription_suspended(db: Session, site: StaticSite) -> bool:
    """True jika langganan hosting pemilik situs sedang SUSPENDED.

    Sekalian lazy-check grace period: kunjungan ke situs bisa memicu auto-suspend
    bila grace sudah habis dan pemakaian masih melebihi kuota.
    """
    try:
        sub = _hosting_sub(db, site)
        if not sub:
            return False
        usage_helper.apply_grace_suspend(db, sub)
        return sub.status == SubscriptionStatus.suspended
    except Exception:
        db.rollback()
        return False


def _bandwidth_blocked(db: Session, site: StaticSite) -> bool:
    """True jika bandwidth bulan ini sudah melewati limit paket. Reset lazy per periode."""
    try:
        sub = _hosting_sub(db, site)
        if not sub:
            return False
        counter = usage_helper.get_or_create_counter(db, sub)
        now = datetime.utcnow()
        if counter.period_end and now > counter.period_end:
            counter.bandwidth_used_bytes = 0
            counter.period_start = now
            counter.period_end = now + timedelta(days=30)
            db.commit()
        limit = sub.plan.bandwidth_limit_bytes
        return bool(limit) and counter.bandwidth_used_bytes >= limit
    except Exception:
        db.rollback()
        return False


def _count_bandwidth(db: Session, site: StaticSite, nbytes: int) -> None:
    """Tambahkan bandwidth terpakai ke counter subscription hosting situs."""
    try:
        sub = _hosting_sub(db, site)
        if sub:
            counter = usage_helper.get_or_create_counter(db, sub)
            counter.bandwidth_used_bytes += nbytes
            db.commit()
    except Exception:
        db.rollback()


@router.get("/sites/{slug}")
@router.get("/sites/{slug}/")
@router.get("/sites/{slug}/{path:path}")
def serve_site(slug: str, path: str = "", db: Session = Depends(get_db)):
    site = db.query(StaticSite).filter(StaticSite.slug == slug).first()
    if not site or site.status == SiteStatus.deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Situs tidak ditemukan")

    if site.status == SiteStatus.suspended:
        return Response(content=SUSPENDED_HTML, media_type="text/html", status_code=503)

    if _subscription_suspended(db, site):
        return Response(content=SUSPENDED_HTML, media_type="text/html", status_code=503)

    if _bandwidth_blocked(db, site):
        return Response(content=BANDWIDTH_HTML, media_type="text/html", status_code=429)

    if not site.active_deployment_id:
        return Response(content=NOTDEPLOYED_HTML, media_type="text/html", status_code=404)

    dep = db.get(StaticSiteDeployment, site.active_deployment_id)
    if not dep:
        raise HTTPException(status_code=404, detail="Deployment tidak ditemukan")

    # Normalisasi path
    if path == "" or path.endswith("/"):
        path = path + "index.html"

    key = f"{dep.deployment_path}/{path}"

    try:
        data, content_type = get_hosting_file(key)
    except Exception:
        # coba sebagai folder → index.html
        last = path.rsplit("/", 1)[-1]
        if "." not in last:
            try:
                data, content_type = get_hosting_file(f"{dep.deployment_path}/{path}/index.html")
            except Exception:
                _cleanup_if_orphaned(db, site, dep)
                raise HTTPException(status_code=404, detail="File tidak ditemukan")
        else:
            _cleanup_if_orphaned(db, site, dep)
            raise HTTPException(status_code=404, detail="File tidak ditemukan")

    _count_bandwidth(db, site, len(data))
    return Response(content=data, media_type=content_type)


def _cleanup_if_orphaned(db: Session, site: StaticSite, dep: StaticSiteDeployment) -> None:
    """
    Jika file deployment ini sudah tidak ada di MiniStack (mis. MiniStack
    di-rebuild), hapus deployment dari DB & kosongkan active jika perlu.
    """
    from botocore.exceptions import ClientError as BotoClientError
    from app.core.ministack import get_s3_client, HOSTING_BUCKET, _ensure_bucket_exists
    from app.core import usage as usage_helper

    s3 = get_s3_client()
    try:
        _ensure_bucket_exists(s3, HOSTING_BUCKET)
        resp = s3.list_objects_v2(Bucket=HOSTING_BUCKET, Prefix=f"{dep.deployment_path}/")
        if resp.get("Contents"):
            return  # file masih ada, bukan orphan
    except BotoClientError:
        return

    if site.active_deployment_id == dep.id:
        site.active_deployment_id = None
    db.delete(dep)
    db.flush()
    sub = db.get(Subscription, site.subscription_id)
    if sub:
        usage_helper.recalculate_hosting(db, sub)
    db.commit()
