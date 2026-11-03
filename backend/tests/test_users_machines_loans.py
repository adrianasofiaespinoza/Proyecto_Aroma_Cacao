"""
Usuarios, máquinas y préstamos sobre PostgreSQL local.

Usa los fixtures de conftest.py (transacción revertida); no se ejecuta en CI.
"""

import uuid
from decimal import Decimal

from sqlalchemy import select

from app.models.product import Product
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.security.password import verify_password


def unique(prefix):
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


# ============================================================
# USERS
# ============================================================

def new_user_payload(**overrides):
    name = unique("user")
    data = {
        "username": name,
        "full_name": "Nuevo Operador",
        "email": f"{name}@example.com",
        "password": "Segura-1234",
        "role": "Operator",
    }
    data.update(overrides)
    return data


def test_only_coordinator_manages_users(client):
    for role in ("Operator", "Read-only"):
        client.act_as(role)
        assert client.get("/users").status_code == 403
        assert client.post("/users", json=new_user_payload()).status_code == 403
        assert client.put("/users/1", json={}).status_code in (403, 422)
        assert client.get("/users/me").status_code == 200


def test_create_user_hashes_password(client, session):
    response = client.post("/users", json=new_user_payload())

    assert response.status_code == 201
    body = response.json()
    assert body["role"] == "Operator" and body["is_active"] is True
    assert "password" not in body and "password_hash" not in body

    stored = session.get(User, body["id"])
    assert stored.password_hash != "Segura-1234"
    assert verify_password("Segura-1234", stored.password_hash)


def test_create_user_validations(client, users):
    existing = users["Operator"]

    assert client.post("/users", json=new_user_payload(password="corta")).status_code == 422
    assert client.post("/users", json=new_user_payload(role="Admin")).status_code == 422
    assert client.post("/users", json=new_user_payload(email="no-es-correo")).status_code == 422
    assert client.post("/users", json=new_user_payload(username=existing.username)).status_code == 409
    assert client.post("/users", json=new_user_payload(email=existing.email)).status_code == 409


def test_update_user_role_and_deactivate_revokes_tokens(client, session, users):
    target = users["Operator"]
    token = RefreshToken(
        user_id=target.id,
        token_hash=unique("hash"),
        expires_at=target.created_at.replace(year=target.created_at.year + 1),
    )
    session.add(token)
    session.flush()

    response = client.put(f"/users/{target.id}", json={
        "full_name": "Operador Editado",
        "email": target.email,
        "role": "Read-only",
        "is_active": False,
    })

    assert response.status_code == 200
    assert response.json()["role"] == "Read-only"
    assert response.json()["is_active"] is False
    session.expire_all()
    assert session.get(RefreshToken, token.id).revoked_at is not None


def test_coordinator_cannot_lock_themselves_out(client, users):
    me = users["Coordinator"]
    base = {"full_name": me.full_name, "email": me.email}

    deactivate = client.put(f"/users/{me.id}", json={**base, "role": "Coordinator", "is_active": False})
    demote = client.put(f"/users/{me.id}", json={**base, "role": "Operator", "is_active": True})
    rename = client.put(f"/users/{me.id}", json={**base, "full_name": "Coord Renombrado", "role": "Coordinator", "is_active": True})

    assert deactivate.status_code == 400
    assert demote.status_code == 400
    assert rename.status_code == 200


def test_update_user_conflicts_and_404(client, users):
    other = users["Read-only"]
    payload = {"full_name": "X", "email": other.email, "role": "Operator", "is_active": True}

    assert client.put(f"/users/{users['Operator'].id}", json=payload).status_code == 409
    assert client.put("/users/999999999", json=payload).status_code == 404


# ============================================================
# MACHINES
# ============================================================

def new_machine(client, **overrides):
    data = {"name": "Molino de prueba", "identification_code": unique("MAQ"), "location": "Nivel 1"}
    data.update(overrides)
    return client.post("/machines", json=data)


def test_machine_crud_and_permissions(client):
    response = new_machine(client)
    assert response.status_code == 201
    machine = response.json()
    assert machine["product_ids"] == []

    updated = client.put(f"/machines/{machine['id']}", json={
        "name": "Molino M-1", "identification_code": machine["identification_code"], "location": None,
    })
    assert updated.status_code == 200 and updated.json()["name"] == "Molino M-1"

    assert new_machine(client, identification_code=machine["identification_code"]).status_code == 409
    assert new_machine(client, name="  ").status_code == 422
    assert client.get("/machines/999999999").status_code == 404

    client.act_as("Operator")
    assert client.get("/machines").status_code == 200
    assert new_machine(client).status_code == 403
    client.act_as("Read-only")
    assert client.put(f"/machines/{machine['id']}", json={"name": "X", "identification_code": "X"}).status_code == 403


def test_machine_compatible_parts(client, product):
    machine_id = new_machine(client).json()["id"]
    url = f"/machines/{machine_id}/products"

    added = client.post(url, json={"product_id": product.id})
    assert added.status_code == 201 and added.json()["product_ids"] == [product.id]
    assert client.post(url, json={"product_id": product.id}).status_code == 409
    assert client.post(url, json={"product_id": 999999999}).status_code == 404

    client.act_as("Operator")
    assert client.delete(f"{url}/{product.id}").status_code == 403
    client.act_as("Coordinator")

    removed = client.delete(f"{url}/{product.id}")
    assert removed.status_code == 200 and removed.json()["product_ids"] == []
    assert client.delete(f"{url}/{product.id}").status_code == 404


# ============================================================
# LOANS
# ============================================================

def lend(client, product, quantity, worker="Jhonny Farinango"):
    return client.post("/loans", json={
        "product_id": product.id, "quantity": str(quantity), "worker_name": worker,
    })


def test_loan_does_not_change_stock_and_limits_available(client, session, product):
    client.act_as("Operator")
    first = lend(client, product, 6)

    assert first.status_code == 201
    assert first.json()["status"] == "loaned"
    assert first.json()["worker_name"] == "Jhonny Farinango"
    session.expire_all()
    assert session.get(Product, product.id).current_stock == Decimal("10")

    # Stock 10, prestado 6 -> disponible 4
    over = lend(client, product, 5)
    assert over.status_code == 400 and "Available: 4" in over.json()["detail"]
    assert lend(client, product, 4).status_code == 201


def test_return_frees_availability(client, product):
    loan_id = lend(client, product, 10).json()["id"]
    assert lend(client, product, 1).status_code == 400

    returned = client.patch(f"/loans/{loan_id}/return")
    assert returned.status_code == 200
    assert returned.json()["status"] == "returned"
    assert returned.json()["return_date"] is not None

    assert client.patch(f"/loans/{loan_id}/return").status_code == 400
    assert lend(client, product, 10).status_code == 201


def test_worker_reused_case_insensitive(client, product):
    a = lend(client, product, 1, worker="Ana Prueba Única").json()
    b = lend(client, product, 1, worker="  ana prueba única ").json()
    assert a["worker_id"] == b["worker_id"]

    workers = client.get("/workers").json()
    assert sum(w["full_name"] == "Ana Prueba Única" for w in workers) == 1


def test_loan_validations_and_permissions(client, session, product):
    assert lend(client, product, 0).status_code == 422
    assert lend(client, product, 1, worker=" ").status_code == 422
    assert client.post("/loans", json={"product_id": 999999999, "quantity": "1", "worker_name": "X"}).status_code == 404
    assert client.patch("/loans/999999999/return").status_code == 404

    product.status = "inactive"
    session.flush()
    assert lend(client, product, 1).status_code == 400
    product.status = "active"
    session.flush()

    loan_id = lend(client, product, 1).json()["id"]
    client.act_as("Read-only")
    assert lend(client, product, 1).status_code == 403
    assert client.patch(f"/loans/{loan_id}/return").status_code == 403
    assert client.get("/loans").status_code == 200

    loaned = client.get("/loans", params={"status_filter": "loaned"}).json()
    assert any(item["id"] == loan_id for item in loaned)
    assert client.get("/loans", params={"status_filter": "zzz"}).status_code == 422
    assert session.scalar(select(Product.current_stock).where(Product.id == product.id)) == Decimal("10")


def authorize_exit(client, product, quantity):
    movement = client.post("/movements", json={
        "type": "EXIT",
        "reason": "Salida con préstamos activos",
        "details": [{"product_id": product.id, "quantity": str(quantity)}],
    }).json()
    return client.patch(f"/movements/{movement['id']}/authorize")


def test_exit_validates_against_available_not_loaned(client, session, product):
    # Stock 10, prestado 6 -> solo 4 pueden salir
    loan_id = lend(client, product, 6).json()["id"]

    blocked = authorize_exit(client, product, 5)
    assert blocked.status_code == 400
    assert "Loaned: 6" in blocked.json()["detail"]
    assert "Available: 4" in blocked.json()["detail"]
    session.expire_all()
    assert session.get(Product, product.id).current_stock == Decimal("10")

    assert authorize_exit(client, product, 4).status_code == 200
    session.expire_all()
    assert session.get(Product, product.id).current_stock == Decimal("6")

    # Al devolver, lo prestado vuelve a estar disponible
    client.patch(f"/loans/{loan_id}/return")
    assert authorize_exit(client, product, 6).status_code == 200
