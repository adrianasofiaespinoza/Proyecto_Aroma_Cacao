"""
Flujo de movimientos de punta a punta sobre PostgreSQL local.

Cada prueba se ejecuta dentro de una transacción externa que se revierte
al final, por lo que no deja datos en aroma_inventory. Requiere la base
de datos local (igual que test_inventory_limits.py); no se ejecuta en CI.
"""

import uuid
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import engine, get_db
from app.main import app
from app.models.alert import Alert
from app.models.product import Category, Product, UnitOfMeasure
from app.models.user import User
from app.security.auth import get_current_user


@pytest.fixture
def session():
    connection = engine.connect()
    transaction = connection.begin()
    db = Session(bind=connection, join_transaction_mode="create_savepoint")
    try:
        yield db
    finally:
        db.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def users(session):
    created = {}
    for role in ("Coordinator", "Operator", "Read-only"):
        suffix = uuid.uuid4().hex[:8]
        user = User(
            username=f"flow_{suffix}",
            full_name=f"Test {role}",
            email=f"flow_{suffix}@test.local",
            role=role,
        )
        session.add(user)
        created[role] = user
    session.flush()
    return created


@pytest.fixture
def client(session, users):
    acting = {"user": users["Coordinator"]}

    def override_db():
        # Igual que get_db: revierte ante cualquier excepción
        try:
            yield session
        except Exception:
            session.rollback()
            raise

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[get_current_user] = lambda: acting["user"]

    test_client = TestClient(app)
    test_client.act_as = lambda role: acting.update(user=users[role])
    yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def product(session):
    item = Product(
        internal_code=f"FLOW-{uuid.uuid4().hex[:8]}",
        name="Producto de flujo",
        current_stock=Decimal("10"),
        minimum_stock=Decimal("3"),
        status="active",
        category_id=session.scalar(select(Category.id)),
        unit_of_measure_id=session.scalar(select(UnitOfMeasure.id)),
    )
    session.add(item)
    session.flush()
    return item


def request_movement(client, product, type_, quantity, reason="Prueba"):
    return client.post("/movements", json={
        "type": type_,
        "reason": reason,
        "details": [{"product_id": product.id, "quantity": str(quantity)}],
    })


def stock_of(session, product):
    session.expire_all()
    return session.get(Product, product.id).current_stock


def test_operator_request_stays_pending(client, session, product):
    client.act_as("Operator")
    response = request_movement(client, product, "ENTRY", 5)

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert body["requesting_user_name"] == "Test Operator"
    assert stock_of(session, product) == Decimal("10")


def test_operator_cannot_authorize_or_reject(client, product):
    client.act_as("Operator")
    movement_id = request_movement(client, product, "ENTRY", 5).json()["id"]

    assert client.patch(f"/movements/{movement_id}/authorize").status_code == 403
    assert client.patch(f"/movements/{movement_id}/reject").status_code == 403


def test_read_only_is_strictly_read_only(client, product):
    client.act_as("Read-only")

    assert request_movement(client, product, "ENTRY", 1).status_code == 403
    assert client.patch("/movements/1/authorize").status_code == 403
    assert client.patch("/movements/1/reject").status_code == 403
    assert client.post("/products", json={}).status_code in (403, 422)
    assert client.delete(f"/products/{product.id}").status_code == 403
    assert client.get("/movements").status_code == 200
    assert client.get("/products").status_code == 200


def test_coordinator_authorizes_own_entry(client, session, product):
    movement_id = request_movement(client, product, "ENTRY", 5).json()["id"]
    response = client.patch(f"/movements/{movement_id}/authorize")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "authorized"
    assert body["authorizing_user_name"] == "Test Coordinator"
    assert stock_of(session, product) == Decimal("15")


def test_exit_above_stock_is_rejected_without_changes(client, session, product):
    movement_id = request_movement(client, product, "EXIT", 11).json()["id"]
    response = client.patch(f"/movements/{movement_id}/authorize")

    assert response.status_code == 400
    assert "Insufficient stock" in response.json()["detail"]
    assert stock_of(session, product) == Decimal("10")
    assert client.get(f"/movements/{movement_id}").json()["status"] == "pending"


def test_exit_to_minimum_creates_alert(client, session, product):
    movement_id = request_movement(client, product, "EXIT", 7).json()["id"]
    assert client.patch(f"/movements/{movement_id}/authorize").status_code == 200

    assert stock_of(session, product) == Decimal("3")
    active = session.scalars(
        select(Alert).where(Alert.product_id == product.id, Alert.status == "active")
    ).all()
    assert len(active) == 1


def test_adjustment_to_zero_is_allowed(client, session, product):
    movement_id = request_movement(client, product, "ADJUSTMENT", 0).json()["id"]
    assert client.patch(f"/movements/{movement_id}/authorize").status_code == 200
    assert stock_of(session, product) == Decimal("0")


@pytest.mark.parametrize("type_", ["EXIT", "ADJUSTMENT"])
def test_reason_required_for_exit_and_adjustment(client, product, type_):
    response = request_movement(client, product, type_, 1, reason="  ")
    assert response.status_code == 422


def test_entry_without_reason_is_allowed(client, product):
    response = request_movement(client, product, "ENTRY", 1, reason=None)
    assert response.status_code == 201


def test_reject_keeps_stock_and_blocks_authorization(client, session, product):
    movement_id = request_movement(client, product, "EXIT", 4).json()["id"]
    response = client.patch(f"/movements/{movement_id}/reject")

    assert response.status_code == 200
    assert response.json()["status"] == "rejected"
    assert response.json()["authorizing_user_name"] == "Test Coordinator"
    assert stock_of(session, product) == Decimal("10")

    assert client.patch(f"/movements/{movement_id}/authorize").status_code == 400
    assert client.patch(f"/movements/{movement_id}/reject").status_code == 400


def test_cannot_reject_authorized_movement(client, product):
    movement_id = request_movement(client, product, "ENTRY", 1).json()["id"]
    client.patch(f"/movements/{movement_id}/authorize")
    assert client.patch(f"/movements/{movement_id}/reject").status_code == 400


def test_unknown_movement_returns_404(client):
    assert client.patch("/movements/999999999/authorize").status_code == 404
    assert client.patch("/movements/999999999/reject").status_code == 404


def test_list_filters(client, product):
    request_movement(client, product, "ENTRY", 1)
    pending = client.get("/movements", params={"status_filter": "pending"})

    assert pending.status_code == 200
    assert all(m["status"] == "pending" for m in pending.json())
    assert client.get("/movements", params={"status_filter": "zzz"}).status_code == 422
    assert client.get("/movements", params={"type_filter": "LOAN"}).status_code == 422


def test_catalogs_available_to_any_role(client):
    client.act_as("Read-only")
    categories = client.get("/categories")
    units = client.get("/units")

    assert categories.status_code == 200 and categories.json()
    assert units.status_code == 200 and "abbreviation" in units.json()[0]
