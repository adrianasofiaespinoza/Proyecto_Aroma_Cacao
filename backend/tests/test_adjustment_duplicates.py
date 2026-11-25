"""AC-53: un conteo por producto y lote, con transacciones revertidas."""

from decimal import Decimal

import pytest
from sqlalchemy import func, select

from app.models.alert import Alert
from app.models.lot import Lot
from app.models.movement import Movement, MovementDetail
from app.models.product import Product


@pytest.fixture
def lots(session, product):
    product.requires_lot = True
    items = [
        Lot(product_id=product.id, lot_number="AC53-A", remaining_quantity=Decimal("4")),
        Lot(product_id=product.id, lot_number="AC53-B", remaining_quantity=Decimal("6")),
    ]
    session.add_all(items)
    session.commit()
    return items


def detail(product, quantity, lot=None):
    return {"product_id": product.id, "quantity": str(quantity), "lot_id": lot.id if lot else None}


def record_counts(session):
    return tuple(session.scalar(select(func.count()).select_from(model))
                 for model in (Movement, MovementDetail, Alert))


@pytest.mark.parametrize("role", ["Coordinator", "Operator"])
@pytest.mark.parametrize("tracked", [False, True])
def test_duplicate_adjustment_rejected_without_changes(client, session, product, request, role, tracked):
    lot = request.getfixturevalue("lots")[0] if tracked else None
    client.act_as(role)
    before = record_counts(session)
    response = client.post("/movements", json={
        "type": "ADJUSTMENT", "reason": "Conteo duplicado",
        "details": [detail(product, 0, lot), detail(product, 7, lot)],
    })

    assert response.status_code == 400, response.text
    assert "Duplicate product and lot" in response.json()["detail"]
    assert record_counts(session) == before
    session.expire_all()
    assert session.get(Product, product.id).current_stock == Decimal("10")
    if lot:
        assert session.get(Lot, lot.id).remaining_quantity == Decimal("4")


def test_adjustment_accepts_same_product_in_different_lots(client, session, product, lots):
    response = client.post("/movements", json={
        "type": "ADJUSTMENT", "reason": "Conteo por lote",
        "details": [detail(product, 3, lots[0]), detail(product, 2, lots[1])],
    })
    assert response.status_code == 201, response.text
    assert client.patch(f"/movements/{response.json()['id']}/authorize").status_code == 200
    session.expire_all()
    assert session.get(Product, product.id).current_stock == Decimal("5")
    assert [session.get(Lot, lot.id).remaining_quantity for lot in lots] == [Decimal("3"), Decimal("2")]


def test_adjustment_accepts_different_products_without_lots(client, session, product):
    other = Product(
        internal_code=f"{product.internal_code}-B", name="Otro producto", current_stock=Decimal("9"),
        minimum_stock=0, status="active", category_id=product.category_id,
        unit_of_measure_id=product.unit_of_measure_id,
    )
    session.add(other)
    session.commit()
    response = client.post("/movements", json={
        "type": "ADJUSTMENT", "reason": "Conteo de dos productos",
        "details": [detail(product, 3), detail(other, 5)],
    })
    assert response.status_code == 201, response.text
    assert client.patch(f"/movements/{response.json()['id']}/authorize").status_code == 200
    session.expire_all()
    assert session.get(Product, product.id).current_stock == Decimal("3")
    assert session.get(Product, other.id).current_stock == Decimal("5")


@pytest.mark.parametrize("type_, expected", [("ENTRY", "12"), ("EXIT", "8")])
@pytest.mark.parametrize("tracked", [False, True])
def test_entry_and_exit_still_accept_repeated_details(client, session, product, request, type_, expected, tracked):
    lot = request.getfixturevalue("lots")[0] if tracked else None
    response = client.post("/movements", json={
        "type": type_, "reason": "Dos lineas validas",
        "details": [detail(product, 1, lot), detail(product, 1, lot)],
    })
    assert response.status_code == 201, response.text
    assert client.patch(f"/movements/{response.json()['id']}/authorize").status_code == 200
    session.expire_all()
    assert session.get(Product, product.id).current_stock == Decimal(expected)
    if lot:
        assert session.get(Lot, lot.id).remaining_quantity == Decimal("6" if type_ == "ENTRY" else "2")


def test_read_only_cannot_create_even_a_duplicated_adjustment(client, session, product):
    client.act_as("Read-only")
    before = record_counts(session)
    response = client.post("/movements", json={
        "type": "ADJUSTMENT", "reason": "Sin permiso",
        "details": [detail(product, 2), detail(product, 3)],
    })
    assert response.status_code == 403
    assert record_counts(session) == before
