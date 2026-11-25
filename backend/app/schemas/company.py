import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.services.company import CURRENCIES, DATE_FORMATS, color_errors

HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")

Currency = Literal["USD", "EUR", "MXN", "COP", "PEN", "CLP", "ARS", "GTQ", "CRC", "DOP", "BOB", "PYG", "UYU"]
DateFormat = Literal["dd/mm/aaaa", "mm/dd/aaaa", "aaaa-mm-dd"]

assert set(Currency.__args__) == set(CURRENCIES)  # type: ignore[attr-defined]
assert set(DateFormat.__args__) == set(DATE_FORMATS)  # type: ignore[attr-defined]


class Modules(BaseModel):
    loans: bool
    machines: bool
    suppliers: bool


class CompanySettingsPublic(BaseModel):
    """Lo que la pantalla de login necesita antes de iniciar sesión. Sin la identificación fiscal."""

    name: str
    short_name: str
    subtitle: str
    logo_url: str | None
    brand_color: str
    accent_color: str
    currency: str
    date_format: str
    # Solo la etiqueta (RUC, NIT...): el número no se publica
    tax_id_label: str
    modules: Modules


class CompanySettingsResponse(CompanySettingsPublic):
    tax_id: str | None
    coordinator_auto_approve: bool


class CompanySettingsUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    short_name: str = Field(min_length=1, max_length=40)
    subtitle: str = Field(default="", max_length=60)
    tax_id_label: str = Field(min_length=1, max_length=10)
    tax_id: str | None = Field(default=None, max_length=30)
    currency: Currency
    date_format: DateFormat
    brand_color: str
    accent_color: str
    modules: Modules
    coordinator_auto_approve: bool

    @field_validator("name", "short_name", "subtitle", "tax_id_label", mode="before")
    @classmethod
    def strip_text(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("tax_id", mode="before")
    @classmethod
    def empty_tax_id(cls, v):
        if isinstance(v, str):
            v = v.strip()
            return v or None
        return v

    @field_validator("brand_color", "accent_color")
    @classmethod
    def hex_color(cls, v: str) -> str:
        if not HEX_COLOR.match(v):
            raise ValueError("Color must be a hex value like #0b6e4f")
        return v.lower()

    @model_validator(mode="after")
    def readable_colors(self):
        errors = color_errors(self.brand_color, self.accent_color)
        if errors:
            raise ValueError("; ".join(errors))
        return self


class CompanyRules(BaseModel):
    """Reglas que el Coordinator de la empresa puede cambiar por su cuenta."""

    coordinator_auto_approve: bool


class LogoUpload(BaseModel):
    """Imagen como data URL: data:image/png;base64,...."""

    data_url: str = Field(max_length=400_000)
