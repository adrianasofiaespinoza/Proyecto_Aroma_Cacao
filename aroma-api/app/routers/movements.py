from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy.orm import Session

from app.database import get_db

from app.models.user import User
from app.models.product import Product
from app.models.lot import Lot
from app.models.machine import Machine
from app.models.alert import Alert

from app.models.movement import (
    Movement,
    MovementDetail,
)

from app.schemas.movement import (
    MovementCreate,
)

from app.security.auth import (
    get_current_user,
)


router = APIRouter(
    prefix="/movements",
    tags=["Movements"]
)


# ============================================================
# CREATE MOVEMENT REQUEST
# ============================================================

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    summary="Create a movement request"
)
def create_movement(
    movement_data: MovementCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    # --------------------------------------------------------
    # Validate products
    # --------------------------------------------------------

    for detail in movement_data.details:

        product = db.get(
            Product,
            detail.product_id
        )

        if not product:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    f"Product {detail.product_id} "
                    "not found"
                )
            )

        if product.status != "active":

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Product {detail.product_id} "
                    "is inactive"
                )
            )

    # --------------------------------------------------------
    # Create movement
    # --------------------------------------------------------

    new_movement = Movement(
        type=movement_data.type,
        requesting_user_id=current_user.id,
        status="pending",
        reason=movement_data.reason,
        work_order_number=(
            movement_data.work_order_number
        )
    )

    db.add(new_movement)
    db.flush()

    # --------------------------------------------------------
    # Create movement details
    # --------------------------------------------------------

    for detail in movement_data.details:

        new_detail = MovementDetail(
            movement_id=new_movement.id,
            product_id=detail.product_id,
            quantity=detail.quantity,
            lot_id=detail.lot_id,
            machine_id=detail.machine_id
        )

        db.add(new_detail)

    # --------------------------------------------------------
    # Save movement
    # --------------------------------------------------------

    db.commit()
    db.refresh(new_movement)

    return {
        "id": new_movement.id,
        "type": new_movement.type,
        "status": new_movement.status,
        "requesting_user_id": (
            new_movement.requesting_user_id
        ),
        "reason": new_movement.reason,
        "work_order_number": (
            new_movement.work_order_number
        )
    }


# ============================================================
# AUTHORIZE MOVEMENT
# ============================================================

@router.patch(
    "/{movement_id}/authorize",
    summary="Authorize a movement"
)
def authorize_movement(
    movement_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        get_current_user
    )
):

    # --------------------------------------------------------
    # Validate role
    # --------------------------------------------------------

    if current_user.role != "Coordinator":

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only Coordinators can "
                "authorize movements"
            )
        )

    # --------------------------------------------------------
    # Find movement
    # --------------------------------------------------------

    movement = db.get(
        Movement,
        movement_id
    )

    if not movement:

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Movement not found"
        )

    # --------------------------------------------------------
    # Validate movement status
    # --------------------------------------------------------

    if movement.status != "pending":

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Movement is not pending"
        )

    # --------------------------------------------------------
    # Get movement details
    # --------------------------------------------------------

    details = (
        db.query(MovementDetail)
        .filter(
            MovementDetail.movement_id == movement.id
        )
        .all()
    )

    if not details:

        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Movement has no details"
        )

    # --------------------------------------------------------
    # Validate and update stock
    # --------------------------------------------------------

    for detail in details:

        product = db.get(
            Product,
            detail.product_id
        )

        if not product:

            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    f"Product {detail.product_id} "
                    "not found"
                )
            )

        if movement.type == "ENTRY":

            product.current_stock += detail.quantity

        elif movement.type == "EXIT":

            if product.current_stock < detail.quantity:

                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"Insufficient stock for "
                        f"product {detail.product_id}"
                    )
                )

            product.current_stock -= detail.quantity

        elif movement.type == "ADJUSTMENT":

            product.current_stock = detail.quantity

        # ----------------------------------------------------
        # Generate low-stock alert
        # ----------------------------------------------------

        if product.current_stock <= product.minimum_stock:

            active_alert = (
                db.query(Alert)
                .filter(
                    Alert.product_id == product.id,
                    Alert.status == "active"
                )
                .first()
            )

            if not active_alert:

                alert = Alert(
                    product_id=product.id,
                    stock_at_alert=product.current_stock,
                    status="active",
                )

                db.add(alert)
    # --------------------------------------------------------
    # Authorize movement
    # --------------------------------------------------------

    movement.status = "authorized"
    movement.authorizing_user_id = current_user.id

    # --------------------------------------------------------
    # Save authorization and stock changes
    # --------------------------------------------------------

    db.commit()
    db.refresh(movement)

    return {
        "id": movement.id,
        "type": movement.type,
        "status": movement.status,
        "requesting_user_id": (
            movement.requesting_user_id
        ),
        "authorizing_user_id": (
            movement.authorizing_user_id
        ),
        "reason": movement.reason,
        "work_order_number": (
            movement.work_order_number
        )
    }