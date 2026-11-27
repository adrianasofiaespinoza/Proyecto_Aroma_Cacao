"""Exportar datos a Excel (.xlsx) o CSV (Sprint 5).

Decisiones de la usuaria (2026-11-25): se exportan el inventario completo y el
historial de movimientos, desde una sola pantalla, y puede hacerlo cualquier rol
(todos ya ven estos datos en pantalla).

- El inventario usa las mismas hojas y columnas que la plantilla de importación,
  así que el archivo se puede volver a importar en otra instalación.
- En CSV va un tipo de dato por archivo, igual que al importar.
- Las fechas se escriben en la zona horaria de quien exporta (la de su navegador),
  igual que en pantalla.
"""

import csv
import io
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.lot import Lot
from app.models.machine import Machine
from app.models.movement import Movement
from app.models.product import Category, Product, UnitOfMeasure
from app.models.supplier import Supplier
from app.services.company import get_settings, is_module_enabled
from app.services.importer import SPEC_BY_KIND

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
CSV_MEDIA_TYPE = "text/csv; charset=utf-8"

# Formato de fecha de la empresa -> formato de celda de Excel
EXCEL_DATE = {"dd/mm/aaaa": "dd/mm/yyyy", "mm/dd/aaaa": "mm/dd/yyyy", "aaaa-mm-dd": "yyyy-mm-dd"}

TYPE_LABELS = {"ENTRY": "Entrada", "EXIT": "Salida", "ADJUSTMENT": "Ajuste"}
STATUS_LABELS = {"pending": "Pendiente", "authorized": "Autorizado", "rejected": "Rechazado"}
PRODUCT_STATUS_LABELS = {"active": "Activo", "inactive": "Inactivo"}

# Columna extra en Productos: la importación la ignora (los productos se crean activos)
PRODUCT_STATUS_HEADER = "Estado"

MOVEMENT_HEADERS = [
    "N.º movimiento", "Fecha", "Tipo", "Estado", "Código", "Producto", "Cantidad", "Unidad",
    "Lote", "Máquina", "Orden de trabajo", "Motivo", "Solicitó", "Revisó",
]


class ExportError(ValueError):
    """Parámetros de exportación no válidos (mensaje en inglés, como el resto de la API)."""


def resolve_timezone(name: str | None) -> ZoneInfo:
    try:
        return ZoneInfo(name or "UTC")
    except (ZoneInfoNotFoundError, ValueError):
        raise ExportError("Unknown time zone") from None


def to_local(value: datetime, zone: ZoneInfo) -> datetime:
    """Las fechas se guardan en UTC sin zona; Excel no admite zona, se devuelve sin ella."""
    return value.replace(tzinfo=timezone.utc).astimezone(zone).replace(tzinfo=None)


# ============================================================
# TABLAS: (título de hoja, encabezados, filas)
# ============================================================

@dataclass
class Table:
    kind: str
    title: str
    headers: list[str]
    rows: list[list[object]]


def inventory_tables(db: Session) -> list[Table]:
    categories = {c.id: c.name for c in db.scalars(select(Category))}
    units = {u.id: u.name for u in db.scalars(select(UnitOfMeasure))}
    products = list(db.scalars(select(Product).order_by(Product.internal_code)))

    product_rows = [
        [
            p.internal_code, p.name, categories.get(p.category_id), units.get(p.unit_of_measure_id),
            p.brand, p.model, p.part_number, p.minimum_stock, p.maximum_stock, p.physical_location,
            "Sí" if p.requires_lot else "No", PRODUCT_STATUS_LABELS.get(p.status, p.status),
        ]
        for p in products
    ]

    # Stock: una fila por producto sin lotes y una por lote con cantidad
    lots_by_product: dict[int, list[Lot]] = {}
    for lot in db.scalars(select(Lot).where(Lot.remaining_quantity > 0).order_by(Lot.expiration_date, Lot.lot_number)):
        lots_by_product.setdefault(lot.product_id, []).append(lot)
    stock_rows: list[list[object]] = []
    for p in products:
        if p.requires_lot:
            for lot in lots_by_product.get(p.id, []):
                stock_rows.append([p.internal_code, lot.remaining_quantity, lot.lot_number, lot.expiration_date])
        elif p.current_stock > 0:
            stock_rows.append([p.internal_code, p.current_stock, None, None])

    tables = [
        Table("products", "Productos", SPEC_BY_KIND["products"].headers() + [PRODUCT_STATUS_HEADER], product_rows),
        Table("stock", "Stock inicial", SPEC_BY_KIND["stock"].headers(), stock_rows),
    ]
    if is_module_enabled(db, "machines"):
        machines = db.scalars(select(Machine).order_by(Machine.identification_code))
        tables.append(Table(
            "machines", "Máquinas", SPEC_BY_KIND["machines"].headers(),
            [[m.identification_code, m.name, m.location] for m in machines],
        ))
    if is_module_enabled(db, "suppliers"):
        suppliers = db.scalars(select(Supplier).order_by(Supplier.company_name))
        tables.append(Table(
            "suppliers", "Proveedores", SPEC_BY_KIND["suppliers"].headers(),
            [[s.company_name, s.ruc, s.contact_person, s.phone, s.address, s.email] for s in suppliers],
        ))
    return tables


def movement_table(
    db: Session,
    zone: ZoneInfo,
    date_from: date | None = None,
    date_to: date | None = None,
    movement_type: str | None = None,
    status: str | None = None,
) -> Table:
    if date_from and date_to and date_from > date_to:
        raise ExportError("date_from cannot be after date_to")

    stmt = select(Movement).order_by(Movement.date, Movement.id)
    # Los días se cuentan en la zona de quien exporta y se pasan a UTC para filtrar
    if date_from:
        start = datetime.combine(date_from, time.min, zone).astimezone(timezone.utc).replace(tzinfo=None)
        stmt = stmt.where(Movement.date >= start)
    if date_to:
        end = datetime.combine(date_to + timedelta(days=1), time.min, zone).astimezone(timezone.utc).replace(tzinfo=None)
        stmt = stmt.where(Movement.date < end)
    if movement_type:
        stmt = stmt.where(Movement.type == movement_type)
    if status:
        stmt = stmt.where(Movement.status == status)

    products = {p.id: p for p in db.scalars(select(Product))}
    units = {u.id: u.abbreviation for u in db.scalars(select(UnitOfMeasure))}
    lots = {lot.id: lot.lot_number for lot in db.scalars(select(Lot))}
    machines = {m.id: m.name for m in db.scalars(select(Machine))}

    rows: list[list[object]] = []
    for movement in db.scalars(stmt):
        for detail in movement.details:
            product = products.get(detail.product_id)
            rows.append([
                movement.id,
                to_local(movement.date, zone),
                TYPE_LABELS.get(movement.type, movement.type),
                STATUS_LABELS.get(movement.status, movement.status),
                product.internal_code if product else None,
                product.name if product else None,
                detail.quantity,
                units.get(product.unit_of_measure_id) if product else None,
                lots.get(detail.lot_id) if detail.lot_id else None,
                machines.get(detail.machine_id) if detail.machine_id else None,
                movement.work_order_number,
                movement.reason,
                movement.requesting_user_name,
                movement.authorizing_user_name,
            ])
    return Table("movements", "Movimientos", MOVEMENT_HEADERS, rows)


# ============================================================
# ESCRITURA
# ============================================================

FORMULA_START = ("=", "+", "-", "@", "\t", "\r")


def csv_safe(value: object) -> object:
    """Evita que Excel ejecute como fórmula un texto escrito por un usuario (inyección CSV)."""
    if isinstance(value, str) and value.startswith(FORMULA_START):
        return "'" + value
    return value


def _csv_value(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    return str(csv_safe(value))


def write_csv(table: Table) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(table.headers)
    for row in table.rows:
        writer.writerow([_csv_value(v) for v in row])
    # BOM: Excel abre el UTF-8 con tildes correctamente
    return ("﻿" + buffer.getvalue()).encode("utf-8")


def write_xlsx(db: Session, tables: list[Table], cover: list[str]) -> bytes:
    date_format = EXCEL_DATE.get(get_settings(db).date_format, "dd/mm/yyyy")
    workbook = Workbook()
    info = workbook.active
    info.title = "Exportación"
    info.append([cover[0]])
    info["A1"].font = Font(bold=True, size=14)
    for line in cover[1:]:
        info.append([line])
    info.column_dimensions["A"].width = 110

    bold = Font(bold=True)
    fill = PatternFill("solid", fgColor="DDDDDD")
    for table in tables:
        sheet = workbook.create_sheet(table.title)
        sheet.append(table.headers)
        for cell in sheet[1]:
            cell.font = bold
            cell.fill = fill
        for row in table.rows:
            sheet.append([v for v in row])
            for cell in sheet[sheet.max_row]:
                if isinstance(cell.value, str) and cell.data_type == "f":
                    cell.data_type = "s"  # texto que empieza con «=»: nunca una fórmula
                elif isinstance(cell.value, datetime):
                    cell.number_format = date_format + " hh:mm"
                elif isinstance(cell.value, date):
                    cell.number_format = date_format
        for index, header in enumerate(table.headers, start=1):
            longest = max([len(str(header))] + [len(str(r[index - 1] or "")) for r in table.rows[:200]])
            sheet.column_dimensions[sheet.cell(row=1, column=index).column_letter].width = min(max(12, longest + 2), 50)
        sheet.freeze_panes = "A2"

    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
