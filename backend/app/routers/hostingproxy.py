"""
Proxy hosting ber-autentikasi Access Key — enforcement IAM policy untuk hosting.

Kembaran `/s3` tapi untuk Static Hosting. Klien (skrip/CI) memakai access key
hosting via header `X-Access-Key-Id` & `X-Secret-Key`, lalu policy yang dilekatkan
ke kunci dievaluasi (mesin `core/iam.py`, Allow/Deny, explicit Deny menang).

Kosakata aksi: hosting:ListSites, hosting:Deploy, hosting:DeleteSite (+ wildcard
`hosting:*`). Resource = slug situs atau `*`.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core import usage as usage_helper
from app.core.activity import log_activity
from app.core.iam import authorize
from app.core.ministack import delete_hosting_prefix
from app.core.security import verify_password
from app.database import get_db
from app.models.access_key import AccessKey, KeyPermission, KeyStatus
from app.models.static_site import SiteStatus, StaticSite
from app.models.static_site_deployment import StaticSiteDeployment
from app.models.subscription import Subscription, SubscriptionStatus
from app.routers.hosting import _deploy_zip
from app.schemas.static_site import DeploymentResponse

router = APIRouter(prefix="/hosting-api", tags=["hosting-proxy"])

ACCESS_STATUSES = [
    SubscriptionStatus.active,
    SubscriptionStatus.over_quota,
    SubscriptionStatus.suspended,
]
BASE_URL = "http://localhost:8000"


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
        raise HTTPException(status_code=401, detail="Sertakan header X-Access-Key-Id dan X-Secret-Key.")
    key = db.query(AccessKey).filter(AccessKey.access_key_id == x_access_key_id).first()
    if (not key or key.status != KeyStatus.active
            or not verify_password(x_secret_key, key.secret_key_hash)):
        raise HTTPException(status_code=401, detail="Access key atau secret key tidak valid.")
    if key.category != "hosting":
        raise HTTPException(status_code=403, detail="Kunci ini bukan untuk layanan hosting.")
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == key.user_id,
            Subscription.category == "hosting",
            Subscription.status.in_(ACCESS_STATUSES),
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )
    if not sub:
        raise HTTPException(status_code=403, detail="Langganan hosting untuk kunci ini tidak aktif.")
    key.last_used_at = datetime.utcnow()
    db.commit()
    return KeyContext(key, sub)


def _authorize(ctx: KeyContext, action: str, resource: str, *, write: bool = False) -> None:
    """Policy menggantikan enum permission bila ada; jika tidak, fallback read_only/full."""
    pol = ctx.key.policy
    if pol is not None:
        if not authorize(pol.document, action, resource):
            raise HTTPException(
                status_code=403,
                detail=f"Akses ditolak oleh IAM policy '{pol.name}' untuk {action} pada '{resource}'.",
            )
        return
    if write and ctx.key.permission == KeyPermission.read_only:
        raise HTTPException(status_code=403, detail="Kunci ini Read-Only — operasi tulis/hapus tidak diizinkan.")


def _resolve_site(db: Session, user_id: int, slug: str) -> StaticSite:
    site = db.query(StaticSite).filter(
        StaticSite.slug == slug,
        StaticSite.user_id == user_id,
        StaticSite.status == SiteStatus.active,
    ).first()
    if not site:
        raise HTTPException(status_code=404, detail=f"Situs '{slug}' tidak ditemukan untuk kunci ini.")
    return site


@router.get("/sites")
def proxy_list_sites(ctx: KeyContext = Depends(get_key_ctx), db: Session = Depends(get_db)):
    _authorize(ctx, "hosting:ListSites", "*")
    sites = (
        db.query(StaticSite)
        .filter(StaticSite.user_id == ctx.key.user_id, StaticSite.status == SiteStatus.active)
        .order_by(StaticSite.created_at.asc())
        .all()
    )
    return {"sites": [
        {"slug": s.slug, "site_name": s.site_name,
         "url": f"{BASE_URL}/sites/{s.slug}/",
         "deployed": bool(s.active_deployment_id)}
        for s in sites
    ]}


@router.post("/sites/{slug}/deploy", response_model=DeploymentResponse, status_code=201)
async def proxy_deploy(slug: str, file: UploadFile = File(...), prefix: str = Form(""),
                       ctx: KeyContext = Depends(get_key_ctx), db: Session = Depends(get_db)):
    _authorize(ctx, "hosting:Deploy", slug, write=True)
    site = _resolve_site(db, ctx.key.user_id, slug)
    raw = await file.read()
    dep = _deploy_zip(db, site, ctx.sub, ctx.key.user_id, raw, prefix)
    dr = DeploymentResponse.model_validate(dep)
    dr.is_active = True
    return dr


@router.delete("/sites/{slug}")
def proxy_delete_site(slug: str, ctx: KeyContext = Depends(get_key_ctx), db: Session = Depends(get_db)):
    _authorize(ctx, "hosting:DeleteSite", slug, write=True)
    site = _resolve_site(db, ctx.key.user_id, slug)
    try:
        delete_hosting_prefix(f"{site.slug}/")
    except Exception:
        pass
    site.status = SiteStatus.deleted
    site.deleted_at = datetime.utcnow()
    site.active_deployment_id = None
    usage_helper.recalculate_hosting(db, ctx.sub)
    usage_helper.evaluate_quota_status(db, ctx.sub)
    log_activity(
        db, actor_user_id=ctx.key.user_id, action="STATIC_SITE_DELETED",
        description=f"Menghapus situs '{site.site_name}' via access key",
        target_type="SITE", target_id=site.id,
    )
    db.commit()
    return {"message": "deleted", "slug": slug}
