"""Exportar el inventario y los movimientos a Excel o CSV (Sprint 5).

Usa la transacción revertida de conftest: no deja datos en la BD.
"""

import base64
import csv
import io
import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
from openpyxl import load_workbook
from sqlalchemy import select

from app.models.company_settings import CompanySettings
from app.models.lot import Lot
from app.models.movement import Movement
from app.models.product import Category, Product, UnitOfMeasure


def workbook(res):
    assert res.status_code == 200, res.text
    return load_workbook(io.BytesIO(res.content))


def sheet_rows(sheet) -> list[list]:
    return [list(r) for r in sheet.iter_rows(values_only=True)]


def csv_rows(res) -> list[list[str]]:
    assert res.status_code == 200, res.text
    text = res.content.decode("utf-8")
    assert text.startswith("﻿")  # BOM para que Excel lea bien las tildes
    return list(csv.reader(io.StringIO(text[1:])))


@pytest.fixture
def lot_product(session):
    item = Product(
        internal_code=f"EXP-LOT-{uuid.uuid4().hex[:6]}",
        name="Grasa con lotes",
        current_stock=Decimal("5"),
        minimum_stock=Decimal("1"),
        status="active",
        requires_lot=True,
        category_id=session.scalar(select(Category.id)),
        unit_of_measure_id=session.scalar(select(UnitOfMeasure.id)),
    )
    session.add(item)
    session.flush()
    session.add_all([
        Lot(product_id=item.id, lot_number="L-A", expiration_date=date(2030, 1, 31), remaining_quantity=Decimal("3")),
        Lot(product_id=item.id, lot_number="L-B", expiration_date=None, remaining_quantity=Decimal("2")),
        Lot(product_id=item.id, lot_number="L-VACIO", expiration_date=None, remaining_quantity=Decimal("0")),
    ])
    session.commit()
    return item


# ============================================================
# INVENTARIO
# ============================================================

def test_inventory_xlsx_has_the_import_sheets(client, product, lot_product):
    wb = workbook(client.get("/exports/inventory?format=xlsx&tz=America/Guayaquil"))
    assert wb.sheetnames == ["Exportación", "Productos", "Stock inicial", "Máquinas", "Proveedores"]

    products = sheet_rows(wb["Productos"])
    assert products[0][-1] == "Estado"
    row = next(r for r in products if r[0] == product.internal_code)
    assert row[1] == "Producto de flujo"
    assert row[-2:] == ["No", "Activo"]

    stock = sheet_rows(wb["Stock inicial"])
    assert [product.internal_code, 10, None, None] in stock
    lots = [r for r in stock if r[0] == lot_product.internal_code]
    # Solo los lotes con cantidad, con su vencimiento como fecha
    assert [r[2] for r in lots] == ["L-A", "L-B"]
    assert lots[0][1] == 3 and lots[0][3] == datetime(2030, 1, 31)


def test_exported_inventory_can_be_imported_again(client, product):
    """El archivo exportado tiene el formato de la plantilla: al importarlo, los productos aparecen como «Ya existe» sin cambios."""
    content = client.get("/exports/inventory?format=xlsx").content
    preview = client.post(
        "/imports/preview",
        json={"filename": "inventario.xlsx", "data_base64": base64.b64encode(content).decode()},
    ).json()
    products = next(s for s in preview["sheets"] if s["kind"] == "products")
    assert products["unknown_columns"] == ["Estado"]
    row = next(r for r in products["rows"] if r["key"] == product.internal_code)
    assert row["status"] == "existing"
    assert row["changes"] == {}


def test_inventory_csv_needs_a_kind_and_respects_modules(client, session, product):
    assert client.get("/exports/inventory?format=csv").status_code == 400

    rows = csv_rows(client.get("/exports/inventory?format=csv&kind=products"))
    assert rows[0][:2] == ["Código", "Nombre"]
    assert any(r[0] == product.internal_code for r in rows)

    session.get(CompanySettings, 1).module_suppliers = False
    session.commit()
    res = client.get("/exports/inventory?format=csv&kind=suppliers")
    assert res.status_code == 403
    assert "disabled" in res.json()["detail"]
    wb = workbook(client.get("/exports/inventory?format=xlsx"))
    assert "Proveedores" not in wb.sheetnames


def test_text_that_looks_like_a_formula_is_never_a_formula(client, session, product):
    product.name = '=HYPERLINK("http://example.com","clic")'
    session.commit()

    wb = workbook(client.get("/exports/inventory?format=xlsx"))
    cell = next(r for r in wb["Productos"].iter_rows() if r[0].value == product.internal_code)[1]
    assert cell.data_type == "s"
    assert cell.value == product.name

    rows = csv_rows(client.get("/exports/inventory?format=csv&kind=products"))
    row = next(r for r in rows if r[0] == product.internal_code)
    assert row[1] == "'" + product.name


@pytest.mark.parametrize("role", ["Operator", "Read-only"])
def test_every_company_role_can_export(client, role):
    client.act_as(role)
    assert client.get("/exports/inventory").status_code == 200
    assert client.get("/exports/movements").status_code == 200


def test_support_cannot_export_warehouse_data(client):
    client.act_as("Support")
    assert client.get("/exports/inventory").status_code == 403
    assert client.get("/exports/movements").status_code == 403


# ============================================================
# MOVIMIENTOS
# ============================================================

@pytest.fixture
def exit_movement(client, session, product):
    res = client.post(
        "/movements",
        json={"type": "EXIT", "reason": "Cambio de rodamiento", "work_order_number": "OT-77",
              "details": [{"product_id": product.id, "quantity": "2"}]},
    )
    movement = session.get(Movement, res.json()["id"])
    # 2026-03-10 03:30 UTC = 2026-03-09 22:30 en Ecuador (UTC-5)
    movement.date = datetime(2026, 3, 10, 3, 30)
    session.commit()
    client.patch(f"/movements/{movement.id}/authorize")
    return movement


def test_movements_xlsx_one_row_per_detail_in_local_time(client, exit_movement, product, users):
    wb = workbook(client.get("/exports/movements?tz=America/Guayaquil&date_from=2026-03-09&date_to=2026-03-09"))
    rows = sheet_rows(wb["Movimientos"])
    assert rows[0][:4] == ["N.º movimiento", "Fecha", "Tipo", "Estado"]
    row = next(r for r in rows[1:] if r[0] == exit_movement.id)
    assert row[1] == datetime(2026, 3, 9, 22, 30)
    assert row[2:6] == ["Salida", "Autorizado", product.internal_code, "Producto de flujo"]
    assert row[6] == 2
    assert row[10:] == ["OT-77", "Cambio de rodamiento", users["Coordinator"].full_name, users["Coordinator"].full_name]
    assert wb["Movimientos"]["B2"].number_format == "dd/mm/yyyy hh:mm"


def test_movement_filters_use_the_exporting_time_zone(client, exit_movement):
    def ids(query: str) -> set[int]:
        rows = csv_rows(client.get(f"/exports/movements?format=csv&{query}"))
        return {int(r[0]) for r in rows[1:]}

    # En Ecuador fue el 9 de marzo; en UTC, el 10
    assert exit_movement.id in ids("tz=America/Guayaquil&date_from=2026-03-09&date_to=2026-03-09")
    assert exit_movement.id not in ids("tz=America/Guayaquil&date_from=2026-03-10&date_to=2026-03-10")
    assert exit_movement.id in ids("tz=UTC&date_from=2026-03-10&date_to=2026-03-10")
    assert exit_movement.id in ids("type_filter=EXIT&status_filter=authorized")
    assert exit_movement.id not in ids("type_filter=ENTRY")


def test_movement_export_rejects_bad_parameters(client):
    assert client.get("/exports/movements?tz=Marte/Base").status_code == 400
    res = client.get(f"/exports/movements?date_from={date.today()}&date_to={date.today() - timedelta(days=1)}")
    assert res.status_code == 400
    assert client.get("/exports/movements?format=pdf").status_code == 422
