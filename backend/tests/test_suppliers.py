"""
Proveedores y productos por proveedor sobre PostgreSQL local.

Usa los fixtures de conftest.py (transacción revertida); no se ejecuta en CI.
"""

import uuid


def new_supplier(client, **overrides):
    data = {
        "company_name": "Ferretería de prueba",
        "ruc": str(uuid.uuid4().int)[:13],
        "contact_person": "Jorge Ramírez",
        "phone": "0987654321",
        "address": "Quito",
        "email": "ventas@example.com",
    }
    data.update(overrides)
    return client.post("/suppliers", json=data)


def test_supplier_create_update_and_permissions(client):
    response = new_supplier(client, contact_person="  ", phone="")
    assert response.status_code == 201
    supplier = response.json()
    assert supplier["contact_person"] is None and supplier["phone"] is None
    assert supplier["product_links"] == []

    updated = client.put(f"/suppliers/{supplier['id']}", json={
        "company_name": "Ferretería Andina", "ruc": supplier["ruc"],
    })
    assert updated.status_code == 200
    assert updated.json()["company_name"] == "Ferretería Andina"
    assert updated.json()["email"] is None

    assert client.get("/suppliers/999999999").status_code == 404

    for role in ("Operator", "Read-only"):
        client.act_as(role)
        assert client.get("/suppliers").status_code == 200
        assert new_supplier(client).status_code == 403
        assert client.put(f"/suppliers/{supplier['id']}", json={"company_name": "X"}).status_code == 403


def test_supplier_validations(client):
    ruc = new_supplier(client).json()["ruc"]

    assert new_supplier(client, ruc=ruc).status_code == 409
    assert new_supplier(client, ruc=None).status_code == 201
    assert new_supplier(client, ruc=None).status_code == 201
    assert new_supplier(client, company_name=" ").status_code == 422
    assert new_supplier(client, ruc="17900-123").status_code == 422
    assert new_supplier(client, email="no-es-correo").status_code == 422
    assert new_supplier(client, phone="0" * 21).status_code == 422


def test_supplier_products_and_prices(client, product):
    supplier_id = new_supplier(client).json()["id"]
    url = f"/suppliers/{supplier_id}/products"

    added = client.post(url, json={"product_id": product.id, "reference_price": "14.50"})
    assert added.status_code == 201
    assert added.json()["product_links"] == [{"product_id": product.id, "reference_price": "14.50"}]

    assert client.post(url, json={"product_id": product.id}).status_code == 409
    assert client.post(url, json={"product_id": 999999999}).status_code == 404
    assert client.post(url, json={"product_id": product.id, "reference_price": "-1"}).status_code == 422

    priced = client.patch(f"{url}/{product.id}", json={"reference_price": None})
    assert priced.status_code == 200
    assert priced.json()["product_links"][0]["reference_price"] is None

    client.act_as("Operator")
    assert client.delete(f"{url}/{product.id}").status_code == 403
    client.act_as("Coordinator")

    assert client.delete(f"{url}/{product.id}").json()["product_links"] == []
    assert client.delete(f"{url}/{product.id}").status_code == 404
    assert client.patch(f"{url}/{product.id}", json={"reference_price": "1"}).status_code == 404
