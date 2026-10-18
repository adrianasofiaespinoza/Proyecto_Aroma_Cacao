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
from app.models.lot import Lot
from app.models.machine import Machine
from app.services.alerts import update_stock_alerts
from app.models.movement import (
    Movement,
    MovementDetail,
)
from app.models.product import Product
from app.models.user import User
from app.schemas.movement import (
    MovementCreate,
    MovementResponse,
)
from app.security.auth import (
    get_current_user,
)

router = APIRouter(
    prefix="/movements",
    tags=["Movements"]
)


# ============================================================
# LIST MOVEMENTS
# ============================================================

@router.get(
    "",
    response_model=list[MovementResponse],
    summary="List all movements"
)
def list_movements(
    status_filter: str | None = None,
    type_filter: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Movement).order_by(Movement.id.desc())

    if status_filter:
        stmt = stmt.where(Movement.status == status_filter)

    if type_filter:
        stmt = stmt.where(Movement.type == type_filter)

    return db.scalars(stmt).all()


# ============================================================
# GET MOVEMENT BY ID
# ============================================================

@router.get(
    "/{movement_id}",
    response_model=MovementResponse,
    summary="Get movement by ID"
)
def get_movement(
    movement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    movement = db.get(Movement, movement_id)

    if not movement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movement not found"
        )

    return movement


# ============================================================
# CREATE MOVEMENT REQUEST
# ============================================================

@router.post(
    "",
    response_model=MovementResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a movement request"
)

def create_movement(
    movement_data: MovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in {"Operator", "Coordinator"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only Operators and Coordinators "
                "can create movement requests"
            )
        )

    # --------------------------------------------------------
    # Validate quantities and relations
    # --------------------------------------------------------
    for detail in movement_data.details:


        if movement_data.type in ("ENTRY", "EXIT") and detail.quantity <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Quantity must be greater than zero for ENTRY and EXIT movements"
            )

        product = db.get(Product, detail.product_id)
        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {detail.product_id} not found"
            )

        if product.status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Product '{product.name}' ({product.internal_code}) is inactive"
            )

        if detail.lot_id is not None:
            lot = db.get(Lot, detail.lot_id)
            if not lot:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Lot {detail.lot_id} not found"
                )
            if lot.product_id != product.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Lot {lot.lot_number} does not belong to product '{product.name}'"
                )

        if detail.machine_id is not None:
            machine = db.get(Machine, detail.machine_id)
            if not machine:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Machine {detail.machine_id} not found"
                )

    # --------------------------------------------------------
    # Create movement
    # --------------------------------------------------------
    new_movement = Movement(
        type=movement_data.type,
        requesting_user_id=current_user.id,
        status="pending",
        reason=movement_data.reason,
        work_order_number=movement_data.work_order_number
    )

    db.add(new_movement)
    db.flush()

    for detail in movement_data.details:
        new_detail = MovementDetail(
            movement_id=new_movement.id,
            product_id=detail.product_id,
            quantity=detail.quantity,
            lot_id=detail.lot_id,
            machine_id=detail.machine_id
        )
        db.add(new_detail)

    db.commit()
    db.refresh(new_movement)

    return new_movement


# ============================================================
# AUTHORIZE MOVEMENT (with pessimistic locking)
# ============================================================

@router.patch(
    "/{movement_id}/authorize",
    response_model=MovementResponse,
    summary="Authorize a movement"
)
def authorize_movement(
    movement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Coordinator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Coordinators can authorize movements"
        )

    # Lock movement row to prevent concurrent authorizations
    movement = db.scalar(
        select(Movement)
        .where(Movement.id == movement_id)
        .with_for_update()
    )

    if not movement:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movement not found"
        )

    if movement.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Movement is already {movement.status}"
        )

    details = movement.details
    if not details:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Movement has no details"
        )

    # Validate each product with row locking and apply stock mutations
    for detail in details:
        product = db.scalar(
            select(Product)
            .where(Product.id == detail.product_id)
            .with_for_update()
        )

        if not product:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Product {detail.product_id} not found"
            )

        if product.status != "active":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot authorize: Product '{product.name}' ({product.internal_code}) is inactive"
            )

        if movement.type == "ENTRY":
            product.current_stock += detail.quantity

        elif movement.type == "EXIT":
            if product.current_stock < detail.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Insufficient stock for product '{product.name}'. "
                        f"Current: {product.current_stock}, Requested: {detail.quantity}"
                    )
                )
            product.current_stock -= detail.quantity

        elif movement.type == "ADJUSTMENT":
            # Establishes the real counted physical stock
            product.current_stock = detail.quantity

        update_stock_alerts(db, product)

    # --------------------------------------------------------
    # Finalize authorization
    # --------------------------------------------------------
    movement.status = "authorized"
    movement.authorizing_user_id = current_user.id

    db.commit()
    db.refresh(movement)

    return movement