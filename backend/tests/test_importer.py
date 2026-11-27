"""Importar el inventario desde Excel o CSV (Sprint 5, Tamya).

Usa la transacción revertida de conftest: no deja datos en la BD.
"""

import base64
import io
import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from openpyxl import Workbook, load_workbook
from sqlalchemy import select

from app.models.alert import Alert
from app.models.lot import Lot
from app.models.machine import Machine
from app.models.movement import Movement
from app.models.product import Category, Product, UnitOfMeasure
from app.models.supplier import Supplier
from app.services.importer import INITIAL_LOAD_REASON, SHEETS, as_decimal

HEADERS = {spec.kind: spec.headers() for spec in SHEETS}
TITLES = {spec.kind: spec.title for spec in SHEETS}


def xlsx(**sheets: list[list]) -> bytes:
    """xlsx(products=[[...], ...], stock=[...]): una hoja por tipo con sus encabezados."""
    workbook = Workbook()
    workbook.remove(workbook.active)
    for kind, rows in sheets.items():
        sheet = workbook.create_sheet(TITLES[kind])
        sheet.append(HEADERS[kind])
        for row in rows:
            sheet.append(row)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def payload(content: bytes, filename: str = "inventario.xlsx", **extra) -> dict:
    return {"filename": filename, "data_base64": base64.b64encode(content).decode(), **extra}


@pytest.fixture
def unit(session):
    return session.scalar(select(UnitOfMeasure).order_by(UnitOfMeasure.id))


@pytest.fixture
def code():
    suffix = uuid.uuid4().hex[:6].upper()
    return lambda name: f"IMP-{name}-{suffix}"


def rows_of(preview: dict, kind: str) -> list[dict]:
    return next(s for s in preview["sheets"] if s["kind"] == kind)["rows"]


def messages(preview: dict, kind: str) -> list[str]:
    return [m for r in rows_of(preview, kind) for m in r["messages"]]


# ============================================================
# PLANTILLA Y PERMISOS
# ============================================================

def test_template_has_one_sheet_per_kind_and_empty_template_is_rejected(client):
    res = client.get("/imports/template")
    assert res.status_code == 200
    workbook = load_workbook(io.BytesIO(res.content))
    assert workbook.sheetnames == ["Instrucciones", "Productos", "Stock inicial", "Máquinas", "Proveedores"]
    assert [c.value for c in workbook["Productos"][1]] == HEADERS["products"]

    res = client.post("/imports/preview", json=payload(res.content))
    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "import_file"
    assert "no tiene filas" in res.json()["detail"]["message"]


@pytest.mark.parametrize("role", ["Operator", "Read-only", "Support"])
def test_only_coordinator_can_import(client, role):
    client.act_as(role)
    assert client.get("/imports/template").status_code == 403
    assert client.post("/imports/preview", json=payload(xlsx(machines=[["M", "N", None]]))).status_code == 403


def test_rejects_other_file_types_and_bad_base64(client):
    res = client.post("/imports/preview", json=payload(b"hola", filename="datos.txt"))
    assert res.status_code == 400
    assert "xlsx o .csv" in res.json()["detail"]["message"]
    res = client.post("/imports/preview", json={"filename": "a.xlsx", "data_base64": "no es base64!"})
    assert res.status_code == 400
    res = client.post("/imports/preview", json=payload(b"no es un excel"))
    assert "No se pudo abrir" in res.json()["detail"]["message"]


# ============================================================
# CARGA COMPLETA
# ============================================================

def test_preview_saves_nothing_and_confirm_loads_everything(client, session, users, unit, code):
    plain, lots, category = code("P"), code("L"), f"Categoría {uuid.uuid4().hex[:6]}"
    expiry = date.today() + timedelta(days=200)
    content = xlsx(
        products=[
            [plain, "Rodamiento", category, unit.abbreviation, "SKF", None, None, 5, 20, "A1", "No"],
            [lots, "Grasa", category, unit.name, None, None, None, 1, None, None, "Sí"],
        ],
        stock=[
            [plain, 12, None, None],
            [lots, 3, "L1", expiry],
            [lots, "2,5", "L2", None],
        ],
        machines=[[code("M"), "Tostadora", "Planta"]],
        suppliers=[["Proveedor importado", None, "Ana", None, None, "ventas@example.com"]],
    )

    res = client.post("/imports/preview", json=payload(content))
    assert res.status_code == 200, res.text
    preview = res.json()
    assert preview["can_confirm"] is True
    assert preview["new_categories"] == [category]
    assert all(r["status"] == "new" for s in preview["sheets"] for r in s["rows"])
    assert session.scalar(select(Product).where(Product.internal_code == plain)) is None

    res = client.post("/imports/confirm", json=payload(content))
    assert res.status_code == 200, res.text
    summary = res.json()
    assert summary["products_created"] == 2
    assert summary["categories_created"] == 1
    assert summary["machines_created"] == 1
    assert summary["suppliers_created"] == 1
    assert summary["stock_rows"] == 3

    product = session.scalar(select(Product).where(Product.internal_code == plain))
    assert product.current_stock == Decimal("12")
    assert product.minimum_stock == Decimal("5")
    lot_product = session.scalar(select(Product).where(Product.internal_code == lots))
    assert lot_product.current_stock == Decimal("5.5")
    assert lot_product.requires_lot is True
    found = {lot.lot_number: lot for lot in session.scalars(select(Lot).where(Lot.product_id == lot_product.id))}
    assert found["L1"].remaining_quantity == Decimal("3")
    assert found["L1"].expiration_date == expiry
    assert found["L2"].remaining_quantity == Decimal("2.5")
    assert session.get(Category, product.category_id).name == category

    # El stock entró como una entrada autorizada, a nombre de quien importó
    movement = session.get(Movement, summary["movement_id"])
    assert movement.type == "ENTRY"
    assert movement.status == "authorized"
    assert movement.reason == INITIAL_LOAD_REASON
    assert movement.requesting_user_id == movement.authorizing_user_id == users["Coordinator"].id
    assert len(movement.details) == 3

    assert session.scalar(select(Supplier).where(Supplier.company_name == "Proveedor importado")) is not None


def test_new_product_without_stock_gets_its_alert(client, session, unit, code):
    item = code("A")
    content = xlsx(products=[[item, "Sin stock", "Repuestos", unit.name, None, None, None, 2, None, None, None]])
    assert client.post("/imports/confirm", json=payload(content)).status_code == 200
    product = session.scalar(select(Product).where(Product.internal_code == item))
    assert product.current_stock == 0
    assert session.scalar(select(Alert).where(Alert.product_id == product.id, Alert.status == "active"))


# ============================================================
# ERRORES POR FILA: no se guarda nada
# ============================================================

def test_row_errors_block_the_whole_import(client, session, unit, code):
    good, lots, plain = code("G"), code("L"), code("N")
    content = xlsx(
        products=[
            [good, "Bueno", "Repuestos", unit.name, None, None, None, 1, None, None, "No"],
            [code("U"), "Unidad rara", "Repuestos", "unidad-inexistente", None, None, None, 1, None, None, None],
            [code("X"), "Máximo bajo", "Repuestos", unit.name, None, None, None, 10, 2, None, None],
            [good, "Repetido", "Repuestos", unit.name, None, None, None, 1, None, None, None],
            [code("B"), "Lotes raro", "Repuestos", unit.name, None, None, None, 1, None, None, "quizás"],
            [lots, "Con lotes", "Repuestos", unit.name, None, None, None, 1, None, None, "Sí"],
            [plain, "Sin lotes", "Repuestos", unit.name, None, None, None, 1, None, None, "No"],
            [None, "Sin código", "Repuestos", unit.name, None, None, None, 1, None, None, None],
        ],
        stock=[
            [code("NO-EXISTE"), 1, None, None],
            [lots, 2, None, None],
            [lots, 2, "L1", date.today() - timedelta(days=1)],
            [plain, 1, "L9", None],
            [good, 0, None, None],
            [good, "1.234", None, None],
        ],
    )
    preview = client.post("/imports/preview", json=payload(content)).json()
    assert preview["can_confirm"] is False

    product_messages = messages(preview, "products")
    assert any("unidad-inexistente" in m for m in product_messages)
    assert "Stock máximo: no puede ser menor que el mínimo." in product_messages
    assert any("repetido en el archivo (fila 2)" in m for m in product_messages)
    assert "Usa lotes: escribe Sí o No." in product_messages
    assert "Código: es obligatorio." in product_messages

    stock_messages = messages(preview, "stock")
    assert "Código: no está en la hoja Productos." in stock_messages
    assert "Lote: el producto usa lotes; indica el número de lote." in stock_messages
    assert any("ya está vencido" in m for m in stock_messages)
    assert "Lote: el producto no usa lotes; deja Lote y Vencimiento vacíos." in stock_messages
    assert "Cantidad: debe ser mayor que 0." in stock_messages
    assert "Cantidad: máximo 2 decimales." in stock_messages

    res = client.post("/imports/confirm", json=payload(content))
    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "import_has_errors"
    assert session.scalar(select(Product).where(Product.internal_code == good)) is None


def test_stock_for_an_existing_product_is_an_error(client, product):
    content = xlsx(stock=[[product.internal_code, 5, None, None]])
    preview = client.post("/imports/preview", json=payload(content)).json()
    assert any("se corrige con un ajuste" in m for m in messages(preview, "stock"))


# ============================================================
# REGISTROS QUE YA EXISTEN: el usuario decide
# ============================================================

def test_existing_product_is_a_warning_and_the_user_decides(client, session, product, unit):
    category = session.get(Category, product.category_id).name
    row = [product.internal_code, "Nombre nuevo", category, unit.name, None, None, None, 4, None, None, "No"]
    content = xlsx(products=[row])

    preview = client.post("/imports/preview", json=payload(content)).json()
    assert preview["can_confirm"] is True
    [result] = rows_of(preview, "products")
    assert result["status"] == "existing"
    assert result["changes"]["name"] == ["Producto de flujo", "Nombre nuevo"]
    assert result["changes"]["minimum_stock"] == ["3.00", "4.00"]

    # Sin elegirla, se deja como está
    summary = client.post("/imports/confirm", json=payload(content)).json()
    assert summary["skipped"] == 1
    session.refresh(product)
    assert product.name == "Producto de flujo"

    # Elegida, se actualiza (el stock no cambia)
    summary = client.post(
        "/imports/confirm", json=payload(content, update_rows={"products": [result["row"]]})
    ).json()
    assert summary["products_updated"] == 1
    session.refresh(product)
    assert product.name == "Nombre nuevo"
    assert product.minimum_stock == Decimal("4")
    assert product.current_stock == Decimal("10")


def test_existing_supplier_and_machine_by_code(client, session):
    ruc = str(uuid.uuid4().int)[:13]
    supplier = Supplier(company_name="Antes S.A.", ruc=ruc)
    machine = Machine(name="Molino viejo", identification_code=f"MQ-{ruc[:6]}")
    session.add_all([supplier, machine])
    session.commit()

    content = xlsx(
        suppliers=[["Después S.A.", ruc, None, None, None, None]],
        machines=[[machine.identification_code, "Molino nuevo", None]],
    )
    preview = client.post("/imports/preview", json=payload(content)).json()
    assert rows_of(preview, "suppliers")[0]["status"] == "existing"
    assert rows_of(preview, "machines")[0]["status"] == "existing"

    summary = client.post(
        "/imports/confirm",
        json=payload(content, update_rows={"suppliers": [2], "machines": [2]}),
    ).json()
    assert summary["suppliers_updated"] == 1
    assert summary["machines_updated"] == 1
    session.refresh(supplier)
    session.refresh(machine)
    assert supplier.company_name == "Después S.A."
    assert machine.name == "Molino nuevo"


# ============================================================
# CSV Y MÓDULOS
# ============================================================

def test_csv_with_semicolons_comma_decimals_and_latin1(client, session, unit, code):
    item = code("CSV")
    text = (
        "Código;Nombre;Categoría;Unidad;Stock mínimo;Usa lotes\n"
        f"{item};Válvula;Repuestos;{unit.name};1,5;no\n"
    )
    res = client.post("/imports/confirm", json=payload(text.encode("latin-1"), filename="productos.csv"))
    assert res.status_code == 200, res.text
    product = session.scalar(select(Product).where(Product.internal_code == item))
    assert product.name == "Válvula"
    assert product.minimum_stock == Decimal("1.5")


def test_disabled_module_sheet_is_an_error(client, session):
    from app.models.company_settings import CompanySettings

    session.get(CompanySettings, 1).module_suppliers = False
    session.commit()
    content = xlsx(suppliers=[["Proveedor", None, None, None, None, None]])
    preview = client.post("/imports/preview", json=payload(content)).json()
    assert preview["can_confirm"] is False
    sheet = next(s for s in preview["sheets"] if s["kind"] == "suppliers")
    assert "desactivado" in sheet["error"]


# ============================================================
# CONVERSIÓN DE NÚMEROS
# ============================================================

@pytest.mark.parametrize(
    ("value", "expected"),
    [(3, "3.00"), (2.3000000000000003, "2.30"), ("1,5", "1.50"), ("10.25", "10.25"), (None, None)],
)
def test_decimal_conversion(value, expected):
    result = as_decimal(value, "Cantidad")
    assert (str(result) if result is not None else None) == expected
