from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.loan import Loan
from app.models.product import Product


def loaned_quantity(db: Session, product_id: int) -> Decimal:
    """Cantidad actualmente prestada (préstamos en estado loaned)."""

    return db.scalar(
        select(func.coalesce(func.sum(Loan.quantity), 0)).where(
            Loan.product_id == product_id,
            Loan.status == "loaned"
        )
    )


def available_quantity(db: Session, product: Product) -> Decimal:
    """Disponible = stock registrado - herramientas prestadas."""

    return product.current_stock - loaned_quantity(db, product.id)
