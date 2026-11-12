
"""
AC-7: Pruebas de reactivación de productos.

Verifica permisos, actualización del estado y
conservación de los datos del producto.
"""


def test_reactivate_inactive_product(client, product):
    # Preparar un producto inactivo.
    product.status = "inactive"

    # Reactivar mediante la API como Coordinator.
    response = client.patch(
        f"/products/{product.id}/reactivate"
    )

    assert response.status_code == 200
    assert response.json()["status"] == "active"


def test_reactivation_preserves_product_data(client, product):
    # Guardar la información original del producto.
    original_code = product.internal_code
    original_name = product.name
    original_stock = product.current_stock

    product.status = "inactive"

    response = client.patch(
        f"/products/{product.id}/reactivate"
    )

    assert response.status_code == 200

    data = response.json()

    # La reactivación no debe alterar otros datos.
    assert data["internal_code"] == original_code
    assert data["name"] == original_name
    assert float(data["current_stock"]) == float(original_stock)


def test_cannot_reactivate_active_product(client, product):
    # El producto ya está activo.
    response = client.patch(
        f"/products/{product.id}/reactivate"
    )

    # Se espera un conflicto.
    assert response.status_code == 409


def test_operator_cannot_reactivate_product(client, product):
    # Cambiar al rol Operator.
    client.act_as("Operator")

    product.status = "inactive"

    response = client.patch(
        f"/products/{product.id}/reactivate"
    )

    # Solo Coordinator tiene autorización.
    assert response.status_code == 403


def test_reactivate_nonexistent_product(client):
    # Intentar reactivar un identificador inexistente.
    response = client.patch(
        "/products/999999999/reactivate"
    )

    assert response.status_code == 404
