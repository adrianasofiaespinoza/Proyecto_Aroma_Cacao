from fastapi import (
    APIRouter,
    Depends,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.product import (
    Category,
    UnitOfMeasure,
)
from app.models.user import User
from app.schemas.product import (
    CategoryResponse,
    UnitOfMeasureResponse,
)
from app.security.auth import get_current_user


router = APIRouter(
    tags=["Catalogs"]
)


# ============================================================
# CATEGORIES
# ============================================================

@router.get(
    "/categories",
    response_model=list[CategoryResponse],
    summary="List product categories"
)
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    return db.scalars(
        select(Category).order_by(
            Category.name
        )
    ).all()


# ============================================================
# UNITS OF MEASURE
# ============================================================

@router.get(
    "/units",
    response_model=list[UnitOfMeasureResponse],
    summary="List units of measure"
)
def list_units(
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    return db.scalars(
        select(UnitOfMeasure).order_by(
            UnitOfMeasure.name
        )
    ).all()
