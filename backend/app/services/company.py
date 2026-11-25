"""Configuración de la empresa: lectura, reglas de colores y módulos activables.

Las mismas reglas de contraste están en frontend/src/lib/company.ts, que además
calcula los demás colores del tema a partir del principal y el de acento.
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.company_settings import CompanySettings

CURRENCIES = ("USD", "EUR", "MXN", "COP", "PEN", "CLP", "ARS", "GTQ", "CRC", "DOP", "BOB", "PYG", "UYU")
DATE_FORMATS = ("dd/mm/aaaa", "mm/dd/aaaa", "aaaa-mm-dd")
MODULES = {
    "loans": ("module_loans", "Loans"),
    "machines": ("module_machines", "Machines"),
    "suppliers": ("module_suppliers", "Suppliers"),
}

DEFAULTS = {
    "name": "Mi empresa",
    "short_name": "Mi empresa",
    "subtitle": "Mantenimiento",
    "tax_id_label": "RUC",
    "tax_id": None,
    "currency": "USD",
    "date_format": "dd/mm/aaaa",
    "brand_color": "#0b6e4f",
    "accent_color": "#f2a900",
    "logo": None,
    "logo_mime": None,
    "module_loans": True,
    "module_machines": True,
    "module_suppliers": True,
    "coordinator_auto_approve": False,
}

# Contraste mínimo (WCAG): texto normal 4.5, elementos gráficos 3.
MIN_BRAND_CONTRAST = 4.5
MIN_ACCENT_CONTRAST = 3.0
WHITE = "#ffffff"
BLACK = "#000000"


def get_settings(db: Session) -> CompanySettings:
    """La fila única. Si falta (BD sin la revisión 0004 aplicada a mano), valores genéricos sin guardar."""
    settings = db.get(CompanySettings, 1)
    if settings is None:
        settings = CompanySettings(id=1, **DEFAULTS)
    return settings


def get_or_create_settings(db: Session) -> CompanySettings:
    settings = db.get(CompanySettings, 1)
    if settings is None:
        settings = CompanySettings(id=1, **DEFAULTS)
        db.add(settings)
        db.flush()
    return settings


# ------------------------------------------------------------
# Colores
# ------------------------------------------------------------

def _rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _hex(rgb: tuple[float, float, float]) -> str:
    return "#" + "".join(f"{round(max(0, min(255, c))):02x}" for c in rgb)


def mix(color: str, other: str, amount: float) -> str:
    """Mezcla `color` con `other`; amount = proporción de `other` (0..1)."""
    a, b = _rgb(color), _rgb(other)
    return _hex(tuple(x + (y - x) * amount for x, y in zip(a, b)))


def _luminance(hex_color: str) -> float:
    def channel(c: int) -> float:
        s = c / 255
        return s / 12.92 if s <= 0.03928 else ((s + 0.055) / 1.055) ** 2.4

    r, g, b = _rgb(hex_color)
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)


def contrast(a: str, b: str) -> float:
    la, lb = _luminance(a), _luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def nav_background(brand: str) -> str:
    """Fondo del menú lateral en el tema claro (igual que en el frontend)."""
    return mix(brand, BLACK, 0.6)


def color_errors(brand: str, accent: str) -> list[str]:
    errors = []
    if contrast(brand, WHITE) < MIN_BRAND_CONTRAST:
        errors.append(
            "brand_color is too light: text in that color would be hard to read on a white background "
            f"(contrast {contrast(brand, WHITE):.1f}, minimum {MIN_BRAND_CONTRAST})"
        )
    nav = nav_background(brand)
    if contrast(accent, nav) < MIN_ACCENT_CONTRAST:
        errors.append(
            "accent_color is too dark: it would not stand out on the navigation menu "
            f"(contrast {contrast(accent, nav):.1f}, minimum {MIN_ACCENT_CONTRAST})"
        )
    return errors


# ------------------------------------------------------------
# Módulos activables
# ------------------------------------------------------------

def is_module_enabled(db: Session, module: str) -> bool:
    attr, _ = MODULES[module]
    return bool(getattr(get_settings(db), attr))


def require_module(module: str):
    """Dependencia de router: 403 si el módulo está desactivado. Sus datos se conservan."""
    _, label = MODULES[module]

    def checker(db: Session = Depends(get_db)) -> None:
        if not is_module_enabled(db, module):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"The {label} module is disabled in this installation",
            )

    return checker
