import io
import re
import secrets
import zipfile
import mimetypes
from datetime import datetime

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.activity import log_activity
from app.core.deps import get_current_user
from app.core import usage as usage_helper
from app.core.ministack import (
    ensure_hosting_bucket, upload_hosting_file, delete_hosting_prefix,
)
from app.database import get_db
from app.models.static_site import SiteStatus, StaticSite
from app.models.static_site_deployment import DeploymentStatus, StaticSiteDeployment
from app.models.subscription import ACTIVE_LIKE_STATUSES, Subscription, SubscriptionStatus
from app.models.user import User
from app.schemas.static_site import (
    DeploymentResponse, SiteCreateRequest, SiteDetailResponse, SiteResponse,
)

router = APIRouter(prefix="/hosting", tags=["hosting"])

BASE_URL = "http://localhost:8000"


# ── Helpers ────────────────────────────────────────────────────────

def _get_active_hosting_sub(user_id: int, db: Session) -> Subscription:
    sub = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user_id,
            Subscription.category == "hosting",
            Subscription.status == SubscriptionStatus.active,
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )
    if not sub:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Anda belum memiliki langganan Hosting aktif. Pilih paket Hosting terlebih dahulu.",
        )
    return sub


def _slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s[:50] or "site"


def _unique_slug(base: str, db: Session) -> str:
    candidate = base
    n = 2
    while db.query(StaticSite).filter(StaticSite.slug == candidate).first():
        candidate = f"{base}-{n}"
        n += 1
    return candidate


def _unique_deployment_ref(db: Session) -> str:
    while True:
        ref = "dep_" + secrets.token_hex(4)
        if not db.query(StaticSiteDeployment).filter(
            StaticSiteDeployment.deployment_ref == ref
        ).first():
            return ref


def _site_to_response(site: StaticSite, db: Session) -> SiteResponse:
    resp = SiteResponse.model_validate(site)
    resp.url = f"{BASE_URL}/sites/{site.slug}/"
    if site.active_deployment_id:
        dep = db.get(StaticSiteDeployment, site.active_deployment_id)
        if dep:
            resp.last_deployed_at = dep.deployed_at
            resp.total_size_bytes = dep.total_size_bytes
            resp.file_count = dep.file_count
    return resp


def _hosting_used_bytes(user_id: int, db: Session) -> int:
    """Total build size dari deployment aktif semua situs user."""
    sites = db.query(StaticSite).filter(
        StaticSite.user_id == user_id,
        StaticSite.status.in_([SiteStatus.active, SiteStatus.suspended]),
    ).all()
    total = 0
    for s in sites:
        if s.active_deployment_id:
            dep = db.get(StaticSiteDeployment, s.active_deployment_id)
            if dep:
                total += dep.total_size_bytes
    return total


# ── Endpoints ──────────────────────────────────────────────────────

@router.get("/usage")
def hosting_usage(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_hosting_sub(current_user.id, db)
    counter = usage_helper.get_or_create_counter(db, sub)
    db.commit()
    build_limit = sub.plan.storage_limit_bytes
    return {
        "site_count": counter.static_site_count,
        "site_limit": sub.plan.static_site_limit,
        "build_used_bytes": counter.storage_used_bytes,
        "build_limit_bytes": build_limit,
        "bandwidth_used_bytes": counter.bandwidth_used_bytes,
        "bandwidth_limit_bytes": sub.plan.bandwidth_limit_bytes,
        "plan_name": sub.plan.name,
    }


@router.get("/sites", response_model=list[SiteResponse])
def list_sites(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_active_hosting_sub(current_user.id, db)
    sites = (
        db.query(StaticSite)
        .filter(
            StaticSite.user_id == current_user.id,
            StaticSite.status != SiteStatus.deleted,
        )
        .order_by(StaticSite.created_at.desc())
        .all()
    )
    return [_site_to_response(s, db) for s in sites]


@router.post("/sites", response_model=SiteResponse, status_code=status.HTTP_201_CREATED)
def create_site(
    body: SiteCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_hosting_sub(current_user.id, db)

    active_count = db.query(StaticSite).filter(
        StaticSite.user_id == current_user.id,
        StaticSite.status.in_([SiteStatus.active, SiteStatus.suspended]),
    ).count()
    if active_count >= sub.plan.static_site_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Batas situs paket Anda adalah {sub.plan.static_site_limit}. Upgrade paket untuk menambah situs.",
        )

    name = body.site_name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Nama situs tidak boleh kosong")

    slug = _unique_slug(_slugify(name), db)
    site = StaticSite(
        user_id=current_user.id,
        subscription_id=sub.id,
        site_name=name,
        slug=slug,
        status=SiteStatus.active,
    )
    db.add(site)
    db.flush()

    usage_helper.recalculate_hosting(db, sub)
    log_activity(
        db,
        actor_user_id=current_user.id,
        action="STATIC_SITE_CREATED",
        description=f"Membuat situs '{name}'",
        target_type="SITE",
        target_id=site.id,
    )
    db.commit()
    return _site_to_response(site, db)


@router.get("/sites/{site_id}", response_model=SiteDetailResponse)
def get_site(
    site_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_active_hosting_sub(current_user.id, db)
    site = db.query(StaticSite).filter(
        StaticSite.id == site_id,
        StaticSite.user_id == current_user.id,
        StaticSite.status != SiteStatus.deleted,
    ).first()
    if not site:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Situs tidak ditemukan")

    base = _site_to_response(site, db)
    detail = SiteDetailResponse(**base.model_dump())

    deployments = (
        db.query(StaticSiteDeployment)
        .filter(StaticSiteDeployment.site_id == site.id)
        .order_by(StaticSiteDeployment.created_at.desc())
        .all()
    )
    detail.deployments = []
    for dep in deployments:
        dr = DeploymentResponse.model_validate(dep)
        dr.is_active = (dep.id == site.active_deployment_id)
        detail.deployments.append(dr)
    return detail


@router.post("/sites/{site_id}/deploy", response_model=DeploymentResponse, status_code=status.HTTP_201_CREATED)
async def deploy_site(
    site_id: int,
    file: UploadFile = File(...),
    prefix: str = Form(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_hosting_sub(current_user.id, db)
    site = db.query(StaticSite).filter(
        StaticSite.id == site_id,
        StaticSite.user_id == current_user.id,
        StaticSite.status == SiteStatus.active,
    ).first()
    if not site:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Situs tidak ditemukan")

    raw = await file.read()
    if not zipfile.is_zipfile(io.BytesIO(raw)):
        raise HTTPException(status_code=422, detail="File harus berupa ZIP")

    # Normalisasi prefix (folder sumber di dalam ZIP)
    clean_prefix = prefix.strip().strip("/")
    if clean_prefix:
        clean_prefix += "/"

    # Extract & kumpulkan file
    files: list[tuple[str, bytes]] = []  # (relative_path, data)
    total_size = 0
    with zipfile.ZipFile(io.BytesIO(raw)) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = info.filename
            # buang folder root tunggal jika ZIP dibungkus 1 folder
            if clean_prefix:
                if not name.startswith(clean_prefix):
                    continue
                rel = name[len(clean_prefix):]
            else:
                rel = name
            if not rel or rel.startswith("__MACOSX"):
                continue
            data = zf.read(info)
            files.append((rel, data))
            total_size += len(data)

    if not files:
        raise HTTPException(status_code=422, detail="ZIP kosong atau folder/prefix tidak ditemukan")

    # Validasi index.html di root
    rel_paths = {f[0] for f in files}
    if "index.html" not in rel_paths:
        raise HTTPException(
            status_code=422,
            detail="Tidak ada index.html di root direktori. Pastikan file index.html ada di folder yang dipilih.",
        )

    # Cek kuota build size hosting
    limit = sub.plan.storage_limit_bytes
    current_used = _hosting_used_bytes(current_user.id, db)
    current_site_active_size = 0
    if site.active_deployment_id:
        cur = db.get(StaticSiteDeployment, site.active_deployment_id)
        if cur:
            current_site_active_size = cur.total_size_bytes
    projected = current_used - current_site_active_size + total_size
    if projected > limit:
        sisa_mb = max(0, (limit - (current_used - current_site_active_size))) // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Ukuran build melebihi kuota hosting. Sisa ruang: {sisa_mb} MB. Upgrade paket untuk menambah kapasitas.",
        )

    # Buat deployment + upload ke MiniStack
    ref = _unique_deployment_ref(db)
    deployment_path = f"{site.slug}/{ref}"
    dep = StaticSiteDeployment(
        site_id=site.id,
        user_id=current_user.id,
        deployment_ref=ref,
        deployment_path=deployment_path,
        status=DeploymentStatus.deploying,
        file_count=len(files),
        total_size_bytes=total_size,
    )
    db.add(dep)
    db.flush()

    try:
        ensure_hosting_bucket()
        for rel, data in files:
            ctype = mimetypes.guess_type(rel)[0] or "application/octet-stream"
            upload_hosting_file(f"{deployment_path}/{rel}", data, ctype)
    except Exception as e:
        dep.status = DeploymentStatus.failed
        dep.error_message = str(e)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Gagal mengunggah build ke server: {str(e)}",
        )

    dep.status = DeploymentStatus.success
    dep.deployed_at = datetime.utcnow()
    site.active_deployment_id = dep.id

    usage_helper.recalculate_hosting(db, sub)
    log_activity(
        db,
        actor_user_id=current_user.id,
        action="STATIC_SITE_DEPLOYED",
        description=f"Deploy versi baru situs '{site.site_name}' ({len(files)} file)",
        target_type="SITE",
        target_id=site.id,
        metadata={"deployment_ref": ref, "file_count": len(files), "size_bytes": total_size},
    )
    db.commit()
    db.refresh(dep)

    dr = DeploymentResponse.model_validate(dep)
    dr.is_active = True
    return dr


@router.post("/sites/{site_id}/deployments/{deployment_id}/rollback", response_model=DeploymentResponse)
def rollback_deployment(
    site_id: int,
    deployment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_hosting_sub(current_user.id, db)
    site = db.query(StaticSite).filter(
        StaticSite.id == site_id,
        StaticSite.user_id == current_user.id,
        StaticSite.status == SiteStatus.active,
    ).first()
    if not site:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Situs tidak ditemukan")

    dep = db.query(StaticSiteDeployment).filter(
        StaticSiteDeployment.id == deployment_id,
        StaticSiteDeployment.site_id == site.id,
        StaticSiteDeployment.status == DeploymentStatus.success,
    ).first()
    if not dep:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deployment tidak ditemukan")

    if site.active_deployment_id == dep.id:
        raise HTTPException(status_code=400, detail="Deployment ini sudah aktif")

    site.active_deployment_id = dep.id

    usage_helper.recalculate_hosting(db, sub)
    log_activity(
        db,
        actor_user_id=current_user.id,
        action="STATIC_SITE_ROLLBACK",
        description=f"Rollback situs '{site.site_name}' ke deployment {dep.deployment_ref}",
        target_type="SITE",
        target_id=site.id,
    )
    db.commit()
    db.refresh(dep)
    dr = DeploymentResponse.model_validate(dep)
    dr.is_active = True
    return dr


@router.delete("/sites/{site_id}", status_code=status.HTTP_200_OK)
def delete_site(
    site_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sub = _get_active_hosting_sub(current_user.id, db)
    site = db.query(StaticSite).filter(
        StaticSite.id == site_id,
        StaticSite.user_id == current_user.id,
        StaticSite.status == SiteStatus.active,
    ).first()
    if not site:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Situs tidak ditemukan")

    # Hapus semua file hosting milik situs ini
    try:
        delete_hosting_prefix(f"{site.slug}/")
    except Exception:
        pass

    site.status = SiteStatus.deleted
    site.deleted_at = datetime.utcnow()
    site.active_deployment_id = None

    usage_helper.recalculate_hosting(db, sub)
    log_activity(
        db,
        actor_user_id=current_user.id,
        action="STATIC_SITE_DELETED",
        description=f"Menghapus situs '{site.site_name}'",
        target_type="SITE",
        target_id=site.id,
    )
    db.commit()
    return {"message": "Situs berhasil dihapus"}
