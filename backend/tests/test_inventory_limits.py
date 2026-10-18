import unittest
from decimal import Decimal
from unittest.mock import MagicMock, patch
from sqlalchemy import select, delete
from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.product import Product, Category, UnitOfMeasure
from app.models.movement import Movement, MovementDetail
from app.models.user import User
from app.routers.movements import authorize_movement
from fastapi import HTTPException

class TestInventoryLimits(unittest.TestCase):
    def setUp(self):
        self.session = SessionLocal()
        
        # Ensure mandatory dependencies exist
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

        # Setup a valid Coordinator user for authorization tests
        self.coordinator = self.session.scalar(select(User).where(User.role == "Coordinator"))
        if not self.coordinator:
            self.coordinator = User(
                username="test_coordinator",
                full_name="Test Coordinator",
                email="coordinator@test.com",
                role="Coordinator"
            )
            self.session.add(self.coordinator)
            self.session.commit()

    def tearDown(self):
        self.session.close()

    def create_test_product(self, stock=10, minimum=5):
        import uuid
        product = Product(
            internal_code=f"LIMIT_{uuid.uuid4().hex[:8]}",
            name="Limit Test Product",
            current_stock=Decimal(stock),
            minimum_stock=Decimal(minimum),
            status="active",
            category_id=self.category.id,
            unit_of_measure_id=self.uom.id
        )
        self.session.add(product)
        self.session.commit()
        return product

    def cleanup_test_data(self, product_id, movement_id=None):
        """Ensures all related records are cleaned up, even after failures."""
        try:
            if movement_id:
                self.session.execute(delete(MovementDetail).where(MovementDetail.movement_id == movement_id))
                self.session.execute(delete(Movement).where(Movement.id == movement_id))
            
            self.session.execute(delete(MovementDetail).where(MovementDetail.product_id == product_id))
            product = self.session.get(Product, product_id)
            if product:
                self.session.delete(product)
            self.session.commit()
        except Exception:
            self.session.rollback()

    def test_adjustment_negative_rejected(self):
        """
        Verify that a negative adjustment is rejected by the router's validation logic.
        Uses a mock for the 'details' attribute of the Movement object to bypass 
        DB constraints and test the router's branch.
        """
        product = self.create_test_product(stock=10)
        initial_stock = product.current_stock
        
        # Create a real movement record
        movement = Movement(
            type="ADJUSTMENT",
            requesting_user_id=self.coordinator.id,
            status="pending",
            reason="Test negative adjustment"
        )
        self.session.add(movement)
        self.session.flush()
        
        # Create a mock detail
        mock_detail = MagicMock()
        mock_detail.product_id = product.id
        mock_detail.quantity = Decimal("-10")
        
        # Use patch to mock the 'details' property of the Movement instance
        # This avoids SQLAlchemy's internal validation of the collection
        with patch.object(movement, 'details', [mock_detail]):
            with self.assertRaises(HTTPException) as cm:
                authorize_movement(movement.id, self.session, self.coordinator)
            
            self.assertEqual(cm.exception.status_code, 400)
            self.assertIn("cannot be negative", cm.exception.detail)
        
        # Verify stock remains unchanged
        self.session.refresh(product)
        self.assertEqual(product.current_stock, initial_stock)
        
        self.cleanup_test_data(product.id, movement.id)

    def test_adjustment_valid(self):
        """Verify that a valid ADJUSTMENT updates stock correctly."""
        product = self.create_test_product(stock=10)
        movement = Movement(
            type="ADJUSTMENT",
            requesting_user_id=self.coordinator.id,
            status="pending",
            reason="Test valid adjustment"
        )
        self.session.add(movement)
        self.session.flush()
        
        detail = MovementDetail(
            movement_id=movement.id,
            product_id=product.id,
            quantity=Decimal("25"),
        )
        self.session.add(detail)
        self.session.commit()

        authorize_movement(movement.id, self.session, self.coordinator)
        
        self.session.refresh(product)
        self.assertEqual(product.current_stock, Decimal("25"))
        self.cleanup_test_data(product.id, movement.id)

    def test_entry_valid(self):
        """Verify that ENTRY increases stock."""
        product = self.create_test_product(stock=10)
        movement = Movement(
            type="ENTRY",
            requesting_user_id=self.coordinator.id,
            status="pending",
            reason="Test entry"
        )
        self.session.add(movement)
        self.session.flush()
        
        detail = MovementDetail(
            movement_id=movement.id,
            product_id=product.id,
            quantity=Decimal("5"),
        )
        self.session.add(detail)
        self.session.commit()

        authorize_movement(movement.id, self.session, self.coordinator)
        
        self.session.refresh(product)
        self.assertEqual(product.current_stock, Decimal("15"))
        self.cleanup_test_data(product.id, movement.id)

    def test_exit_valid(self):
        """Verify that EXIT decreases stock."""
        product = self.create_test_product(stock=10)
        movement = Movement(
            type="EXIT",
            requesting_user_id=self.coordinator.id,
            status="pending",
            reason="Test exit"
        )
        self.session.add(movement)
        self.session.flush()
        
        detail = MovementDetail(
            movement_id=movement.id,
            product_id=product.id,
            quantity=Decimal("3"),
        )
        self.session.add(detail)
        self.session.commit()

        authorize_movement(movement.id, self.session, self.coordinator)
        
        self.session.refresh(product)
        self.assertEqual(product.current_stock, Decimal("7"))
        self.cleanup_test_data(product.id, movement.id)

if __name__ == "__main__":
    unittest.main()
