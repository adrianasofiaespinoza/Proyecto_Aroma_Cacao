"""
Validaciones de esquemas de productos y movimientos.

No requieren PostgreSQL: comprueban que los datos fuera de los
límites de las columnas se rechacen con 422 antes de llegar a la BD.
"""

from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.schemas.movement import MovementCreate
from app.schemas.product import ProductCreate, ProductUpdate


BASE_PRODUCT = {
    "internal_code": "REP-001",
    "name": "Rodamiento 6205",
    "category_id": 1,
    "unit_of_measure_id": 1,
}


def test_product_valid_and_trimmed():
    product = ProductCreate(**{**BASE_PRODUCT, "name": "  Rodamiento  "})
    assert product.name == "Rodamiento"
    assert product.current_stock == Decimal("0")


@pytest.mark.parametrize(
    "field, value",
    [
        ("internal_code", "X" * 31),
        ("internal_code", "   "),
        ("name", ""),
        ("name", "N" * 101),
        ("brand", "B" * 51),
        ("physical_location", "L" * 101),
        ("current_stock", "100000000"),
        ("minimum_stock", "-1"),
        ("maximum_stock", "1.005"),
    ],
)
def test_product_create_rejects_out_of_range(field, value):
    with pytest.raises(ValidationError):
        ProductCreate(**{**BASE_PRODUCT, field: value})


def test_product_update_has_no_current_stock():
    update = ProductUpdate(
        **BASE_PRODUCT,
        minimum_stock="2",
        current_stock="999",
    )
    assert not hasattr(update, "current_stock")


def movement(**overrides):
    data = {
        "type": "ENTRY",
        "details": [{"product_id": 1, "quantity": "1"}],
    }
    data.update(overrides)
    return data


def test_movement_valid():
    created = MovementCreate(**movement(reason="Reposición"))
    assert created.details[0].quantity == Decimal("1")


@pytest.mark.parametrize(
    "overrides",
    [
        {"type": "LOAN"},
        {"details": []},
        {"reason": "x" * 151},
        {"work_order_number": "W" * 31},
        {"details": [{"product_id": 1, "quantity": "-1"}]},
        {"details": [{"product_id": 1, "quantity": "99999999999"}]},
        {"details": [{"product_id": 1, "quantity": "1.005"}]},
    ],
)
def test_movement_rejects_invalid(overrides):
    with pytest.raises(ValidationError):
        MovementCreate(**movement(**overrides))
