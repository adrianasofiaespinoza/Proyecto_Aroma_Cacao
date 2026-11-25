"""Configuración de la empresa instalada (docs/flows/configuracion-empresa.md)."""

import base64
import binascii
import re

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.company_settings import CompanySettings
from app.models.loan import Loan
from app.models.user import User
from app.schemas.company import (
    CompanyRules,
    CompanySettingsPublic,
    CompanySettingsResponse,
    CompanySettingsUpdate,
    LogoUpload,
)
from app.security.auth import SUPPORT_ROLE, require_roles

# Marca, moneda y módulos: solo el equipo de desarrollo (rol Support).
# Las reglas de operación (autoaprobación): también el Coordinator de la empresa.
only_support = require_roles(SUPPORT_ROLE)
rules_editors = require_roles("Coordinator", SUPPORT_ROLE)
from app.services.company import get_or_create_settings, get_settings

router = APIRouter(prefix="/settings", tags=["Settings"])

MAX_LOGO_BYTES = 200 * 1024
DATA_URL = re.compile(r"^data:(image/(?:png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/=\s]+)$")

# Icono genérico cuando no hay logo (una caja), para /favicon.ico.
GENERIC_ICON = (
    b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">'
    b'<rect width="32" height="32" rx="6" fill="#0b6e4f"/>'
    b'<path d="M8 12l8-4 8 4v9l-8 4-8-4z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>'
    b'<path d="M8 12l8 4 8-4M16 16v9" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>'
    b"</svg>"
)


def logo_url(settings: CompanySettings) -> str | None:
    if not settings.logo:
        return None
    version = int(settings.updated_at.timestamp()) if settings.updated_at else 0
    return f"/settings/logo?v={version}"


def to_public(settings: CompanySettings) -> dict:
    return {
        "name": settings.name,
        "short_name": settings.short_name,
        "subtitle": settings.subtitle,
        "logo_url": logo_url(settings),
        "brand_color": settings.brand_color,
        "accent_color": settings.accent_color,
        "currency": settings.currency,
        "date_format": settings.date_format,
        "tax_id_label": settings.tax_id_label,
        "modules": {
            "loans": settings.module_loans,
            "machines": settings.module_machines,
            "suppliers": settings.module_suppliers,
        },
    }


def to_full(settings: CompanySettings) -> dict:
    return {
        **to_public(settings),
        "tax_id": settings.tax_id,
        "coordinator_auto_approve": settings.coordinator_auto_approve,
    }


@router.get(
    "/public",
    response_model=CompanySettingsPublic,
    summary="Company name, logo, colors, formats and modules (no authentication)",
)
def public_settings(db: Session = Depends(get_db)):
    return to_public(get_settings(db))


@router.get(
    "",
    response_model=CompanySettingsResponse,
    summary="Full company settings (Support)",
)
def read_settings(
    db: Session = Depends(get_db),
    _: User = Depends(only_support),
):
    return to_full(get_settings(db))


@router.put(
    "",
    response_model=CompanySettingsResponse,
    summary="Update company settings (Support)",
)
def update_settings(
    data: CompanySettingsUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(only_support),
):
    settings = get_or_create_settings(db)

    # Desactivar Préstamos con herramientas fuera dejaría el stock disponible sin explicación.
    if settings.module_loans and not data.modules.loans:
        active = db.scalar(select(func.count()).select_from(Loan).where(Loan.status == "loaned"))
        if active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Cannot disable the Loans module: {active} tools are still on loan",
            )

    settings.name = data.name
    settings.short_name = data.short_name
    settings.subtitle = data.subtitle
    settings.tax_id_label = data.tax_id_label
    settings.tax_id = data.tax_id
    settings.currency = data.currency
    settings.date_format = data.date_format
    settings.brand_color = data.brand_color
    settings.accent_color = data.accent_color
    settings.module_loans = data.modules.loans
    settings.module_machines = data.modules.machines
    settings.module_suppliers = data.modules.suppliers
    settings.coordinator_auto_approve = data.coordinator_auto_approve

    db.commit()
    db.refresh(settings)
    return to_full(settings)


# ------------------------------------------------------------
# Reglas de operación: el Coordinator de la empresa también las cambia
# ------------------------------------------------------------

@router.get("/rules", response_model=CompanyRules, summary="Operating rules (Coordinator or Support)")
def read_rules(
    db: Session = Depends(get_db),
    _: User = Depends(rules_editors),
):
    return {"coordinator_auto_approve": get_settings(db).coordinator_auto_approve}


@router.put("/rules", response_model=CompanyRules, summary="Update operating rules (Coordinator or Support)")
def update_rules(
    data: CompanyRules,
    db: Session = Depends(get_db),
    _: User = Depends(rules_editors),
):
    settings = get_or_create_settings(db)
    settings.coordinator_auto_approve = data.coordinator_auto_approve
    db.commit()
    return {"coordinator_auto_approve": settings.coordinator_auto_approve}


# ------------------------------------------------------------
# Logo
# ------------------------------------------------------------

def decode_logo(data_url: str) -> tuple[bytes, str]:
    match = DATA_URL.match(data_url.strip())
    if not match:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Logo must be a PNG, JPEG, WebP or SVG image",
        )
    mime, payload = match.groups()
    try:
        content = base64.b64decode(re.sub(r"\s", "", payload), validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Logo must be a PNG, JPEG, WebP or SVG image",
        )

    if not content:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Logo file is empty")
    if len(content) > MAX_LOGO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Logo is too large: maximum {MAX_LOGO_BYTES // 1024} KB",
        )

    # El contenido debe coincidir con el tipo declarado.
    signatures = {
        "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/jpeg": content.startswith(b"\xff\xd8\xff"),
        "image/webp": content[:4] == b"RIFF" and content[8:12] == b"WEBP",
        "image/svg+xml": b"<svg" in content[:2048].lower(),
    }
    if not signatures[mime]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Logo content does not match its image type",
        )
    return content, mime


@router.put(
    "/logo",
    response_model=CompanySettingsResponse,
    summary="Upload the company logo as a data URL (Support, max 200 KB)",
)
def upload_logo(
    data: LogoUpload,
    db: Session = Depends(get_db),
    _: User = Depends(only_support),
):
    content, mime = decode_logo(data.data_url)
    settings = get_or_create_settings(db)
    settings.logo = content
    settings.logo_mime = mime
    db.commit()
    db.refresh(settings)
    return to_full(settings)


@router.delete(
    "/logo",
    response_model=CompanySettingsResponse,
    summary="Remove the company logo (Support)",
)
def delete_logo(
    db: Session = Depends(get_db),
    _: User = Depends(only_support),
):
    settings = get_or_create_settings(db)
    settings.logo = None
    settings.logo_mime = None
    db.commit()
    db.refresh(settings)
    return to_full(settings)


def image_response(content: bytes, mime: str) -> Response:
    return Response(
        content=content,
        media_type=mime,
        headers={
            "Cache-Control": "public, max-age=86400",
            "X-Content-Type-Options": "nosniff",
            # Un SVG abierto directamente no puede ejecutar scripts.
            "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
        },
    )


@router.get(
    "/logo",
    summary="Company logo (no authentication)",
    responses={404: {"description": "No logo configured"}},
)
def read_logo(db: Session = Depends(get_db)):
    settings = get_settings(db)
    if not settings.logo or not settings.logo_mime:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No logo configured")
    return image_response(settings.logo, settings.logo_mime)


def favicon(db: Session = Depends(get_db)) -> Response:
    """/favicon.ico de la API: el logo configurado o un icono genérico."""
    settings = get_settings(db)
    if settings.logo and settings.logo_mime:
        return image_response(settings.logo, settings.logo_mime)
    return image_response(GENERIC_ICON, "image/svg+xml")
