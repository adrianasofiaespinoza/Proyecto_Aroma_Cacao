"""Importar el inventario desde Excel (.xlsx) o CSV (Sprint 5).

Flujo: el Coordinator sube el archivo, ve la vista previa con los errores por fila
y confirma. La vista previa no guarda nada. La confirmación vuelve a validar el
mismo archivo y lo carga todo en una sola transacción, o nada.

Decisiones de la usuaria (2026-11-25):
- Se aceptan .xlsx (una hoja por tipo de dato) y .csv (un tipo por archivo).
- El stock inicial entra como una ENTRADA autorizada «Carga inicial», a nombre de
  quien importa, con las mismas reglas que una autorización normal.
- Los lotes van en la hoja de stock: una fila por lote, con su vencimiento.
- Si un producto, proveedor o máquina ya existe, la vista previa lo advierte y el
  usuario decide, fila por fila, si se actualiza o se deja como está.

Los mensajes de cada fila se devuelven en español porque son un informe para la
persona que carga el archivo, no errores de la API.
"""

import csv
import io
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException, status
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.lot import Lot
from app.models.machine import Machine
from app.models.movement import Movement, MovementDetail
from app.models.product import Category, Product, UnitOfMeasure
from app.models.supplier import Supplier
from app.models.user import User
from app.routers.movements import apply_authorization
from app.schemas.machine import MachineCreate
from app.schemas.product import ProductCreate
from app.schemas.supplier import SupplierCreate
from app.services.alerts import update_stock_alerts
from app.services.company import is_module_enabled

MAX_FILE_BYTES = 2 * 1024 * 1024
MAX_ROWS = 5000
INITIAL_LOAD_REASON = "Carga inicial (importación)"
MAX_CATEGORY_LENGTH = 50


class ImportFileError(Exception):
    """El archivo no se puede leer: formato, tamaño u hojas. Mensaje en español."""


# ============================================================
# COLUMNAS DE CADA HOJA
# ============================================================

@dataclass(frozen=True)
class Column:
    key: str
    header: str
    required: bool = False
    help: str = ""


@dataclass(frozen=True)
class SheetSpec:
    kind: str
    title: str
    columns: tuple[Column, ...]
    module: str | None = None

    def headers(self) -> list[str]:
        return [c.header for c in self.columns]


SHEETS: tuple[SheetSpec, ...] = (
    SheetSpec(
        "products",
        "Productos",
        (
            Column("codigo", "Código", True, "Código interno único, hasta 30 caracteres."),
            Column("nombre", "Nombre", True, "Hasta 100 caracteres."),
            Column("categoria", "Categoría", True, "Si no existe, se crea."),
            Column("unidad", "Unidad", True, "Nombre o abreviatura de una unidad existente (por ejemplo, Unidad o u)."),
            Column("marca", "Marca"),
            Column("modelo", "Modelo"),
            Column("numero_de_parte", "Número de parte"),
            Column("stock_minimo", "Stock mínimo", False, "Número, 0 si se deja vacío."),
            Column("stock_maximo", "Stock máximo", False, "Opcional. No puede ser menor que el mínimo."),
            Column("ubicacion", "Ubicación"),
            Column("usa_lotes", "Usa lotes", False, "Sí o No (No si se deja vacío)."),
        ),
    ),
    SheetSpec(
        "stock",
        "Stock inicial",
        (
            Column("codigo", "Código", True, "Código de un producto nuevo de la hoja Productos."),
            Column("cantidad", "Cantidad", True, "Mayor que 0, hasta 2 decimales."),
            Column("lote", "Lote", False, "Solo para productos con lotes: una fila por lote."),
            Column("vencimiento", "Vencimiento", False, "Fecha del lote (AAAA-MM-DD o DD/MM/AAAA). No puede estar vencido."),
        ),
    ),
    SheetSpec(
        "machines",
        "Máquinas",
        (
            Column("codigo", "Código", True, "Código de identificación único."),
            Column("nombre", "Nombre", True),
            Column("ubicacion", "Ubicación"),
        ),
        module="machines",
    ),
    SheetSpec(
        "suppliers",
        "Proveedores",
        (
            Column("razon_social", "Razón social", True),
            Column("ruc", "RUC", False, "Solo dígitos. Si se deja vacío, el proveedor se reconoce por su razón social."),
            Column("contacto", "Contacto"),
            Column("telefono", "Teléfono"),
            Column("direccion", "Dirección"),
            Column("correo", "Correo"),
        ),
        module="suppliers",
    ),
)

SPEC_BY_KIND = {spec.kind: spec for spec in SHEETS}


def normalize(text: object) -> str:
    """'Número de parte' -> 'numero_de_parte'."""
    raw = unicodedata.normalize("NFKD", str(text or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", raw.lower()).strip("_")


SHEET_NAMES = {normalize(spec.title): spec.kind for spec in SHEETS} | {
    "stock": "stock",
    "maquinas": "machines",
}


# ============================================================
# LECTURA DEL ARCHIVO
# ============================================================

@dataclass
class RawSheet:
    kind: str
    # (número de fila en el archivo, {clave de columna: valor})
    rows: list[tuple[int, dict[str, object]]] = field(default_factory=list)
    unknown_columns: list[str] = field(default_factory=list)


def _cell_text(value: object) -> object:
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _read_table(kind: str, header: list[object], body, first_row: int) -> RawSheet:
    spec = SPEC_BY_KIND[kind]
    known = {c.key for c in spec.columns}
    keys = [normalize(h) for h in header]
    sheet = RawSheet(kind)
    sheet.unknown_columns = [str(h) for h, k in zip(header, keys) if k and k not in known]
    missing = [c.header for c in spec.columns if c.required and c.key not in keys]
    if missing:
        raise ImportFileError(
            f"A la hoja «{spec.title}» le faltan las columnas: {', '.join(missing)}."
        )
    for offset, values in enumerate(body):
        row = {k: _cell_text(v) for k, v in zip(keys, values) if k in known}
        if all(v is None for v in row.values()):
            continue
        sheet.rows.append((first_row + offset, row))
    return sheet


def _detect_csv_kind(keys: set[str]) -> str:
    if "razon_social" in keys:
        return "suppliers"
    if "cantidad" in keys:
        return "stock"
    if "categoria" in keys or "unidad" in keys:
        return "products"
    if {"codigo", "nombre"} <= keys:
        return "machines"
    raise ImportFileError(
        "No se reconoce el tipo de datos del CSV: revisa los encabezados con la plantilla."
    )


def read_file(filename: str, content: bytes) -> list[RawSheet]:
    if len(content) > MAX_FILE_BYTES:
        raise ImportFileError(f"El archivo supera el máximo de {MAX_FILE_BYTES // (1024 * 1024)} MB.")
    name = filename.lower()
    if name.endswith(".xlsx"):
        sheets = _read_xlsx(content)
    elif name.endswith(".csv"):
        sheets = _read_csv(content)
    else:
        raise ImportFileError("Solo se aceptan archivos .xlsx o .csv.")
    if not any(s.rows for s in sheets):
        raise ImportFileError("El archivo no tiene filas con datos.")
    if sum(len(s.rows) for s in sheets) > MAX_ROWS:
        raise ImportFileError(f"El archivo supera el máximo de {MAX_ROWS} filas.")
    return sheets


def _read_xlsx(content: bytes) -> list[RawSheet]:
    try:
        workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    except Exception as exc:
        raise ImportFileError("No se pudo abrir el Excel: guárdalo de nuevo como .xlsx.") from exc
    sheets: list[RawSheet] = []
    try:
        for worksheet in workbook.worksheets:
            kind = SHEET_NAMES.get(normalize(worksheet.title))
            if kind is None:
                continue  # Instrucciones u hojas propias del cliente
            rows = worksheet.iter_rows(values_only=True)
            header = next(rows, None)
            if not header:
                continue
            body = (r for _, r in zip(range(MAX_ROWS + 1), rows))
            sheets.append(_read_table(kind, list(header), body, first_row=2))
    finally:
        workbook.close()
    if not sheets:
        raise ImportFileError(
            "El Excel no tiene ninguna hoja reconocida: Productos, Stock inicial, Máquinas o Proveedores."
        )
    return sheets


def _read_csv(content: bytes) -> list[RawSheet]:
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")
    try:
        dialect = csv.Sniffer().sniff(text[:4096], delimiters=",;\t")
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    header = next(reader, None)
    if not header:
        raise ImportFileError("El CSV está vacío.")
    kind = _detect_csv_kind({normalize(h) for h in header})
    body = (r for _, r in zip(range(MAX_ROWS + 1), reader))
    return [_read_table(kind, header, body, first_row=2)]


# ============================================================
# CONVERSIÓN DE VALORES
# ============================================================

class CellError(ValueError):
    pass


def as_text(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        value = int(value)  # Excel guarda 1001 como 1001.0
    if isinstance(value, (datetime, date)):
        value = value.strftime("%Y-%m-%d")
    text = str(value).strip()
    return text or None


def as_decimal(value: object, label: str) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, bool):
        raise CellError(f"{label}: no es un número.")
    text = str(value).strip().replace(" ", "")
    if "," in text and "." not in text:
        text = text.replace(",", ".")  # 3,5 -> 3.5
    try:
        number = Decimal(text)
    except InvalidOperation:
        raise CellError(f"{label}: «{value}» no es un número.") from None
    if not number.is_finite():
        raise CellError(f"{label}: «{value}» no es un número.")
    if isinstance(value, float) and abs(number - number.quantize(Decimal("0.01"))) < Decimal("0.000001"):
        number = number.quantize(Decimal("0.01"))  # 2.3000000000000003 que guarda Excel
    if number != number.quantize(Decimal("0.01")):
        raise CellError(f"{label}: máximo 2 decimales.")
    if number < 0:
        raise CellError(f"{label}: no puede ser negativo.")
    if number >= Decimal("100000000"):
        raise CellError(f"{label}: el número es demasiado grande.")
    return number.quantize(Decimal("0.01"))


YES = {"si", "s", "x", "true", "1", "yes", "verdadero"}
NO = {"no", "n", "false", "0", "falso"}


def as_bool(value: object, label: str) -> bool:
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    key = normalize(as_text(value))
    if key in YES:
        return True
    if key in NO:
        return False
    raise CellError(f"{label}: escribe Sí o No.")


def as_date(value: object, label: str) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            pass
    raise CellError(f"{label}: «{value}» no es una fecha (usa AAAA-MM-DD o DD/MM/AAAA).")


PYDANTIC_MESSAGES = {
    "missing": "es obligatorio",
    "string_too_short": "es obligatorio",
    "string_too_long": "máximo {max_length} caracteres",
    "string_pattern_mismatch": "solo dígitos",
    "value_error": "no es válido",
}


def pydantic_messages(exc: ValidationError, labels: dict[str, str]) -> list[str]:
    messages = []
    for error in exc.errors():
        field_name = str(error["loc"][0]) if error["loc"] else ""
        template = PYDANTIC_MESSAGES.get(error["type"], "no es válido")
        text = template.format(**(error.get("ctx") or {}))
        messages.append(f"{labels.get(field_name, field_name)}: {text}.")
    return messages


# ============================================================
# VISTA PREVIA
# ============================================================

@dataclass
class RowResult:
    row: int
    key: str | None
    status: str = "new"  # new | existing | error
    messages: list[str] = field(default_factory=list)
    changes: dict[str, list[str | None]] = field(default_factory=dict)
    values: dict[str, object] = field(default_factory=dict)
    # Datos ya validados para la carga (no se devuelven al cliente)
    data: dict = field(default_factory=dict, repr=False)

    def fail(self, message: str) -> None:
        self.status = "error"
        self.messages.append(message)

    def public(self) -> dict:
        return {
            "row": self.row,
            "key": self.key,
            "status": self.status,
            "messages": self.messages,
            "changes": self.changes,
            "values": {k: _public_value(v) for k, v in self.values.items()},
        }


def _public_value(value: object) -> object:
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, date):
        return value.isoformat()
    return value


@dataclass
class Preview:
    sheets: dict[str, list[RowResult]] = field(default_factory=dict)
    sheet_errors: dict[str, str] = field(default_factory=dict)
    unknown_columns: dict[str, list[str]] = field(default_factory=dict)
    new_categories: list[str] = field(default_factory=list)

    @property
    def has_errors(self) -> bool:
        return bool(self.sheet_errors) or any(
            r.status == "error" for rows in self.sheets.values() for r in rows
        )

    def public(self) -> dict:
        def count(kind: str, status: str) -> int:
            return sum(1 for r in self.sheets.get(kind, []) if r.status == status)

        sheets = []
        for spec in SHEETS:
            if spec.kind not in self.sheets and spec.kind not in self.sheet_errors:
                continue
            rows = self.sheets.get(spec.kind, [])
            sheets.append({
                "kind": spec.kind,
                "title": spec.title,
                "columns": [{"key": c.key, "header": c.header} for c in spec.columns],
                "error": self.sheet_errors.get(spec.kind),
                "unknown_columns": self.unknown_columns.get(spec.kind, []),
                "rows": [r.public() for r in rows],
                "counts": {s: count(spec.kind, s) for s in ("new", "existing", "error")},
            })
        return {
            "sheets": sheets,
            "new_categories": self.new_categories,
            "can_confirm": not self.has_errors,
        }


def _diff(current: dict[str, object], incoming: dict[str, object]) -> dict[str, list[str | None]]:
    changes = {}
    for key, new in incoming.items():
        old = current.get(key)
        if _public_value(old) != _public_value(new):
            changes[key] = [_public_value(old), _public_value(new)]
    return changes


def build_preview(db: Session, sheets: list[RawSheet]) -> Preview:
    preview = Preview()
    by_kind: dict[str, RawSheet] = {}
    for sheet in sheets:
        if sheet.kind in by_kind:
            preview.sheet_errors[sheet.kind] = (
                f"La hoja «{SPEC_BY_KIND[sheet.kind].title}» aparece dos veces."
            )
            continue
        by_kind[sheet.kind] = sheet
        if sheet.unknown_columns:
            preview.unknown_columns[sheet.kind] = sheet.unknown_columns

    for kind, sheet in by_kind.items():
        module = SPEC_BY_KIND[kind].module
        if module and sheet.rows and not is_module_enabled(db, module):
            preview.sheet_errors[kind] = (
                f"El módulo de {SPEC_BY_KIND[kind].title.lower()} está desactivado en esta instalación."
            )

    if "products" in by_kind:
        preview.sheets["products"] = _preview_products(db, by_kind["products"], preview)
    if "stock" in by_kind:
        preview.sheets["stock"] = _preview_stock(db, by_kind["stock"], preview.sheets.get("products", []))
    if "machines" in by_kind and "machines" not in preview.sheet_errors:
        preview.sheets["machines"] = _preview_machines(db, by_kind["machines"])
    if "suppliers" in by_kind and "suppliers" not in preview.sheet_errors:
        preview.sheets["suppliers"] = _preview_suppliers(db, by_kind["suppliers"])
    return preview


PRODUCT_LABELS = {
    "internal_code": "Código",
    "name": "Nombre",
    "brand": "Marca",
    "model": "Modelo",
    "part_number": "Número de parte",
    "minimum_stock": "Stock mínimo",
    "maximum_stock": "Stock máximo",
    "physical_location": "Ubicación",
}


def _preview_products(db: Session, sheet: RawSheet, preview: Preview) -> list[RowResult]:
    categories = {c.name.lower(): c for c in db.scalars(select(Category))}
    units: dict[str, UnitOfMeasure] = {}
    for unit in db.scalars(select(UnitOfMeasure)):
        units.setdefault(unit.name.lower(), unit)
        units.setdefault(unit.abbreviation.lower(), unit)
    new_categories: dict[str, str] = {}
    seen: dict[str, int] = {}
    results = []

    for row_number, row in sheet.rows:
        code = as_text(row.get("codigo"))
        result = RowResult(row_number, code)
        results.append(result)
        try:
            minimum = as_decimal(row.get("stock_minimo"), "Stock mínimo") or Decimal("0")
        except CellError as exc:
            result.fail(str(exc))
            minimum = Decimal("0")
        try:
            maximum = as_decimal(row.get("stock_maximo"), "Stock máximo")
        except CellError as exc:
            result.fail(str(exc))
            maximum = None
        try:
            requires_lot = as_bool(row.get("usa_lotes"), "Usa lotes")
        except CellError as exc:
            result.fail(str(exc))
            requires_lot = False

        category_name = as_text(row.get("categoria"))
        category_id = None
        if not category_name:
            result.fail("Categoría: es obligatoria.")
        elif len(category_name) > MAX_CATEGORY_LENGTH:
            result.fail(f"Categoría: máximo {MAX_CATEGORY_LENGTH} caracteres.")
        elif category_name.lower() in categories:
            category = categories[category_name.lower()]
            category_id, category_name = category.id, category.name
        else:
            category_name = new_categories.setdefault(category_name.lower(), category_name)

        unit_name = as_text(row.get("unidad"))
        unit = units.get(unit_name.lower()) if unit_name else None
        if not unit_name:
            result.fail("Unidad: es obligatoria.")
        elif unit is None:
            result.fail(f"Unidad: «{unit_name}» no existe; créala antes en Catálogos o usa una existente.")

        fields = {
            "internal_code": code or "",
            "name": as_text(row.get("nombre")) or "",
            "brand": as_text(row.get("marca")),
            "model": as_text(row.get("modelo")),
            "part_number": as_text(row.get("numero_de_parte")),
            "minimum_stock": minimum,
            "maximum_stock": maximum,
            "physical_location": as_text(row.get("ubicacion")),
        }
        try:
            ProductCreate(**fields, requires_lot=requires_lot, category_id=0, unit_of_measure_id=0)
        except ValidationError as exc:
            for message in pydantic_messages(exc, PRODUCT_LABELS):
                result.fail(message)
        if maximum is not None and maximum < minimum:
            result.fail("Stock máximo: no puede ser menor que el mínimo.")

        if code:
            if code.lower() in seen:
                result.fail(f"Código: repetido en el archivo (fila {seen[code.lower()]}).")
            else:
                seen[code.lower()] = row_number

        result.values = {
            **fields,
            "category": category_name,
            "unit": unit.name if unit else unit_name,
            "requires_lot": requires_lot,
        }
        result.data = {
            "fields": fields,
            "requires_lot": requires_lot,
            "category_id": category_id,
            "category_name": category_name,
            "unit_id": unit.id if unit else None,
        }

        existing = db.scalar(select(Product).where(func.lower(Product.internal_code) == (code or "").lower())) if code else None
        if existing is not None:
            result.data["product_id"] = existing.id
            current = {k: getattr(existing, k) for k in fields} | {
                "category": db.get(Category, existing.category_id).name,
                "unit": db.get(UnitOfMeasure, existing.unit_of_measure_id).name,
                "requires_lot": existing.requires_lot,
            }
            result.changes = _diff(current, {k: v for k, v in result.values.items()})
            if existing.status != "active":
                result.fail("El producto existe pero está desactivado: reactívalo antes desde Productos.")
            elif requires_lot != existing.requires_lot and existing.current_stock != 0:
                result.fail("Usa lotes: solo se puede cambiar si el producto tiene stock 0.")
            if result.status != "error":
                result.status = "existing"
                result.messages.append("Ya existe un producto con este código.")

    preview.new_categories = sorted(new_categories.values(), key=str.lower)
    return results


def _preview_stock(db: Session, sheet: RawSheet, products: list[RowResult]) -> list[RowResult]:
    by_code = {r.key.lower(): r for r in products if r.key}
    seen_plain: dict[str, int] = {}
    seen_lots: dict[tuple[str, str], int] = {}
    results = []

    for row_number, row in sheet.rows:
        code = as_text(row.get("codigo"))
        result = RowResult(row_number, code)
        results.append(result)
        try:
            quantity = as_decimal(row.get("cantidad"), "Cantidad")
            if quantity is None or quantity <= 0:
                result.fail("Cantidad: debe ser mayor que 0.")
        except CellError as exc:
            result.fail(str(exc))
            quantity = None
        lot_number = as_text(row.get("lote"))
        try:
            expiration = as_date(row.get("vencimiento"), "Vencimiento")
        except CellError as exc:
            result.fail(str(exc))
            expiration = None
        result.values = {"codigo": code, "cantidad": quantity, "lote": lot_number, "vencimiento": expiration}

        product_row = by_code.get(code.lower()) if code else None
        if not code:
            result.fail("Código: es obligatorio.")
            continue
        if product_row is None:
            exists = db.scalar(select(Product.id).where(func.lower(Product.internal_code) == code.lower()))
            if exists:
                result.fail("El producto ya existe en el sistema: su stock se corrige con un ajuste, no con la importación.")
            else:
                result.fail("Código: no está en la hoja Productos.")
            continue
        if product_row.data.get("product_id"):
            result.fail("El producto ya existe en el sistema: su stock se corrige con un ajuste, no con la importación.")
            continue

        key = code.lower()
        if product_row.data["requires_lot"]:
            if not lot_number:
                result.fail("Lote: el producto usa lotes; indica el número de lote.")
            elif len(lot_number) > 30:
                result.fail("Lote: máximo 30 caracteres.")
            elif (key, lot_number.lower()) in seen_lots:
                result.fail(f"Lote: repetido en el archivo (fila {seen_lots[(key, lot_number.lower())]}).")
            else:
                seen_lots[(key, lot_number.lower())] = row_number
            if expiration is not None and expiration < date.today():
                result.fail("Vencimiento: el lote ya está vencido; no se puede cargar como entrada.")
        else:
            if lot_number or expiration:
                result.fail("Lote: el producto no usa lotes; deja Lote y Vencimiento vacíos.")
            if key in seen_plain:
                result.fail(f"Código: el producto ya tiene stock en la fila {seen_plain[key]}; usa una sola fila.")
            else:
                seen_plain[key] = row_number

        result.data = {"product_key": key, "quantity": quantity, "lot_number": lot_number, "expiration": expiration}
    return results


MACHINE_LABELS = {"identification_code": "Código", "name": "Nombre", "location": "Ubicación"}


def _preview_machines(db: Session, sheet: RawSheet) -> list[RowResult]:
    seen: dict[str, int] = {}
    results = []
    for row_number, row in sheet.rows:
        code = as_text(row.get("codigo"))
        result = RowResult(row_number, code)
        results.append(result)
        fields = {
            "identification_code": code or "",
            "name": as_text(row.get("nombre")) or "",
            "location": as_text(row.get("ubicacion")),
        }
        result.values = dict(fields)
        result.data = {"fields": fields}
        try:
            MachineCreate(**fields)
        except ValidationError as exc:
            for message in pydantic_messages(exc, MACHINE_LABELS):
                result.fail(message)
        if code:
            if code.lower() in seen:
                result.fail(f"Código: repetido en el archivo (fila {seen[code.lower()]}).")
            else:
                seen[code.lower()] = row_number
            existing = db.scalar(select(Machine).where(func.lower(Machine.identification_code) == code.lower()))
            if existing is not None:
                result.data["machine_id"] = existing.id
                result.changes = _diff({k: getattr(existing, k) for k in fields}, fields)
                if result.status != "error":
                    result.status = "existing"
                    result.messages.append("Ya existe una máquina con este código.")
    return results


SUPPLIER_LABELS = {
    "company_name": "Razón social",
    "ruc": "RUC",
    "contact_person": "Contacto",
    "phone": "Teléfono",
    "address": "Dirección",
    "email": "Correo",
}


def _preview_suppliers(db: Session, sheet: RawSheet) -> list[RowResult]:
    seen: dict[str, int] = {}
    results = []
    for row_number, row in sheet.rows:
        name = as_text(row.get("razon_social"))
        ruc = as_text(row.get("ruc"))
        result = RowResult(row_number, ruc or name)
        results.append(result)
        fields = {
            "company_name": name or "",
            "ruc": ruc,
            "contact_person": as_text(row.get("contacto")),
            "phone": as_text(row.get("telefono")),
            "address": as_text(row.get("direccion")),
            "email": as_text(row.get("correo")),
        }
        result.values = dict(fields)
        try:
            validated = SupplierCreate(**fields)
            fields["email"] = validated.email
        except ValidationError as exc:
            for message in pydantic_messages(exc, SUPPLIER_LABELS):
                result.fail(message)
        result.data = {"fields": fields}

        # Se reconoce por RUC; sin RUC, por la razón social
        key = f"ruc:{ruc}" if ruc else f"name:{(name or '').lower()}"
        if name or ruc:
            if key in seen:
                result.fail(f"Proveedor repetido en el archivo (fila {seen[key]}).")
            else:
                seen[key] = row_number
        if ruc:
            existing = db.scalar(select(Supplier).where(Supplier.ruc == ruc))
        elif name:
            existing = db.scalar(
                select(Supplier).where(func.lower(Supplier.company_name) == name.lower()).order_by(Supplier.id).limit(1)
            )
        else:
            existing = None
        if existing is not None:
            result.data["supplier_id"] = existing.id
            result.changes = _diff({k: getattr(existing, k) for k in fields}, fields)
            if result.status != "error":
                result.status = "existing"
                result.messages.append(
                    "Ya existe un proveedor con este RUC." if ruc else "Ya existe un proveedor con esta razón social."
                )
    return results


# ============================================================
# CARGA (una sola transacción; quien llama hace commit)
# ============================================================

def apply_import(db: Session, preview: Preview, update_rows: dict[str, set[int]], user: User) -> dict:
    """Carga lo validado. update_rows: filas «existing» que el usuario decidió actualizar.

    Lanza HTTPException (desde las reglas de autorización) si algo no cuadra;
    el router revierte la transacción.
    """
    summary = {
        "products_created": 0,
        "products_updated": 0,
        "machines_created": 0,
        "machines_updated": 0,
        "suppliers_created": 0,
        "suppliers_updated": 0,
        "categories_created": 0,
        "skipped": 0,
        "stock_rows": 0,
        "movement_id": None,
    }

    def chosen(kind: str, result: RowResult) -> bool:
        if result.status != "existing":
            return True
        if result.row in update_rows.get(kind, set()):
            return True
        summary["skipped"] += 1
        return False

    # Categorías nuevas
    category_ids: dict[str, int] = {}
    for name in preview.new_categories:
        category = Category(name=name)
        db.add(category)
        db.flush()
        category_ids[name.lower()] = category.id
        summary["categories_created"] += 1

    for result in preview.sheets.get("suppliers", []):
        if not chosen("suppliers", result):
            continue
        fields = result.data["fields"]
        if result.status == "existing":
            supplier = db.get(Supplier, result.data["supplier_id"])
            for key, value in fields.items():
                setattr(supplier, key, value)
            summary["suppliers_updated"] += 1
        else:
            db.add(Supplier(**fields))
            summary["suppliers_created"] += 1

    for result in preview.sheets.get("machines", []):
        if not chosen("machines", result):
            continue
        fields = result.data["fields"]
        if result.status == "existing":
            machine = db.get(Machine, result.data["machine_id"])
            for key, value in fields.items():
                setattr(machine, key, value)
            summary["machines_updated"] += 1
        else:
            db.add(Machine(**fields))
            summary["machines_created"] += 1

    new_products: dict[str, Product] = {}
    for result in preview.sheets.get("products", []):
        if not chosen("products", result):
            continue
        data = result.data
        category_id = data["category_id"] or category_ids[data["category_name"].lower()]
        if result.status == "existing":
            product = db.scalar(select(Product).where(Product.id == data["product_id"]).with_for_update())
            # La vista previa ya lo comprobó; se repite por si el stock cambió entre tanto
            if data["requires_lot"] != product.requires_lot and product.current_stock != 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Lot tracking can only change when the product has zero stock",
                )
            for key, value in data["fields"].items():
                setattr(product, key, value)
            product.requires_lot = data["requires_lot"]
            product.category_id = category_id
            product.unit_of_measure_id = data["unit_id"]
            update_stock_alerts(db, product)
            summary["products_updated"] += 1
        else:
            product = Product(
                **data["fields"],
                current_stock=Decimal("0"),
                status="active",
                requires_lot=data["requires_lot"],
                category_id=category_id,
                unit_of_measure_id=data["unit_id"],
            )
            db.add(product)
            new_products[data["fields"]["internal_code"].lower()] = product
            summary["products_created"] += 1
    db.flush()

    # Stock inicial: una ENTRADA autorizada con las reglas normales
    stock_rows = preview.sheets.get("stock", [])
    if stock_rows:
        movement = Movement(
            type="ENTRY",
            requesting_user_id=user.id,
            status="pending",
            reason=INITIAL_LOAD_REASON,
        )
        db.add(movement)
        db.flush()
        for result in stock_rows:
            data = result.data
            product = new_products[data["product_key"]]
            lot_id = None
            if product.requires_lot:
                lot = Lot(
                    product_id=product.id,
                    lot_number=data["lot_number"],
                    expiration_date=data["expiration"],
                    remaining_quantity=Decimal("0"),
                )
                db.add(lot)
                db.flush()
                lot_id = lot.id
            db.add(MovementDetail(
                movement_id=movement.id,
                product_id=product.id,
                quantity=data["quantity"],
                lot_id=lot_id,
            ))
        db.flush()
        db.expire(movement, ["details"])
        apply_authorization(db, movement, user)
        summary["stock_rows"] = len(stock_rows)
        summary["movement_id"] = movement.id

    # Productos nuevos sin stock: misma regla de alertas que al crearlos a mano
    for product in new_products.values():
        update_stock_alerts(db, product)

    return summary


# ============================================================
# PLANTILLA
# ============================================================

EXAMPLES = {
    "products": [
        ["REP-001", "Rodamiento 6204", "Repuestos", "Unidad", "SKF", "6204-2RS", "6204", 5, 20, "Estante A1", "No"],
        ["LUB-010", "Grasa grado alimenticio", "Lubricantes", "Unidad", "", "", "", 2, "", "Estante B2", "Sí"],
    ],
    "stock": [
        ["REP-001", 12, "", ""],
        ["LUB-010", 3, "L-2027-01", "2027-06-30"],
        ["LUB-010", 2, "L-2027-02", "2027-09-30"],
    ],
    "machines": [["MAQ-01", "Tostadora de cacao", "Planta"]],
    "suppliers": [["Repuestos Industriales S.A.", "0991234567001", "Ana Pérez", "0991234567", "Guayaquil", "ventas@ejemplo.com"]],
}


def build_template() -> bytes:
    workbook = Workbook()
    guide = workbook.active
    guide.title = "Instrucciones"
    bold = Font(bold=True)
    header_fill = PatternFill("solid", fgColor="DDDDDD")

    guide.append(["Plantilla de importación del inventario"])
    guide["A1"].font = Font(bold=True, size=14)
    guide.append([])
    for line in (
        "Llena las hojas que necesites; las demás pueden quedar vacías o borrarse.",
        "No cambies los nombres de las hojas ni de las columnas. Las columnas con * son obligatorias.",
        "Nada se guarda hasta que confirmes la vista previa, y se carga todo o nada.",
        "El stock inicial solo se carga para productos nuevos de la hoja Productos. Queda registrado como una entrada «Carga inicial».",
        "Si algo ya existe (mismo código o RUC), la vista previa te deja elegir si se actualiza.",
        "También puedes subir un CSV por tipo de dato, con los mismos encabezados.",
    ):
        guide.append([line])
    guide.append([])

    for spec in SHEETS:
        guide.append([spec.title])
        guide.cell(row=guide.max_row, column=1).font = bold
        for column in spec.columns:
            guide.append([column.header + (" *" if column.required else ""), column.help])
        guide.append(["Ejemplo:"])
        for example in EXAMPLES[spec.kind]:
            guide.append(["", *[str(v) for v in example]])
        guide.append([])
    guide.column_dimensions["A"].width = 22
    guide.column_dimensions["B"].width = 90

    for spec in SHEETS:
        sheet = workbook.create_sheet(spec.title)
        sheet.append([c.header for c in spec.columns])
        for index, column in enumerate(spec.columns, start=1):
            cell = sheet.cell(row=1, column=index)
            cell.font = bold
            cell.fill = header_fill
            sheet.column_dimensions[cell.column_letter].width = max(14, len(column.header) + 4)
        sheet.freeze_panes = "A2"

    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
