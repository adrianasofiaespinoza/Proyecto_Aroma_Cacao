"""Sprint 3: configuración de la empresa, logo, módulos, autoaprobación e instalación.

Cada prueba corre dentro de una transacción que se revierte (fixtures en conftest.py).
Requiere la BD con la revisión 0004 de Alembic aplicada.
"""

import base64
import uuid
from decimal import Decimal

import pytest

from app.install import CATEGORIES, UNITS, ensure_coordinator, seed_catalogs
from app.models.loan import Loan, Worker
from app.models.movement import Movement
from app.models.product import Category, Product, UnitOfMeasure
from app.models.user import User
from app.services.company import color_errors, contrast, get_or_create_settings

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 32
SVG = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><rect width="1" height="1"/></svg>'


def data_url(content: bytes, mime: str) -> str:
    return f"data:{mime};base64,{base64.b64encode(content).decode()}"


def valid_payload(**overrides):
    payload = {
        "name": "Envases del Litoral S.A.",
        "short_name": "Envases Litoral",
        "subtitle": "Mantenimiento",
        "tax_id_label": "NIT",
        "tax_id": "900123456-7",
        "currency": "COP",
        "date_format": "aaaa-mm-dd",
        "brand_color": "#1d4e7a",
        "accent_color": "#e3b341",
        "modules": {"loans": True, "machines": True, "suppliers": True},
        "coordinator_auto_approve": False,
    }
    payload.update(overrides)
    return payload


@pytest.fixture
def support(client):
    """Cliente que actúa como el equipo de desarrollo (rol Support)."""
    client.act_as("Support")
    return client


def set_settings(session, **values):
    settings = get_or_create_settings(session)
    for key, value in values.items():
        setattr(settings, key, value)
    session.commit()
    return settings


# ------------------------------------------------------------
# Configuración: lectura pública y edición del Coordinator
# ------------------------------------------------------------

def test_public_settings_need_no_session_and_hide_tax_id(auth_client, session):
    set_settings(session, tax_id="1790011223001")
    response = auth_client.get("/settings/public")
    assert response.status_code == 200
    body = response.json()
    assert {"name", "short_name", "logo_url", "brand_color", "currency", "date_format", "modules"} <= body.keys()
    assert "tax_id" not in body
    assert body["tax_id_label"]  # la etiqueta sí, para los formularios
    assert "coordinator_auto_approve" not in body
    assert "1790011223001" not in response.text


def test_only_support_reads_and_updates_full_settings(client):
    # Ni siquiera el Coordinator de la empresa cambia la marca, la moneda o los módulos
    for role in ("Coordinator", "Operator", "Read-only"):
        client.act_as(role)
        assert client.get("/settings").status_code == 403
        assert client.put("/settings", json=valid_payload()).status_code == 403

    client.act_as("Support")
    assert client.get("/settings").status_code == 200
    response = client.put("/settings", json=valid_payload())
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Envases del Litoral S.A."
    assert body["tax_id"] == "900123456-7"
    assert body["currency"] == "COP"

    public = client.get("/settings/public").json()
    assert public["short_name"] == "Envases Litoral"
    assert public["brand_color"] == "#1d4e7a"


def test_coordinator_changes_only_operating_rules(client):
    client.act_as("Coordinator")
    assert client.get("/settings/rules").json() == {"coordinator_auto_approve": False}
    response = client.put("/settings/rules", json={"coordinator_auto_approve": True})
    assert response.status_code == 200
    assert client.get("/settings/rules").json() == {"coordinator_auto_approve": True}

    client.act_as("Support")
    assert client.put("/settings/rules", json={"coordinator_auto_approve": False}).status_code == 200

    for role in ("Operator", "Read-only"):
        client.act_as(role)
        assert client.get("/settings/rules").status_code == 403
        assert client.put("/settings/rules", json={"coordinator_auto_approve": True}).status_code == 403


def test_settings_require_auth(auth_client):
    assert auth_client.get("/settings").status_code == 401
    assert auth_client.put("/settings", json=valid_payload()).status_code == 401


@pytest.mark.parametrize("field, value", [
    ("currency", "BTC"),
    ("date_format", "dd.mm.aa"),
    ("brand_color", "verde"),
    ("brand_color", "#12345"),
    ("name", "   "),
    ("short_name", "x" * 41),
])
def test_invalid_values_are_rejected(support, field, value):
    response = support.put("/settings", json=valid_payload(**{field: value}))
    assert response.status_code == 422


def test_light_brand_color_is_rejected_for_contrast(support):
    # Amarillo claro: ilegible como texto sobre blanco
    response = support.put("/settings", json=valid_payload(brand_color="#f5e663"))
    assert response.status_code == 422
    assert "brand_color" in response.text


def test_dark_accent_is_rejected_on_navigation(support):
    response = support.put("/settings", json=valid_payload(accent_color="#10202a"))
    assert response.status_code == 422
    assert "accent_color" in response.text


def test_default_palette_passes_contrast_rules():
    assert color_errors("#0b6e4f", "#f2a900") == []
    assert round(contrast("#000000", "#ffffff"), 1) == 21.0


def test_public_info_uses_company_name(client, session):
    set_settings(session, name="Envases del Litoral S.A.")
    body = client.get("/public/info").json()
    assert body["company"] == "Envases del Litoral S.A."
    assert "Aroma" not in body["application"]


# ------------------------------------------------------------
# Logo y favicon
# ------------------------------------------------------------

def test_upload_read_and_delete_logo(support, auth_client):
    response = support.put("/settings/logo", json={"data_url": data_url(PNG, "image/png")})
    assert response.status_code == 200
    url = response.json()["logo_url"]
    assert url.startswith("/settings/logo?v=")

    image = auth_client.get(url)
    assert image.status_code == 200
    assert image.headers["content-type"] == "image/png"
    assert image.content == PNG
    assert image.headers["x-content-type-options"] == "nosniff"

    favicon = auth_client.get("/favicon.ico")
    assert favicon.status_code == 200
    assert favicon.content == PNG

    assert support.delete("/settings/logo").json()["logo_url"] is None
    assert auth_client.get("/settings/logo").status_code == 404


def test_svg_logo_is_served_with_restrictive_policy(support, auth_client):
    assert support.put("/settings/logo", json={"data_url": data_url(SVG, "image/svg+xml")}).status_code == 200
    image = auth_client.get("/settings/logo")
    assert image.headers["content-type"].startswith("image/svg+xml")
    assert "default-src 'none'" in image.headers["content-security-policy"]


def test_favicon_without_logo_is_generic_icon(support, auth_client):
    support.delete("/settings/logo")
    favicon = auth_client.get("/favicon.ico")
    assert favicon.status_code == 200
    assert favicon.headers["content-type"].startswith("image/svg+xml")


@pytest.mark.parametrize("content, mime", [
    (b"GIF89a" + b"\x00" * 10, "image/gif"),         # tipo no permitido
    (b"not a png at all", "image/png"),              # el contenido no coincide
    (b"\x89PNG\r\n\x1a\n" + b"\x00" * (200 * 1024), "image/png"),  # más de 200 KB
])
def test_invalid_logo_is_rejected(support, content, mime):
    response = support.put("/settings/logo", json={"data_url": data_url(content, mime)})
    assert response.status_code == 422


def test_only_support_changes_logo(client):
    for role in ("Coordinator", "Operator"):
        client.act_as(role)
        assert client.put("/settings/logo", json={"data_url": data_url(PNG, "image/png")}).status_code == 403
        assert client.delete("/settings/logo").status_code == 403


# ------------------------------------------------------------
# Módulos activables
# ------------------------------------------------------------

@pytest.mark.parametrize("module, endpoints", [
    ("loans", ["/loans", "/workers"]),
    ("machines", ["/machines"]),
    ("suppliers", ["/suppliers"]),
])
def test_disabled_module_returns_403(client, session, module, endpoints):
    for endpoint in endpoints:
        assert client.get(endpoint).status_code == 200

    set_settings(session, **{f"module_{module}": False})
    for endpoint in endpoints:
        response = client.get(endpoint)
        assert response.status_code == 403
        assert "disabled" in response.json()["detail"]

    set_settings(session, **{f"module_{module}": True})
    for endpoint in endpoints:
        assert client.get(endpoint).status_code == 200


def test_rest_of_system_works_without_modules(client, session, product):
    set_settings(session, module_loans=False, module_machines=False, module_suppliers=False)
    assert client.get("/products").status_code == 200
    assert client.get("/alerts").status_code == 200
    created = client.post("/movements", json={
        "type": "ENTRY", "reason": "Compra",
        "details": [{"product_id": product.id, "quantity": "2"}],
    })
    assert created.status_code == 201
    assert client.patch(f"/movements/{created.json()['id']}/authorize").status_code == 200


def test_disabling_module_keeps_its_data(client, session):
    worker = Worker(full_name=f"Trabajador {uuid.uuid4().hex[:6]}")
    session.add(worker)
    session.commit()
    set_settings(session, module_loans=False)
    assert session.get(Worker, worker.id) is not None


def test_cannot_disable_loans_with_tools_on_loan(support, session, product):
    worker = Worker(full_name="Trabajador con préstamo")
    session.add(worker)
    session.flush()
    session.add(Loan(worker_id=worker.id, product_id=product.id, quantity=Decimal("1"), status="loaned"))
    session.commit()

    payload = valid_payload(modules={"loans": False, "machines": True, "suppliers": True})
    response = support.put("/settings", json=payload)
    assert response.status_code == 409
    assert "still on loan" in response.json()["detail"]


# ------------------------------------------------------------
# Autoaprobación del Coordinator
# ------------------------------------------------------------

def stock_of(session, product):
    session.expire_all()
    return session.get(Product, product.id).current_stock


def entry(client, product, quantity="5"):
    return client.post("/movements", json={
        "type": "ENTRY", "reason": "Compra",
        "details": [{"product_id": product.id, "quantity": quantity}],
    })


def test_auto_approve_off_by_default(client, session, product):
    assert get_or_create_settings(session).coordinator_auto_approve is False
    response = entry(client, product)
    assert response.json()["status"] == "pending"
    assert stock_of(session, product) == Decimal("10")


def test_auto_approve_authorizes_coordinator_request(client, session, product, users):
    set_settings(session, coordinator_auto_approve=True)
    response = entry(client, product)
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "authorized"
    assert body["auto_authorize_error"] is None
    # Queda en el historial quién la solicitó y quién la autorizó
    assert body["requesting_user_id"] == users["Coordinator"].id
    assert body["authorizing_user_id"] == users["Coordinator"].id
    assert stock_of(session, product) == Decimal("15")


def test_auto_approve_does_not_apply_to_operator(client, session, product):
    set_settings(session, coordinator_auto_approve=True)
    client.act_as("Operator")
    assert entry(client, product).json()["status"] == "pending"
    assert stock_of(session, product) == Decimal("10")


def test_auto_approve_failing_validation_stays_pending(client, session, product):
    set_settings(session, coordinator_auto_approve=True)
    response = client.post("/movements", json={
        "type": "EXIT", "reason": "Consumo",
        "details": [{"product_id": product.id, "quantity": "50"}],
    })
    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "pending"
    assert "Insufficient stock" in body["auto_authorize_error"]
    assert stock_of(session, product) == Decimal("10")
    session.expire_all()
    assert session.get(Movement, body["id"]).status == "pending"


def test_auto_approve_updates_alerts(client, session, product):
    set_settings(session, coordinator_auto_approve=True)
    response = client.post("/movements", json={
        "type": "EXIT", "reason": "Consumo",
        "details": [{"product_id": product.id, "quantity": "8"}],
    })
    assert response.json()["status"] == "authorized"
    alerts = client.get("/alerts").json()
    assert any(a["product_id"] == product.id and a["status"] == "active" for a in alerts)


# ------------------------------------------------------------
# Script de instalación
# ------------------------------------------------------------

def test_seed_catalogs_is_idempotent(session):
    seed_catalogs(session)
    assert seed_catalogs(session) == 0
    names = set(session.scalars(Category.__table__.select().with_only_columns(Category.name)))
    assert set(CATEGORIES) <= names
    units = set(session.scalars(UnitOfMeasure.__table__.select().with_only_columns(UnitOfMeasure.name)))
    assert {name for name, _ in UNITS} <= units


def test_ensure_coordinator_skips_when_one_exists(session, users, monkeypatch):
    def fail(*_):
        raise AssertionError("No debe pedir datos si ya hay un Coordinator activo")

    monkeypatch.setattr("app.install.ask_coordinator", fail)
    before = session.get(User, users["Coordinator"].id).password_hash
    assert ensure_coordinator(session) is True
    assert session.get(User, users["Coordinator"].id).password_hash == before


def test_ensure_coordinator_creates_first_one(session, monkeypatch):
    session.execute(User.__table__.update().where(User.role == "Coordinator").values(is_active=False))
    suffix = uuid.uuid4().hex[:8]
    monkeypatch.setattr("app.install.ask_coordinator", lambda: {
        "username": f"inst_{suffix}", "full_name": "Instalación",
        "email": f"inst_{suffix}@example.com", "password": "ClaveSegura123",
    })
    assert ensure_coordinator(session) is True
    created = session.query(User).filter_by(username=f"inst_{suffix}").one()
    assert created.role == "Coordinator"
    assert created.password_hash and created.password_hash != "ClaveSegura123"


# ------------------------------------------------------------
# Cuenta de soporte: invisible para la empresa
# ------------------------------------------------------------

def test_support_accounts_are_hidden_from_company(client, users):
    client.act_as("Coordinator")
    listed = {u["id"] for u in client.get("/users").json()}
    assert users["Support"].id not in listed
    assert users["Coordinator"].id in listed

    update = {
        "username": users["Support"].username, "full_name": "Cambio", "email": users["Support"].email,
        "role": "Read-only", "is_active": False,
    }
    assert client.put(f"/users/{users['Support'].id}", json=update).status_code == 404


def test_company_cannot_assign_support_role(client):
    suffix = uuid.uuid4().hex[:8]
    response = client.post("/users", json={
        "username": f"x_{suffix}", "full_name": "X", "email": f"x_{suffix}@example.com",
        "password": "ClaveSegura123", "role": "Support",
    })
    assert response.status_code == 422


def test_support_cannot_create_or_authorize_movements(client, product):
    client.act_as("Support")
    response = client.post("/movements", json={
        "type": "ENTRY", "reason": "Prueba",
        "details": [{"product_id": product.id, "quantity": "1"}],
    })
    assert response.status_code == 403
    assert client.get("/products").status_code == 200
