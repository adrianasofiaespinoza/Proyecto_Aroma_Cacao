"""Operaciones simultáneas sobre el mismo stock (Sprint 5, Emma).

Cada petición usa su propia conexión real (get_db sin sustituir), así que estas pruebas
confirman datos. Solo corren si se activan a propósito y en una BD de pruebas:

    RUN_CONCURRENCY_TESTS=1 DATABASE_URL=.../aroma_test pytest tests/test_stock_concurrency.py

Al terminar borran todo lo que crearon. Para que la carrera sea real, cada prueba
retrasa 0,5 s el paso entre leer el stock y escribirlo: sin los bloqueos de fila
(with_for_update) las dos operaciones leerían el mismo valor. Resultados en
docs/flows/movimientos.md (sección «Operaciones simultáneas»).
"""

import os
import threading
import time
import uuid
from decimal import Decimal

import pytest
from fastapi import Request
from fastapi.testclient import TestClient
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

import app.routers.loans as loans_router
import app.routers.movements as movements_router
from app.database import SessionLocal, engine
from app.main import app
from app.models.alert import Alert
from app.models.loan import Loan, Worker
from app.models.movement import Movement, MovementDetail
from app.models.product import Category, Product, UnitOfMeasure
from app.models.user import User
from app.security.auth import get_current_user
from app.services.alerts import update_stock_alerts

pytestmark = pytest.mark.skipif(
    os.getenv("RUN_CONCURRENCY_TESTS") != "1",
    reason="Confirma datos reales: activar con RUN_CONCURRENCY_TESTS=1 en una BD de pruebas",
)

DELAY = 0.5


# ============================================================
# FIXTURES: datos reales, borrados al final
# ============================================================

@pytest.fixture
def world():
    """Un Coordinator, un Operator y un producto con stock 10 y mínimo 3."""
    suffix = uuid.uuid4().hex[:8]
    with SessionLocal() as db:
        users = {}
        for role in ("Coordinator", "Operator"):
            user = User(
                username=f"conc_{role[:4].lower()}_{suffix}",
                full_name=f"Concurrencia {role}",
                email=f"conc_{role[:4].lower()}_{suffix}@example.com",
                role=role,
            )
            db.add(user)
            users[role] = user
        product = Product(
            internal_code=f"CONC-{suffix}",
            name=f"Producto concurrencia {suffix}",
            current_stock=Decimal("10"),
            minimum_stock=Decimal("3"),
            status="active",
            category_id=db.scalar(select(Category.id)),
            unit_of_measure_id=db.scalar(select(UnitOfMeasure.id)),
        )
        db.add(product)
        db.commit()
        data = {
            "users": {role: u.id for role, u in users.items()},
            "product_id": product.id,
            "worker_name": f"Trabajador {suffix}",
        }

    # Quién hace la petición: encabezado X-Test-User con el id del usuario
    def current_user(request: Request):
        with SessionLocal() as db:
            user = db.get(User, int(request.headers["X-Test-User"]))
            db.expunge(user)
            return user

    app.dependency_overrides[get_current_user] = current_user
    yield data
    app.dependency_overrides.clear()

    with SessionLocal() as db:
        product_id = data["product_id"]
        movement_ids = select(MovementDetail.movement_id).where(MovementDetail.product_id == product_id)
        db.execute(delete(Movement).where(Movement.id.in_(movement_ids)))
        db.execute(delete(Loan).where(Loan.product_id == product_id))
        db.execute(delete(Worker).where(Worker.full_name == data["worker_name"]))
        db.execute(delete(Alert).where(Alert.product_id == product_id))
        db.execute(delete(Product).where(Product.id == product_id))
        db.execute(delete(User).where(User.id.in_(data["users"].values())))
        db.commit()


def as_user(user_id: int) -> dict:
    return {"X-Test-User": str(user_id)}


def run_together(*calls):
    """Ejecuta las llamadas a la vez y devuelve sus respuestas en el mismo orden."""
    results = [None] * len(calls)
    barrier = threading.Barrier(len(calls))

    def worker(index, call):
        barrier.wait()
        results[index] = call(TestClient(app))

    threads = [threading.Thread(target=worker, args=(i, c)) for i, c in enumerate(calls)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return results


def slow(monkeypatch, module, name):
    """Retrasa una función del módulo: ensancha la ventana entre leer y escribir."""
    original = getattr(module, name)

    def delayed(*args, **kwargs):
        time.sleep(DELAY)
        return original(*args, **kwargs)

    monkeypatch.setattr(module, name, delayed)


def create_exit(world, quantity: str) -> int:
    res = TestClient(app).post(
        "/movements",
        json={
            "type": "EXIT",
            "reason": "Prueba de concurrencia",
            "details": [{"product_id": world["product_id"], "quantity": quantity}],
        },
        headers=as_user(world["users"]["Operator"]),
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


def product_state(world) -> tuple[Decimal, int]:
    """(stock actual, alertas activas)."""
    with SessionLocal() as db:
        product = db.get(Product, world["product_id"])
        active = db.scalars(
            select(Alert).where(Alert.product_id == product.id, Alert.status == "active")
        ).all()
        return product.current_stock, len(active)


# ============================================================
# PRUEBAS
# ============================================================

def test_two_exits_exceeding_stock_only_one_is_authorized(world, monkeypatch):
    """Stock 10: dos salidas de 6 autorizadas a la vez. Solo una puede pasar."""
    first, second = create_exit(world, "6"), create_exit(world, "6")
    slow(monkeypatch, movements_router, "available_quantity")
    coordinator = as_user(world["users"]["Coordinator"])

    results = run_together(
        lambda c: c.patch(f"/movements/{first}/authorize", headers=coordinator),
        lambda c: c.patch(f"/movements/{second}/authorize", headers=coordinator),
    )

    assert sorted(r.status_code for r in results) == [200, 400]
    rejected = next(r for r in results if r.status_code == 400)
    assert "Insufficient stock" in rejected.json()["detail"]
    stock, active_alerts = product_state(world)
    assert stock == Decimal("4")
    assert active_alerts == 0


def test_same_movement_authorized_twice_applies_once(world, monkeypatch):
    """Dos Coordinators autorizan la misma salida a la vez: el stock baja una sola vez."""
    movement_id = create_exit(world, "3")
    slow(monkeypatch, movements_router, "apply_authorization")
    coordinator = as_user(world["users"]["Coordinator"])

    results = run_together(
        lambda c: c.patch(f"/movements/{movement_id}/authorize", headers=coordinator),
        lambda c: c.patch(f"/movements/{movement_id}/authorize", headers=coordinator),
    )

    assert sorted(r.status_code for r in results) == [200, 400]
    rejected = next(r for r in results if r.status_code == 400)
    assert rejected.json()["detail"] == "Movement is already authorized"
    stock, _ = product_state(world)
    assert stock == Decimal("7")


def test_authorize_and_reject_at_once_only_one_wins(world, monkeypatch):
    """Autorizar y rechazar la misma solicitud a la vez: queda en un solo estado."""
    movement_id = create_exit(world, "2")
    slow(monkeypatch, movements_router, "apply_authorization")
    coordinator = as_user(world["users"]["Coordinator"])

    results = run_together(
        lambda c: c.patch(f"/movements/{movement_id}/authorize", headers=coordinator),
        lambda c: c.patch(f"/movements/{movement_id}/reject", headers=coordinator),
    )

    assert sorted(r.status_code for r in results) == [200, 400]
    with SessionLocal() as db:
        final_status = db.get(Movement, movement_id).status
    stock, _ = product_state(world)
    assert stock == (Decimal("8") if final_status == "authorized" else Decimal("10"))


def test_loan_and_exit_at_once_never_exceed_stock(world, monkeypatch):
    """Stock 10: un préstamo de 6 y una salida de 6 a la vez. Solo uno puede pasar."""
    movement_id = create_exit(world, "6")
    slow(monkeypatch, movements_router, "available_quantity")
    slow(monkeypatch, loans_router, "available_quantity")
    operator = as_user(world["users"]["Operator"])
    coordinator = as_user(world["users"]["Coordinator"])

    loan, exit_ = run_together(
        lambda c: c.post(
            "/loans",
            json={"product_id": world["product_id"], "quantity": "6", "worker_name": world["worker_name"]},
            headers=operator,
        ),
        lambda c: c.patch(f"/movements/{movement_id}/authorize", headers=coordinator),
    )

    # Exactamente uno pasa; el otro recibe 400 por falta de disponible
    assert sorted([loan.status_code, exit_.status_code]) in ([200, 400], [201, 400])
    assert (loan.status_code == 201) != (exit_.status_code == 200)
    stock, _ = product_state(world)
    with SessionLocal() as db:
        loaned = sum(
            loan_row.quantity for loan_row in db.scalars(
                select(Loan).where(Loan.product_id == world["product_id"], Loan.status == "loaned")
            )
        )
    # Lo prestado nunca supera lo que hay en bodega
    assert loaned <= stock
    assert (stock, loaned) in {(Decimal("10"), Decimal("6")), (Decimal("4"), Decimal("0"))}


def test_two_loans_exceeding_available_only_one_is_created(world, monkeypatch):
    """Stock 10: dos préstamos de 6 a la vez. Solo uno puede registrarse."""
    slow(monkeypatch, loans_router, "available_quantity")
    operator = as_user(world["users"]["Operator"])
    body = {"product_id": world["product_id"], "quantity": "6", "worker_name": world["worker_name"]}

    results = run_together(
        lambda c: c.post("/loans", json=body, headers=operator),
        lambda c: c.post("/loans", json=body, headers=operator),
    )

    assert sorted(r.status_code for r in results) == [201, 400]
    with SessionLocal() as db:
        loans = db.scalars(select(Loan).where(Loan.product_id == world["product_id"])).all()
    assert len(loans) == 1


def test_simultaneous_alerts_keep_a_single_active_one(world):
    """Dos transacciones crean la alerta del mismo producto a la vez (sin bloquear el producto).

    La segunda espera en el índice único (migración 0007), falla en su savepoint
    y termina sin error, con una sola alerta activa.
    """
    with SessionLocal() as db:
        product = db.get(Product, world["product_id"])
        product.current_stock = Decimal("2")
        db.commit()

    errors: list[Exception] = []
    first_inserted = threading.Event()

    def first():
        with Session(engine) as db:
            update_stock_alerts(db, db.get(Product, world["product_id"]))
            db.flush()
            first_inserted.set()
            time.sleep(DELAY)  # la segunda queda esperando en el índice
            db.commit()

    def second():
        first_inserted.wait()
        with Session(engine) as db:
            try:
                product = db.get(Product, world["product_id"])
                # Lee antes de que la primera confirme: no ve ninguna alerta activa
                update_stock_alerts(db, product)
                db.commit()
            except Exception as exc:  # pragma: no cover - solo si falla
                errors.append(exc)

    threads = [threading.Thread(target=first), threading.Thread(target=second)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert errors == []
    _, active_alerts = product_state(world)
    assert active_alerts == 1
