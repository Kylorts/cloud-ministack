from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.database import get_db
from app.models.activity_log import ActivityLog
from app.models.user import User
from app.schemas.activity_log import ActivityLogResponse

router = APIRouter(prefix="/activity-logs", tags=["activity"])


@router.get("", response_model=list[ActivityLogResponse])
def list_my_activity(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(ActivityLog)
        .filter(ActivityLog.actor_user_id == current_user.id)
        .order_by(ActivityLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
