import unittest
from decimal import Decimal
from datetime import datetime, timedelta
from sqlalchemy import select, delete
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.product import Product, Category, UnitOfMeasure
from app.models.alert import Alert
from app.services.alerts import update_stock_alerts

class TestFunctionalAlerts(unittest.TestCase):
    def setUp(self):
        self.session = SessionLocal()
        
        # Get or create mandatory dependencies
        self.category = self.session.scalar(select(Category).where(Category.name == "Test Category"))
        if not self.category:
            self.category = Category(name="Test Category")
            self.session.add(self.category)
            self.session.commit()

        self.uom = self.session.scalar(select(UnitOfMeasure).where(UnitOfMeasure.name == "Units"))
        if not self.uom:
            self.uom = UnitOfMeasure(name="Units", abbreviation="un")
            self.session.add(self.uom)
            self.session.commit()

    def tearDown(self):
        self.session.close()

    def create_test_product(self, stock=0, minimum=0, status="active", internal_code=None):
        if internal_code is None:
            import uuid
            internal_code = f"TEST_ALERT_{uuid.uuid4().hex[:8]}"
            
        product = Product(
            internal_code=internal_code,
            name="Functional Test Product",
            current_stock=Decimal(stock),
            minimum_stock=Decimal(minimum),
            status=status,
            category_id=self.category.id,
            unit_of_measure_id=self.uom.id
        )
        self.session.add(product)
        self.session.commit()
        return product

    def cleanup_product(self, product_id):
        # Clean up product and its associated alerts
        self.session.execute(delete(Alert).where(Alert.product_id == product_id))
        product = self.session.get(Product, product_id)
        if product:
            self.session.delete(product)
            self.session.commit()

    def test_case_a_stock_above_minimum(self):
        """Caso A: Stock superior al mínimo no debe crear alerta."""
        product = self.create_test_product(stock=100, minimum=10)
        try:
            update_stock_alerts(self.session, product)
            self.session.commit()
            alert = self.session.scalar(select(Alert).where(Alert.product_id == product.id))
            self.assertIsNone(alert, "Should not create alert when stock > minimum")
        finally:
            self.cleanup_product(product.id)

    def test_case_b_stock_equal_minimum(self):
        """Caso B: Stock igual al mínimo debe crear alerta activa."""
        product = self.create_test_product(stock=10, minimum=10)
        try:
            update_stock_alerts(self.session, product)
            self.session.commit()
            alert = self.session.scalar(select(Alert).where(Alert.product_id == product.id))
            self.assertIsNotNone(alert)
            self.assertEqual(alert.status, "active")
        finally:
            self.cleanup_product(product.id)

    def test_case_c_stock_below_minimum(self):
        """Caso C: Stock inferior al mínimo debe crear alerta activa."""
        product = self.create_test_product(stock=5, minimum=10)
        try:
            update_stock_alerts(self.session, product)
            self.session.commit()
            alert = self.session.scalar(select(Alert).where(Alert.product_id == product.id))
            self.assertIsNotNone(alert)
            self.assertEqual(alert.status, "active")
        finally:
            self.cleanup_product(product.id)

    def test_case_d_no_duplicate_alerts(self):
        """Caso D: Si ya existe alerta activa, no crear otra."""
        product = self.create_test_product(stock=5, minimum=10)
        try:
            update_stock_alerts(self.session, product)
            self.session.commit()
            
            # Trigger again
            update_stock_alerts(self.session, product)
            self.session.commit()
            
            alerts = self.session.scalars(select(Alert).where(Alert.product_id == product.id)).all()
            self.assertEqual(len(alerts), 1, "Should not create duplicate alerts")
        finally:
            self.cleanup_product(product.id)

    def test_case_e_consolidate_alerts(self):
        """Caso E: Conservar la más reciente y resolver las demás."""
        product = self.create_test_product(stock=5, minimum=10)
        try:
            # Create two active alerts manually
            # Use explicit dates to ensure deterministic order
            a1 = Alert(
                product_id=product.id, 
                stock_at_alert=Decimal(5), 
                status="active", 
                date_generated=datetime(2020, 1, 1)
            )
            a2 = Alert(
                product_id=product.id, 
                stock_at_alert=Decimal(4), 
                status="active", 
                date_generated=datetime(2021, 1, 1)
            )
            self.session.add_all([a1, a2])
            self.session.commit()
            
            update_stock_alerts(self.session, product)
            self.session.commit()
            
            active_alerts = self.session.scalars(
                select(Alert).where(Alert.product_id == product.id, Alert.status == "active")
            ).all()
            
            self.assertEqual(len(active_alerts), 1, "Should consolidate to exactly one active alert")
            # The most recent (a2) should be the one kept
            self.assertEqual(active_alerts[0].stock_at_alert, Decimal(4))
        finally:
            self.cleanup_product(product.id)

    def test_case_f_recovery_resolves_alerts(self):
        """Caso F: Recuperación del stock resuelve alertas."""
        product = self.create_test_product(stock=5, minimum=10)
        try:
            update_stock_alerts(self.session, product)
            self.session.commit()
            
            # Recover stock
            product.current_stock = Decimal(15)
            update_stock_alerts(self.session, product)
            self.session.commit()
            
            active_alerts = self.session.scalars(
                select(Alert).where(Alert.product_id == product.id, Alert.status == "active")
            ).all()
            self.assertEqual(len(active_alerts), 0, "Alerts should be resolved when stock > minimum")
        finally:
            self.cleanup_product(product.id)

    def test_case_g_inactive_product(self):
        """Caso G: Producto inactivo resuelve alertas."""
        product = self.create_test_product(stock=5, minimum=10)
        try:
            update_stock_alerts(self.session, product)
            self.session.commit()
            
            product.status = "inactive"
            update_stock_alerts(self.session, product)
            self.session.commit()
            
            active_alerts = self.session.scalars(
                select(Alert).where(Alert.product_id == product.id, Alert.status == "active")
            ).all()
            self.assertEqual(len(active_alerts), 0, "Alerts should be resolved when product is inactive")
        finally:
            self.cleanup_product(product.id)

    def test_case_h_transactional_behavior(self):
        """Caso H: Comprobar que el servicio no hace commit y el rollback funciona."""
        product = self.create_test_product(stock=5, minimum=10)
        try:
            # Call service without commit
            update_stock_alerts(self.session, product)
            
            # Ensure changes are sent to the DB (but not committed)
            self.session.flush()
            
            # Verify it is in the current transaction
            alert = self.session.scalar(select(Alert).where(Alert.product_id == product.id))
            self.assertIsNotNone(alert, "Alert should be present in session before commit")
            
            # Rollback
            self.session.rollback()
            
            # Verify it is NOT in the DB
            alert_after = self.session.scalar(select(Alert).where(Alert.product_id == product.id))
            self.assertIsNone(alert_after, "Alert should be gone after rollback")
        finally:
            # IMPORTANT: Since we did a rollback, the product created in create_test_product 
            # might still exist if create_test_product did its own commit (which it does).
            # We must ensure we clean up the product.
            self.cleanup_product(product.id)


if __name__ == "__main__":
    unittest.main()
