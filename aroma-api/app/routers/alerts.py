from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.alert import Alert
from app.models.user import User
from app.security.auth import get_current_user


router = APIRouter(
    prefix="/alerts",
    tags=["Alerts"]
)


# ============================================================
# GET ALL ALERTS
# ============================================================

@router.get(
    "",
    summary="Get all alerts"
)
def get_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    alerts = db.scalars(
        select(Alert).order_by(
            Alert.id
        )
    ).all()

    return alerts
