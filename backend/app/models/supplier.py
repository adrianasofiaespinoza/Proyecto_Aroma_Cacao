from decimal import Decimal

from sqlalchemy import (
    ForeignKey,
    Integer,
    Numeric,
    String,
)

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Supplier(Base):
    __tablename__ = "supplier"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    company_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    ruc: Mapped[str | None] = mapped_column(
        String(20),
        unique=True,
        nullable=True
    )

    contact_person: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    phone: Mapped[str | None] = mapped_column(
        String(20),
        nullable=True
    )

    address: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True
    )

    email: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    product_links: Mapped[list["ProductSupplier"]] = relationship(
        "ProductSupplier",
        cascade="all, delete-orphan",
        lazy="selectin"
    )


class ProductSupplier(Base):
    """Productos que ofrece un proveedor, con precio de referencia opcional."""

    __tablename__ = "product_supplier"

    product_id: Mapped[int] = mapped_column(
        ForeignKey("product.id"),
        primary_key=True
    )

    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("supplier.id"),
        primary_key=True
    )

    reference_price: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True
    )
