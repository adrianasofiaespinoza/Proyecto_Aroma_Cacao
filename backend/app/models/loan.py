from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
)

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Worker(Base):
    """Trabajador que recibe préstamos; no necesita cuenta en el sistema."""

    __tablename__ = "worker"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    full_name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    position: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True
    )


class Loan(Base):
    __tablename__ = "loan"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    worker_id: Mapped[int] = mapped_column(
        ForeignKey("worker.id"),
        nullable=False
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("product.id"),
        nullable=False
    )

    quantity: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False
    )

    loan_date: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    return_date: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="loaned"
    )

    worker: Mapped["Worker"] = relationship(
        "Worker",
        lazy="selectin"
    )

    # Nombre expuesto en LoanResponse para la interfaz
    @property
    def worker_name(self) -> str | None:
        return self.worker.full_name if self.worker else None
