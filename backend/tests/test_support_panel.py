"""Soporte: rol aparte con panel técnico (decisión de la usuaria, 2026-11-27).

Administra usuarios y configuración y ve el estado del sistema; no ve la bodega.
"""

import uuid

import pytest


@pytest.mark.parametrize("path", [
    "/products", "/movements", "/alerts", "/loans", "/machines", "/suppliers",
    "/categories", "/units", "/exports/inventory",
])
def test_support_sees_no_warehouse_data(client, path):
    client.act_as("Support")
    assert client.get(path).status_code == 403


def test_support_manages_company_users(client, users):
    client.act_as("Support")
    listed = client.get("/users")
    assert listed.status_code == 200
    emails = {u["email"] for u in listed.json()}
    assert users["Coordinator"].email in emails
    assert users["Support"].email not in emails

    suffix = uuid.uuid4().hex[:8]
    created = client.post("/users", json={
        "username": f"coord_{suffix}", "full_name": "Coordinadora Nueva", "email": f"coord_{suffix}@example.com",
        "password": "Inicial12345", "role": "Coordinator",
    })
    assert created.status_code == 201
    # No puede crear ni editar cuentas de soporte
    bad = client.post("/users", json={
        "username": f"sup_{suffix}", "full_name": "Otro soporte", "email": f"sup_{suffix}@example.com",
        "password": "Inicial12345", "role": "Support",
    })
    assert bad.status_code == 422
    assert client.put(f"/users/{users['Support'].id}", json={
        "full_name": "X", "email": users["Support"].email, "role": "Operator", "is_active": True,
    }).status_code == 404


def test_system_status_only_for_support(client):
    for role in ("Coordinator", "Operator", "Read-only"):
        client.act_as(role)
        assert client.get("/system/status").status_code == 403
    client.act_as("Support")
    res = client.get("/system/status")
    assert res.status_code == 200
    body = res.json()
    assert body["database"]["ok"] is True
    assert body["database"]["migration_expected"]
    assert "Coordinator" in body["users"]["by_role"]
    assert {"products_active", "movements_pending", "alerts_active", "loans_open"} <= set(body["totals"])
