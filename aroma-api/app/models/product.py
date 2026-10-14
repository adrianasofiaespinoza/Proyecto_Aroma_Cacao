from decimal import Decimal

from sqlalchemy import (
    ForeignKey,
    Integer,
    Numeric,
    String,
)

from sqlalchemy.orm import (
    Mapped,
    mapped_column,
)

from app.database import Base


class Category(Base):
    __tablename__ = "category"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    name: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        nullable=False
    )


class UnitOfMeasure(Base):
    __tablename__ = "unit_of_measure"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    name: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        nullable=False
    )

    abbreviation: Mapped[str] = mapped_column(
        String(10),
        nullable=False
    )


class Product(Base):
    __tablename__ = "product"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    internal_code: Mapped[str] = mapped_column(
        String(30),
        unique=True,
        nullable=False
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    brand: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True
    )

    model: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True
    )

    part_number: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True
    )

    current_stock: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=0
    )

    minimum_stock: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=0
    )

    maximum_stock: Mapped[Decimal | None] = mapped_column(
        Numeric(10, 2),
        nullable=True
    )

    physical_location: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="active"
    )

    category_id: Mapped[int] = mapped_column(
        ForeignKey("category.id"),
        nullable=False
    )

    unit_of_measure_id: Mapped[int] = mapped_column(
        ForeignKey("unit_of_measure.id"),
        nullable=False
    )
