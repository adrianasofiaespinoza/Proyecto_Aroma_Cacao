"""Exportar el inventario y el historial de movimientos a Excel o CSV.

Cualquier rol con sesión puede exportar: son los mismos datos que ya ve en pantalla.
"""

from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.security.auth import get_company_user
from app.services.company import MODULES, get_settings, is_module_enabled
from app.services.exporter import (
    CSV_MEDIA_TYPE,
    STATUS_LABELS,
    TYPE_LABELS,
    XLSX_MEDIA_TYPE,
    ExportError,
    inventory_tables,
    movement_table,
    resolve_timezone,
    to_local,
    write_csv,
    write_xlsx,
)

router = APIRouter(prefix="/exports", tags=["Exports"])

InventoryKind = Literal["products", "stock", "machines", "suppliers"]
FILE_SUFFIX = {"products": "productos", "stock": "stock", "machines": "maquinas", "suppliers": "proveedores"}
MODULE_OF_KIND = {"machines": "machines", "suppliers": "suppliers"}


def _file(content: bytes, media_type: str, filename: str) -> Response:
    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            # El frontend lee el nombre del archivo de este encabezado
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


def _bad_request(exc: ExportError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _cover(db: Session, title: str, user: User, zone, extra: list[str]) -> list[str]:
    exported = to_local(datetime.now(timezone.utc).replace(tzinfo=None), zone)
    return [
        title,
        f"Empresa: {get_settings(db).name}",
        f"Exportado por {user.full_name} el {exported:%Y-%m-%d %H:%M} ({zone.key}).",
        *extra,
    ]


@router.get("/inventory", summary="Export the whole inventory (.xlsx) or one kind of data (.csv)")
def export_inventory(
    format: Literal["xlsx", "csv"] = "xlsx",
    kind: InventoryKind | None = None,
    tz: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_company_user),
):
    try:
        zone = resolve_timezone(tz)
    except ExportError as exc:
        raise _bad_request(exc) from None
    today = to_local(datetime.now(timezone.utc).replace(tzinfo=None), zone).date()

    if format == "csv":
        if kind is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A CSV export needs a kind")
        module = MODULE_OF_KIND.get(kind)
        if module and not is_module_enabled(db, module):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"The {MODULES[module][1]} module is disabled in this installation",
            )
        table = next(t for t in inventory_tables(db) if t.kind == kind)
        return _file(write_csv(table), CSV_MEDIA_TYPE, f"inventario-{FILE_SUFFIX[kind]}-{today}.csv")

    cover = _cover(db, "Inventario", current_user, zone, [
        "",
        "Las hojas tienen el mismo formato que la plantilla de importación: este archivo se puede importar en otra instalación.",
        "La columna «Estado» de Productos es solo informativa: al importar se ignora y los productos se crean activos.",
        "«Stock inicial» tiene el stock actual: una fila por producto y, en los productos con lotes, una fila por lote con cantidad.",
        "Al importar, los lotes vencidos se rechazan: corrígelos o quítalos antes.",
    ])
    content = write_xlsx(db, inventory_tables(db), cover)
    return _file(content, XLSX_MEDIA_TYPE, f"inventario-{today}.xlsx")


@router.get("/movements", summary="Export the movement history (.xlsx or .csv)")
def export_movements(
    format: Literal["xlsx", "csv"] = "xlsx",
    date_from: date | None = None,
    date_to: date | None = None,
    type_filter: Literal["ENTRY", "EXIT", "ADJUSTMENT"] | None = None,
    status_filter: Literal["pending", "authorized", "rejected"] | None = None,
    tz: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_company_user),
):
    try:
        zone = resolve_timezone(tz)
        table = movement_table(db, zone, date_from, date_to, type_filter, status_filter)
    except ExportError as exc:
        raise _bad_request(exc) from None

    period = f"{date_from or 'inicio'}_a_{date_to or 'hoy'}"
    if format == "csv":
        return _file(write_csv(table), CSV_MEDIA_TYPE, f"movimientos-{period}.csv")

    filters = [
        f"Desde: {date_from or 'el primer movimiento'} · Hasta: {date_to or 'hoy'}",
        f"Tipo: {TYPE_LABELS.get(type_filter or '', 'todos')} · Estado: {STATUS_LABELS.get(status_filter or '', 'todos')}",
        f"Una fila por producto de cada movimiento ({len(table.rows)} filas).",
    ]
    content = write_xlsx(db, [table], _cover(db, "Historial de movimientos", current_user, zone, filters))
    return _file(content, XLSX_MEDIA_TYPE, f"movimientos-{period}.xlsx")
