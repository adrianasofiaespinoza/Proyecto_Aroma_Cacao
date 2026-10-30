import unittest
from decimal import Decimal
from datetime import datetime
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.product import Product, Category, UnitOfMeasure
from app.models.alert import Alert
from app.services.alerts import update_stock_alerts

class TestStockAlerts(unittest.TestCase):
    def setUp(self):
        # Use an in-memory SQLite database for isolated testing
        self.engine = create_engine("sqlite:///:memory:")
        
           
        Base.metadata.create_all(self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.session = self.Session()

        # Create mandatory dependencies for Product
        self.category = Category(name="Test Category")
        self.uom = UnitOfMeasure(name="Units", abbreviation="un")
        self.session.add_all([self.category, self.uom])
        self.session.commit()

    def tearDown(self):
        self.session.close()
        Base.metadata.drop_all(self.engine)

    def create_product(self, stock=0, minimum=0, status="active"):
        product = Product(
            internal_code="TEST001",
            name="Test Product",
            current_stock=Decimal(stock),
            minimum_stock=Decimal(minimum),
            status=status,
            category_id=self.category.id,
            unit_of_measure_id=self.uom.id
        )
        self.session.add(product)
        self.session.commit()
        return product

    def test_stock_above_minimum_no_alert(self):
        """Caso A: Stock superior al mínimo no debe crear alerta."""
        product = self.create_product(stock=20, minimum=10)
        update_stock_alerts(self.session, product)
        self.session.commit()

        alert = self.session.scalar(select(Alert).where(Alert.product_id == product.id))
        self.assertIsNone(alert, "No should be an alert when stock > minimum")

    def test_stock_equal_minimum_creates_alert(self):
        """Caso B: Stock igual al mínimo debe crear alerta activa."""
        product = self.create_product(stock=10, minimum=10)
        update_stock_alerts(self.session, product)
        self.session.commit()

        alert = self.session.scalar(select(Alert).where(Alert.product_id == product.id))
        self.assertIsNotNone(alert)
        self.assertEqual(alert.status, "active")

    def test_stock_below_minimum_creates_alert(self):
        """Caso C: Stock inferior al mínimo debe crear alerta activa."""
        product = self.create_product(stock=5, minimum=10)
        update_stock_alerts(self.session, product)
        self.session.commit()

        alert = self.session.scalar(select(Alert).where(Alert.product_id == product.id))
        self.assertIsNotNone(alert)
        self.assertEqual(alert.status, "active")

    def test_existing_alert_no_duplicate(self):
        """Caso D: Si ya existe alerta activa, no crear otra."""
        product = self.create_product(stock=5, minimum=10)
        update_stock_alerts(self.session, product)
        self.session.commit()

        # Try to trigger alert again
        update_stock_alerts(self.session, product)
        self.session.commit()

        alerts = self.session.scalars(select(Alert).where(Alert.product_id == product.id)).all()
        self.assertEqual(len(alerts), 1, "Should not create duplicate alerts")

    def test_duplicate_consolidation(self):
        """Caso E: Conservar la más reciente y resolver el resto."""
        product = self.create_product(stock=5, minimum=10)
        
        # Manually create duplicate active alerts with different dates
        a1 = Alert(
            product_id=product.id, 
            stock_at_alert=Decimal(5), 
            status="active", 
            date_generated=datetime(2026, 1, 1)
        )
        a2 = Alert(
            product_id=product.id, 
            stock_at_alert=Decimal(4), 
            status="active", 
            date_generated=datetime(2026, 1, 2)
        )
        self.session.add_all([a1, a2])
        self.session.commit()

        update_stock_alerts(self.session, product)
        self.session.commit()

        active_alerts = self.session.scalars(
            select(Alert).where(Alert.product_id == product.id, Alert.status == "active")
        ).all()
        
        self.assertEqual(len(active_alerts), 1, "Should consolidate to exactly one active alert")
        # Verify that the most recent one was kept (a2)
        self.assertEqual(active_alerts[0].stock_at_alert, Decimal(4))

    def test_stock_recovery_resolves_alert(self):
        """Caso F: Recuperación del stock resuelve alertas."""
        product = self.create_product(stock=5, minimum=10)
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

    def test_inactive_product_resolves_alerts(self):
        """Caso G: Producto inactivo resuelve alertas."""
        product = self.create_product(stock=5, minimum=10)
        update_stock_alerts(self.session, product)
        self.session.commit()

        # Deactivate product
        product.status = "inactive"
        update_stock_alerts(self.session, product)
        self.session.commit()

        active_alerts = self.session.scalars(
            select(Alert).where(Alert.product_id == product.id, Alert.status == "active")
        ).all()
        self.assertEqual(len(active_alerts), 0, "Alerts should be resolved when product is inactive")

    def test_transactional_behavior(self):
        """Caso H: El servicio no hace commit por sí mismo."""
        product = self.create_product(stock=5, minimum=10)
        
        # Call service without committing
        update_stock_alerts(self.session, product)
        
        # Check that alert is in session
        alert = self.session.scalar(select(Alert).where(Alert.product_id == product.id))
        self.assertIsNotNone(alert, "Alert should be in the session")
        
        # Rollback changes
        self.session.rollback()
        
        alert_after_rollback = self.session.scalar(select(Alert).where(Alert.product_id == product.id))
        self.assertIsNone(alert_after_rollback, "Alert should be gone after rollback")

if __name__ == "__main__":
    unittest.main()
