from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.product import Product


def _active_alerts(db: Session, product: Product) -> list[Alert]:
    return list(
        db.scalars(
            select(Alert).where(Alert.product_id == product.id, Alert.status == "active")
        ).all()
    )


def update_stock_alerts(db: Session, product: Product):
    """
    Centralized logic to manage stock alerts.
    - Creates or maintains exactly one 'active' alert if stock <= minimum_stock.
    - Resolves all 'active' alerts if stock > minimum_stock or product is inactive.

    The unique index uq_alert_active_product (migration 0007) guarantees at most one
    active alert per product. If another transaction creates it at the same time, the
    insert fails inside a savepoint and the existing alert is kept.
    """
    needs_alert = product.status == "active" and product.current_stock <= product.minimum_stock
    active_alerts = _active_alerts(db, product)

    if not needs_alert:
        for alert in active_alerts:
            alert.status = "resolved"
        return

    if active_alerts:
        return

    savepoint = db.begin_nested()
    try:
        db.add(
            Alert(
                product_id=product.id,
                stock_at_alert=product.current_stock,
                status="active",
            )
        )
        savepoint.commit()
    except IntegrityError:
        # Otra transacción ya creó la alerta activa de este producto
        savepoint.rollback()
