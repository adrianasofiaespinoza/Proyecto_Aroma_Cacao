from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, LargeBinary, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CompanySettings(Base):
    """Configuración de la empresa instalada: una sola fila (id = 1).

    Una instalación es una empresa (docs/decisions/001-una-instalacion-por-empresa.md).
    Nombre, logo, colores, formato regional, módulos activos y reglas configurables.
    """

    __tablename__ = "company_settings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    short_name: Mapped[str] = mapped_column(String(40), nullable=False)
    subtitle: Mapped[str] = mapped_column(String(60), nullable=False, default="Mantenimiento")

    # Etiqueta (RUC, NIT, RFC...) y número. El número no se publica sin sesión.
    tax_id_label: Mapped[str] = mapped_column(String(10), nullable=False, default="RUC")
    tax_id: Mapped[str | None] = mapped_column(String(30), nullable=True)

    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    date_format: Mapped[str] = mapped_column(String(10), nullable=False, default="dd/mm/aaaa")

    brand_color: Mapped[str] = mapped_column(String(7), nullable=False, default="#0b6e4f")
    accent_color: Mapped[str] = mapped_column(String(7), nullable=False, default="#f2a900")

    # El logo se guarda en la BD: el disco de Render gratuito no persiste.
    logo: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True)
    logo_mime: Mapped[str | None] = mapped_column(String(30), nullable=True)

    module_loans: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    module_machines: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    module_suppliers: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    coordinator_auto_approve: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=func.now(), onupdate=func.now()
    )
