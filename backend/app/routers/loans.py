from datetime import datetime, timezone
from typing import Literal

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
)

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.loan import Loan, Worker
from app.models.product import Product
from app.models.user import User
from app.schemas.loan import (
    LoanCreate,
    LoanResponse,
    WorkerResponse,
)
from app.security.auth import get_current_user, require_roles
from app.services.stock import available_quantity


router = APIRouter(
    tags=["Loans"]
)


# ============================================================
# WORKERS
# ============================================================

@router.get(
    "/workers",
    response_model=list[WorkerResponse],
    summary="List workers"
)
def list_workers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    return db.scalars(
        select(Worker).order_by(Worker.full_name)
    ).all()


# ============================================================
# LIST LOANS
# ============================================================

@router.get(
    "/loans",
    response_model=list[LoanResponse],
    summary="List loans"
)
def list_loans(
    status_filter: Literal["loaned", "returned"] | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):

    stmt = select(Loan).order_by(Loan.id.desc())

    if status_filter:
        stmt = stmt.where(Loan.status == status_filter)

    return db.scalars(stmt).all()


# ============================================================
# CREATE LOAN
# No modifica current_stock: disponible = stock - prestado
# ============================================================

@router.post(
    "/loans",
    response_model=LoanResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a tool loan"
)
def create_loan(
    loan_data: LoanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Operator", "Coordinator"))
):

    # Bloquea el producto para serializar préstamos simultáneos
    product = db.scalar(
        select(Product)
        .where(Product.id == loan_data.product_id)
        .with_for_update()
    )

    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Product not found"
        )

    if product.status != "active":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product '{product.name}' ({product.internal_code}) is inactive"
        )

    available = available_quantity(db, product)

    if loan_data.quantity > available:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Insufficient available quantity for '{product.name}'. "
                f"Available: {available}, Requested: {loan_data.quantity}"
            )
        )

    # Reutiliza el trabajador con el mismo nombre (sin distinguir mayúsculas)
    worker = db.scalar(
        select(Worker)
        .where(func.lower(Worker.full_name) == loan_data.worker_name.lower())
        .order_by(Worker.id)
        .limit(1)
    )

    if not worker:
        worker = Worker(full_name=loan_data.worker_name)
        db.add(worker)
        db.flush()

    loan = Loan(
        worker_id=worker.id,
        product_id=product.id,
        quantity=loan_data.quantity,
        status="loaned"
    )

    db.add(loan)
    db.commit()
    db.refresh(loan)

    return loan


# ============================================================
# RETURN LOAN
# ============================================================

@router.patch(
    "/loans/{loan_id}/return",
    response_model=LoanResponse,
    summary="Register the return of a loan"
)
def return_loan(
    loan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Operator", "Coordinator"))
):

    loan = db.scalar(
        select(Loan)
        .where(Loan.id == loan_id)
        .with_for_update()
    )

    if not loan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Loan not found"
        )

    if loan.status != "loaned":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Loan is already returned"
        )

    loan.status = "returned"
    loan.return_date = datetime.now(timezone.utc).replace(tzinfo=None)

    db.commit()
    db.refresh(loan)

    return loan
