"""
Lotes y vencimientos sobre PostgreSQL local.

Usa los fixtures de conftest.py (transacción revertida); no se ejecuta en CI.
"""

import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models.lot import Lot
from app.models.product import Category, Product, UnitOfMeasure


@pytest.fixture
def lot_product(session):
    item = Product(
        internal_code=f"LOTE-{uuid.uuid4().hex[:8]}",
        name="Grasa con lote",
        current_stock=Decimal("0"),
        minimum_stock=Decimal("0"),
        status="active",
        requires_lot=True,
        category_id=session.scalar(select(Category.id)),
        unit_of_measure_id=session.scalar(select(UnitOfMeasure.id)),
    )
    session.add(item)
    session.commit()
    return item


def new_lot(client, product, number=None, expiration=None):
    return client.post(f"/products/{product.id}/lots", json={
        "lot_number": number or uuid.uuid4().hex[:8],
        "expiration_date": expiration.isoformat() if expiration else None,
    })


def authorize(client, product, type_, quantity, lot_id=None):
    created = client.post("/movements", json={
        "type": type_,
        "reason": "Prueba de lotes",
        "details": [{"product_id": product.id, "quantity": str(quantity), "lot_id": lot_id}],
    })
    assert created.status_code == 201, created.text
    return client.patch(f"/movements/{created.json()['id']}/authorize")


def state(session, product, lot_id):
    session.expire_all()
    return session.get(Product, product.id).current_stock, session.get(Lot, lot_id).remaining_quantity


def lots_total(session, product):
    return sum(session.scalars(select(Lot.remaining_quantity).where(Lot.product_id == product.id)))


def test_create_lot_starts_empty_with_permissions(client, lot_product, product):
    client.act_as("Operator")
    created = new_lot(client, lot_product, "L-001", date.today() + timedelta(days=90))
    assert created.status_code == 201
    assert Decimal(created.json()["remaining_quantity"]) == 0

    assert new_lot(client, lot_product, "L-001").status_code == 409
    assert new_lot(client, lot_product, "L-002", date.today() - timedelta(days=1)).status_code == 400
    assert new_lot(client, product, "L-003").status_code == 400
    assert client.post("/products/999999999/lots", json={"lot_number": "X"}).status_code == 404
    assert client.post(f"/products/{lot_product.id}/lots", json={"lot_number": " "}).status_code == 422

    assert client.put(f"/lots/{created.json()['id']}", json={"lot_number": "X"}).status_code == 403
    client.act_as("Read-only")
    assert new_lot(client, lot_product).status_code == 403
    assert client.get("/lots").status_code == 200


def test_update_lot_cannot_change_quantity(client, session, lot_product):
    lot_id = new_lot(client, lot_product, "L-A").json()["id"]
    other = new_lot(client, lot_product, "L-B").json()["id"]
    authorize(client, lot_product, "ENTRY", 5, lot_id)

    updated = client.put(f"/lots/{lot_id}", json={
        "lot_number": "L-A2", "expiration_date": "2030-01-31", "remaining_quantity": "999",
    })
    assert updated.status_code == 200
    assert updated.json()["lot_number"] == "L-A2"
    assert Decimal(updated.json()["remaining_quantity"]) == 5

    assert client.put(f"/lots/{other}", json={"lot_number": "L-A2"}).status_code == 409
    assert client.put("/lots/999999999", json={"lot_number": "Z"}).status_code == 404


def test_lot_required_and_rejected_when_not_tracked(client, session, lot_product, product):
    lot_id = new_lot(client, lot_product).json()["id"]

    for prod, lot in ((lot_product, None), (product, lot_id)):
        response = client.post("/movements", json={
            "type": "ENTRY",
            "details": [{"product_id": prod.id, "quantity": "1", "lot_id": lot}],
        })
        assert response.status_code == 400


def test_lot_of_another_product_rejected(client, session, lot_product):
    other = Product(
        internal_code=f"LOTE-{uuid.uuid4().hex[:8]}", name="Otro", current_stock=0, minimum_stock=0,
        status="active", requires_lot=True,
        category_id=lot_product.category_id, unit_of_measure_id=lot_product.unit_of_measure_id,
    )
    session.add(other)
    session.commit()
    lot_id = new_lot(client, other).json()["id"]

    response = client.post("/movements", json={
        "type": "ENTRY",
        "details": [{"product_id": lot_product.id, "quantity": "1", "lot_id": lot_id}],
    })
    assert response.status_code == 400


def test_entry_exit_and_adjustment_keep_lots_and_stock_in_sync(client, session, lot_product):
    a = new_lot(client, lot_product).json()["id"]
    b = new_lot(client, lot_product).json()["id"]

    assert authorize(client, lot_product, "ENTRY", 10, a).status_code == 200
    assert authorize(client, lot_product, "ENTRY", 4, b).status_code == 200
    assert state(session, lot_product, a) == (Decimal("14"), Decimal("10"))

    assert authorize(client, lot_product, "EXIT", 3, a).status_code == 200
    assert state(session, lot_product, a) == (Decimal("11"), Decimal("7"))

    # Stock total suficiente, pero no en este lote
    blocked = authorize(client, lot_product, "EXIT", 5, b)
    assert blocked.status_code == 400 and "lot" in blocked.json()["detail"]
    assert state(session, lot_product, b) == (Decimal("11"), Decimal("4"))

    # Conteo de un lote: el stock cambia solo en la diferencia
    assert authorize(client, lot_product, "ADJUSTMENT", 2, b).status_code == 200
    assert state(session, lot_product, b) == (Decimal("9"), Decimal("2"))
    assert authorize(client, lot_product, "ADJUSTMENT", 9, b).status_code == 200
    assert state(session, lot_product, b) == (Decimal("16"), Decimal("9"))

    assert lots_total(session, lot_product) == session.get(Product, lot_product.id).current_stock


def test_expired_lot_blocks_exit_and_entry_but_allows_adjustment(client, session, lot_product):
    lot_id = new_lot(client, lot_product).json()["id"]
    authorize(client, lot_product, "ENTRY", 5, lot_id)

    # Solicitud creada cuando el lote aún era válido
    pending = client.post("/movements", json={
        "type": "EXIT",
        "reason": "Antes de vencer",
        "details": [{"product_id": lot_product.id, "quantity": "1", "lot_id": lot_id}],
    }).json()["id"]

    # Vence hoy: todavía es válido
    client.put(f"/lots/{lot_id}", json={"lot_number": "V-1", "expiration_date": date.today().isoformat()})
    assert authorize(client, lot_product, "EXIT", 1, lot_id).status_code == 200

    client.put(f"/lots/{lot_id}", json={
        "lot_number": "V-1", "expiration_date": (date.today() - timedelta(days=1)).isoformat(),
    })

    for type_ in ("EXIT", "ENTRY"):
        response = client.post("/movements", json={
            "type": type_,
            "reason": "Después de vencer",
            "details": [{"product_id": lot_product.id, "quantity": "1", "lot_id": lot_id}],
        })
        assert response.status_code == 400 and "expired" in response.json()["detail"]

    # La solicitud pendiente tampoco se puede autorizar
    assert client.patch(f"/movements/{pending}/authorize").status_code == 400

    # Retirarlo con un ajuste a 0
    assert authorize(client, lot_product, "ADJUSTMENT", 0, lot_id).status_code == 200
    assert state(session, lot_product, lot_id) == (Decimal("0"), Decimal("0"))


def test_expiring_filter(client, lot_product):
    soon = new_lot(client, lot_product, "PRONTO", date.today() + timedelta(days=30)).json()["id"]
    far = new_lot(client, lot_product, "LEJOS", date.today() + timedelta(days=31)).json()["id"]
    empty = new_lot(client, lot_product, "VACIO", date.today() + timedelta(days=1)).json()["id"]
    never = new_lot(client, lot_product, "SIN-FECHA").json()["id"]
    for lot_id in (soon, far, never):
        authorize(client, lot_product, "ENTRY", 1, lot_id)

    found = [x["id"] for x in client.get("/lots", params={"expiring_within_days": 30}).json()]
    assert soon in found
    assert far not in found and empty not in found and never not in found

    every = [x["id"] for x in client.get("/lots").json()]
    assert {soon, far, empty, never} <= set(every)
    assert client.get("/lots", params={"expiring_within_days": -1}).status_code == 422


def base_product(product, **overrides):
    data = {
        "internal_code": product.internal_code,
        "name": product.name,
        "minimum_stock": "0",
        "category_id": product.category_id,
        "unit_of_measure_id": product.unit_of_measure_id,
    }
    data.update(overrides)
    return data


def test_requires_lot_only_changes_with_zero_stock(client, session, lot_product, product):
    # product tiene stock 10
    assert client.put(f"/products/{product.id}", json=base_product(product, requires_lot=True)).status_code == 400
    # None/ausente no cambia nada
    assert client.put(f"/products/{product.id}", json=base_product(product)).json()["requires_lot"] is False

    # lot_product está en 0
    changed = client.put(f"/products/{lot_product.id}", json=base_product(lot_product, requires_lot=False))
    assert changed.status_code == 200 and changed.json()["requires_lot"] is False


def test_create_product_with_lots_must_start_empty(client, product):
    base = {
        "internal_code": f"N-{uuid.uuid4().hex[:8]}",
        "name": "Nuevo",
        "category_id": product.category_id,
        "unit_of_measure_id": product.unit_of_measure_id,
        "requires_lot": True,
    }
    assert client.post("/products", json={**base, "current_stock": "1"}).status_code == 400
    created = client.post("/products", json=base)
    assert created.status_code == 201 and created.json()["requires_lot"] is True


def test_lot_tracked_product_cannot_be_loaned(client, lot_product):
    lot_id = new_lot(client, lot_product).json()["id"]
    authorize(client, lot_product, "ENTRY", 5, lot_id)

    response = client.post("/loans", json={
        "product_id": lot_product.id, "quantity": "1", "worker_name": "Prueba",
    })
    assert response.status_code == 400 and "lots" in response.json()["detail"]
