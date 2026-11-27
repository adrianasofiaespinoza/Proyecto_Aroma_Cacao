"""Importar el inventario desde Excel o CSV. Solo Coordinator.

El archivo viaja como base64 en JSON, igual que el logo (no hace falta python-multipart).
La vista previa no guarda nada; la confirmación vuelve a validar el mismo archivo y lo
carga todo en una transacción, o nada.
"""

import base64
import binascii

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.security.auth import require_roles
from app.services.importer import (
    MAX_FILE_BYTES,
    ImportFileError,
    apply_import,
    build_preview,
    build_template,
    read_file,
)

router = APIRouter(prefix="/imports", tags=["Imports"])

# base64 ocupa 4/3 del archivo
MAX_BASE64_CHARS = (MAX_FILE_BYTES * 4) // 3 + 8


class ImportFile(BaseModel):
    filename: str = Field(min_length=1, max_length=200)
    data_base64: str = Field(min_length=1, max_length=MAX_BASE64_CHARS)


class ImportConfirm(ImportFile):
    # Filas «existing» que el usuario decidió actualizar, por hoja: {"products": [3, 7]}
    update_rows: dict[str, list[int]] = Field(default_factory=dict)


def _decode(data: ImportFile) -> bytes:
    try:
        return base64.b64decode(data.data_base64, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The file is not valid base64",
        ) from None


def _preview(db: Session, data: ImportFile):
    try:
        sheets = read_file(data.filename, _decode(data))
    except ImportFileError as exc:
        # Mensaje en español: lo muestra la pantalla tal cual
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "import_file", "message": str(exc)},
        ) from None
    return build_preview(db, sheets)


@router.get("/template", summary="Download the import template (.xlsx)")
def download_template(current_user: User = Depends(require_roles("Coordinator"))):
    return Response(
        content=build_template(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="plantilla-inventario.xlsx"'},
    )


@router.post("/preview", summary="Validate an import file without saving anything")
def preview_import(
    data: ImportFile,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Coordinator")),
):
    preview = _preview(db, data)
    db.rollback()  # la vista previa no deja nada pendiente
    return preview.public()


@router.post("/confirm", summary="Import the file: everything or nothing")
def confirm_import(
    data: ImportConfirm,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles("Coordinator")),
):
    preview = _preview(db, data)
    if preview.has_errors:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "import_has_errors", "preview": preview.public()},
        )
    update_rows = {kind: set(rows) for kind, rows in data.update_rows.items()}
    try:
        summary = apply_import(db, preview, update_rows, current_user)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return summary
