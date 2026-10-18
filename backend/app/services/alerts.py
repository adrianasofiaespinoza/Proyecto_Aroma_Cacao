from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.product import Product
from app.models.alert import Alert

def update_stock_alerts(db: Session, product: Product):
    """
    Centralized logic to manage stock alerts.
    - Creates or maintains exactly one 'active' alert if stock <= minimum_stock.
    - Resolves all 'active' alerts if stock > minimum_stock or product is inactive.
    - Consolidates existing duplicate active alerts by keeping only one.
    """
    # 1. Handle inactive products: Resolve all active alerts
    if product.status != "active":
        active_alerts = db.scalars(
            select(Alert).where(
                Alert.product_id == product.id,
                Alert.status == "active"
            )
        ).all()
        for alert in active_alerts:
            alert.status = "resolved"
        return

    # 2. Stock is at or below minimum: Ensure exactly one active alert exists
    if product.current_stock <= product.minimum_stock:
        active_alerts = db.scalars(
            select(Alert).where(
                Alert.product_id == product.id,
                Alert.status == "active"
            ).order_by(Alert.date_generated.desc())
        ).all()

        if not active_alerts:
            new_alert = Alert(
                product_id=product.id,
                stock_at_alert=product.current_stock,
                status="active",
            )
            db.add(new_alert)
        elif len(active_alerts) > 1:
            # Keep only the most recent active alert, resolve others
            for alert in active_alerts[1:]:
                alert.status = "resolved"
    
    # 3. Stock recovered: Resolve all active alerts
    else:
        active_alerts = db.scalars(
            select(Alert).where(
                Alert.product_id == product.id,
                Alert.status == "active"
            )
        ).all()
        for alert in active_alerts:
            alert.status = "resolved"
