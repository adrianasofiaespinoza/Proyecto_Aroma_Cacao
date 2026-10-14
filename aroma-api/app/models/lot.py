from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Date,
    ForeignKey,
    Integer,
    Numeric,
    String,
)

from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Lot(Base):
    __tablename__ = "lot"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("product.id"),
        nullable=False
    )

    lot_number: Mapped[str] = mapped_column(
        String(30),
        nullable=False
    )

    expiration_date: Mapped[date | None] = mapped_column(
        Date,
        nullable=True
    )

    remaining_quantity: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=Decimal("0")
    )
