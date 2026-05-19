from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_admin_user, get_db
from app.models.user import User, UserStatus
from app.schemas.admin import StatsResponse

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    _: User = Depends(get_admin_user),
):
    active_users = db.query(User).filter(User.status == UserStatus.active).count()

    return StatsResponse(
        uptime_percent=99.9,
        physical_nodes_healthy=4,
        active_users=active_users,
        total_instances=420,
    )
