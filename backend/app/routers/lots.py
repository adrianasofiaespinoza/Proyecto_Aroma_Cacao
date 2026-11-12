from datetime import date, timedelta

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Query,
    status,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.lot import Lot
from app.models.product import Product
from app.models.user import User
from app.schemas.lot import (
    LotCreate,
    LotResponse,
)
from app.security.auth import get_current_user, require_roles


router = APIRouter(
    tags=["Lots"]
)


def ensure_unique_lot_number(
    db: Session,
    product_id: int,
    lot_number: str,
    exclude_id: int | None = None
):

    stmt = select(Lot.id).where(
        Lot.product_id == product_id,
        Lot.lot_number == lot_number
    )
    if exclude_id is not None:
        stmt = stmt.where(Lot.id != exclude_id)

    if db.scalar(stmt):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Lot number already exists for this product"
        )


# ============================================================
# LIST LOTS
# ============================================================

@router.get(
    "/lots",
    response_model=list[LotResponse],
    summary="List lots, optionally only those with stock expiring soon"
)
def list_lots(
    expiring_within_days: int | None = Query(default=None, ge=0, le=3650),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    stmt = select(Lot).order_by(Lot.expiration_date.asc().nulls_last(), Lot.id)

    # Incluye los ya vencidos que todavía tienen existencias
    if expiring_within_days is not None:
        stmt = stmt.where(
            Lot.remaining_quantity > 0,
            Lot.expiration_date <= date.today() + timedelta(days=expiring_within_days)
        )

    return db.scalars(stmt).all()


# ============================================================
# CREATE LOT
# Empieza vacío: la cantidad solo cambia con movimientos autorizados
# ============================================================

@router.post(
    "/products/{product_id}/lots",
    response_model=LotResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a lot for a product"
)
def create_lot(
    product_id: int,
    lot_data: LotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Operator", "Coordinator"))
):

    product = db.get(Product, product_id)

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    if product.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product '{product.name}' is inactive"
        )

    if not product.requires_lot:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product '{product.name}' is not tracked by lots"
        )

    if lot_data.expiration_date and lot_data.expiration_date < date.today():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Expiration date cannot be in the past"
        )

    ensure_unique_lot_number(db, product.id, lot_data.lot_number)

    lot = Lot(
        product_id=product.id,
        lot_number=lot_data.lot_number,
        expiration_date=lot_data.expiration_date,
        remaining_quantity=0
    )

    db.add(lot)
    db.commit()
    db.refresh(lot)

    return lot


# ============================================================
# UPDATE LOT (Coordinator)
# Corrige número o vencimiento; la cantidad no se edita
# ============================================================

@router.put(
    "/lots/{lot_id}",
    response_model=LotResponse,
    summary="Correct a lot's number or expiration date"
)
def update_lot(
    lot_id: int,
    lot_data: LotCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Coordinator"))
):

    lot = db.get(Lot, lot_id)

    if not lot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lot not found"
        )

    ensure_unique_lot_number(db, lot.product_id, lot_data.lot_number, exclude_id=lot.id)

    lot.lot_number = lot_data.lot_number
    lot.expiration_date = lot_data.expiration_date

    db.commit()
    db.refresh(lot)

    return lot
