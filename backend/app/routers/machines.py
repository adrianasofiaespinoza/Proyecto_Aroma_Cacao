from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.machine import Machine, ProductMachine
from app.models.product import Product
from app.models.user import User
from app.schemas.machine import (
    MachineCreate,
    MachineProductLink,
    MachineResponse,
)
from app.security.auth import get_current_user, require_roles


router = APIRouter(
    prefix="/machines",
    tags=["Machines"]
)


def get_machine_or_404(db: Session, machine_id: int) -> Machine:

    machine = db.get(Machine, machine_id)

    if not machine:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Machine not found"
        )

    return machine


def ensure_unique_code(
    db: Session,
    code: str,
    exclude_id: int | None = None
):

    stmt = select(Machine.id).where(
        Machine.identification_code == code
    )
    if exclude_id is not None:
        stmt = stmt.where(Machine.id != exclude_id)

    if db.scalar(stmt):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Identification code already exists"
        )


# ============================================================
# LIST / GET MACHINES
# ============================================================

@router.get(
    "",
    response_model=list[MachineResponse],
    summary="List machines"
)
def list_machines(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    return db.scalars(
        select(Machine).order_by(Machine.name)
    ).all()


@router.get(
    "/{machine_id}",
    response_model=MachineResponse,
    summary="Get machine by ID"
)
def get_machine(
    machine_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    return get_machine_or_404(db, machine_id)


# ============================================================
# CREATE / UPDATE MACHINE (Coordinator)
# Sin eliminación: los movimientos históricos la referencian
# ============================================================

@router.post(
    "",
    response_model=MachineResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a machine"
)
def create_machine(
    machine_data: MachineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Coordinator"))
):

    ensure_unique_code(db, machine_data.identification_code)

    machine = Machine(**machine_data.model_dump())
    db.add(machine)
    db.commit()
    db.refresh(machine)

    return machine


@router.put(
    "/{machine_id}",
    response_model=MachineResponse,
    summary="Update a machine"
)
def update_machine(
    machine_id: int,
    machine_data: MachineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Coordinator"))
):

    machine = get_machine_or_404(db, machine_id)
    ensure_unique_code(db, machine_data.identification_code, exclude_id=machine.id)

    machine.name = machine_data.name
    machine.identification_code = machine_data.identification_code
    machine.location = machine_data.location

    db.commit()
    db.refresh(machine)

    return machine


# ============================================================
# COMPATIBLE SPARE PARTS (Coordinator)
# ============================================================

@router.post(
    "/{machine_id}/products",
    response_model=MachineResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Associate a compatible spare part"
)
def add_machine_product(
    machine_id: int,
    link: MachineProductLink,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Coordinator"))
):

    machine = get_machine_or_404(db, machine_id)

    if not db.get(Product, link.product_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    if link.product_id in machine.product_ids:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Product already associated with this machine"
        )

    machine.product_links.append(
        ProductMachine(product_id=link.product_id)
    )
    db.commit()
    db.refresh(machine)

    return machine


@router.delete(
    "/{machine_id}/products/{product_id}",
    response_model=MachineResponse,
    summary="Remove a compatible spare part"
)
def remove_machine_product(
    machine_id: int,
    product_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Coordinator"))
):

    machine = get_machine_or_404(db, machine_id)

    link = next(
        (item for item in machine.product_links if item.product_id == product_id),
        None
    )

    if not link:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product is not associated with this machine"
        )

    machine.product_links.remove(link)
    db.commit()
    db.refresh(machine)

    return machine
