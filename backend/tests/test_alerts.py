import unittest
from decimal import Decimal
from datetime import datetime
from sqlalchemy import create_engine, event, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.product import Product, Category, UnitOfMeasure
from app.models.alert import Alert
from app.services.alerts import update_stock_alerts

class TestStockAlerts(unittest.TestCase):
    def setUp(self):
        # Use an in-memory SQLite database for isolated testing
        self.engine = create_engine("sqlite:///:memory:")

        # Receta de SQLAlchemy para que pysqlite respete los SAVEPOINT (el servicio
        # crea la alerta dentro de uno); en PostgreSQL no hace falta.
        @event.listens_for(self.engine, "connect")
        def _no_pysqlite_begin(dbapi_connection, connection_record):
            dbapi_connection.isolation_level = None

        @event.listens_for(self.engine, "begin")
        def _explicit_begin(conn):
            conn.exec_driver_sql("BEGIN")
        
           
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

    def test_database_rejects_second_active_alert(self):
        """Caso E: el índice único (migración 0007) impide dos alertas activas del mismo producto."""
        product = self.create_product(stock=5, minimum=10)
        update_stock_alerts(self.session, product)
        self.session.commit()

        self.session.add(Alert(product_id=product.id, stock_at_alert=Decimal(4), status="active"))
        with self.assertRaises(IntegrityError):
            self.session.commit()
        self.session.rollback()

        # Las resueltas no cuentan: puede haber muchas
        self.session.add_all([
            Alert(product_id=product.id, stock_at_alert=Decimal(1), status="resolved"),
            Alert(product_id=product.id, stock_at_alert=Decimal(2), status="resolved"),
        ])
        self.session.commit()

    def test_existing_active_alert_is_kept(self):
        """Caso F: si ya hay una alerta activa, no se crea otra ni falla."""
        product = self.create_product(stock=5, minimum=10)
        update_stock_alerts(self.session, product)
        self.session.commit()
        product.current_stock = Decimal(3)
        update_stock_alerts(self.session, product)
        self.session.commit()

        active_alerts = self.session.scalars(
            select(Alert).where(Alert.product_id == product.id, Alert.status == "active")
        ).all()
        self.assertEqual(len(active_alerts), 1)

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
