from typing import Literal

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
from app.services.stock import available_quantity, is_expired, loaned_quantity
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
# LOT RULES (shared by creation and authorization)
# ============================================================

def check_detail_lot(
    lot: Lot | None,
    lot_id: int | None,
    product: Product,
    movement_type: str
):

    if product.requires_lot and lot_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product '{product.name}' requires a lot"
        )

    if not product.requires_lot and lot_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product '{product.name}' is not tracked by lots"
        )

    if lot_id is None:
        return

    if not lot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Lot {lot_id} not found"
        )

    if lot.product_id != product.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Lot {lot.lot_number} does not belong to product '{product.name}'"
        )

    # Un lote vencido solo se puede retirar con un ajuste
    if movement_type in ("ENTRY", "EXIT") and is_expired(lot):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Lot {lot.lot_number} expired on {lot.expiration_date}; "
                "use an ADJUSTMENT to remove it"
            )
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
    status_filter: Literal["pending", "authorized", "rejected"] | None = None,
    type_filter: Literal["ENTRY", "EXIT", "ADJUSTMENT"] | None = None,
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

        check_detail_lot(
            db.get(Lot, detail.lot_id) if detail.lot_id is not None else None,
            detail.lot_id,
            product,
            movement_data.type
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

        # Bloquea el lote y repite las reglas: pudo vencer mientras estaba pendiente
        lot = None
        if detail.lot_id is not None:
            lot = db.scalar(
                select(Lot)
                .where(Lot.id == detail.lot_id)
                .with_for_update()
            )

        check_detail_lot(lot, detail.lot_id, product, movement.type)

        if movement.type == "ENTRY":
            product.current_stock += detail.quantity
            if lot:
                lot.remaining_quantity += detail.quantity

        elif movement.type == "EXIT":
            # Las herramientas prestadas no pueden salir del inventario
            available = available_quantity(db, product)
            if available < detail.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Insufficient stock for product '{product.name}'. "
                        f"Current: {product.current_stock}, "
                        f"Loaned: {loaned_quantity(db, product.id)}, "
                        f"Available: {available}, Requested: {detail.quantity}"
                    )
                )
            if lot and lot.remaining_quantity < detail.quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Insufficient quantity in lot {lot.lot_number}. "
                        f"Remaining: {lot.remaining_quantity}, Requested: {detail.quantity}"
                    )
                )
            product.current_stock -= detail.quantity
            if lot:
                lot.remaining_quantity -= detail.quantity

        elif movement.type == "ADJUSTMENT" and lot:
            # quantity = lo contado de este lote; el stock cambia en la diferencia
            product.current_stock += detail.quantity - lot.remaining_quantity
            lot.remaining_quantity = detail.quantity

        elif movement.type == "ADJUSTMENT":
            # quantity = lo contado en bodega; las herramientas prestadas
            # no están físicamente allí, así que se suman al stock final
            if detail.quantity < 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Adjustment quantity for product '{product.name}' cannot be negative"
                )
            product.current_stock = detail.quantity + loaned_quantity(db, product.id)

        update_stock_alerts(db, product)

    # --------------------------------------------------------
    # Finalize authorization
    # --------------------------------------------------------
    movement.status = "authorized"
    movement.authorizing_user_id = current_user.id

    db.commit()
    db.refresh(movement)

    return movement


# ============================================================
# REJECT MOVEMENT
# ============================================================

@router.patch(
    "/{movement_id}/reject",
    response_model=MovementResponse,
    summary="Reject a movement"
)
def reject_movement(
    movement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "Coordinator":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Coordinators can reject movements"
        )

    # Same lock as authorization so both cannot run at once
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

    # Rejection never touches stock or alerts
    movement.status = "rejected"
    movement.authorizing_user_id = current_user.id

    db.commit()
    db.refresh(movement)

    return movement
