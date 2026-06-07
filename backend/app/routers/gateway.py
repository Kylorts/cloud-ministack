from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core import usage as usage_helper
from app.core.ministack import get_hosting_file
from app.database import get_db
from app.models.static_site import SiteStatus, StaticSite
from app.models.static_site_deployment import StaticSiteDeployment
from app.models.subscription import Subscription

router = APIRouter(tags=["gateway"])


SUSPENDED_HTML = """<!doctype html><html><head><meta charset="utf-8">
<title>Service Suspended</title>
<style>body{font-family:system-ui;display:flex;align-items:center;justify-content:center;
height:100vh;margin:0;background:#f9fafb;color:#374151;text-align:center}</style></head>
<body><div><h1>Layanan Ditangguhkan</h1><p>Situs ini sedang tidak aktif.</p></div></body></html>"""


def _count_bandwidth(db: Session, site: StaticSite, nbytes: int) -> None:
    """Tambahkan bandwidth terpakai ke counter subscription hosting situs."""
    try:
        sub = db.get(Subscription, site.subscription_id)
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

    if not site.active_deployment_id:
        raise HTTPException(status_code=404, detail="Situs belum di-deploy")

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
