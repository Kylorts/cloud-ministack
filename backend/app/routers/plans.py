from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.plan import ServicePlan
from app.schemas.plan import PlanResponse

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("", response_model=list[PlanResponse])
def list_plans(category: str | None = None, db: Session = Depends(get_db)):
    q = db.query(ServicePlan).filter(ServicePlan.is_active == True)
    if category:
        q = q.filter(ServicePlan.category == category)
    return q.order_by(ServicePlan.price.asc()).all()


@router.get("/{plan_id}", response_model=PlanResponse)
def get_plan(plan_id: int, db: Session = Depends(get_db)):
    from fastapi import HTTPException, status
    plan = db.get(ServicePlan, plan_id)
    if not plan or not plan.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paket tidak ditemukan")
    return plan
