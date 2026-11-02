from sqlalchemy import (
    ForeignKey,
    Integer,
    String,
)

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Machine(Base):
    __tablename__ = "machine"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    identification_code: Mapped[str] = mapped_column(
        String(30),
        nullable=False
    )

    location: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    product_links: Mapped[list["ProductMachine"]] = relationship(
        "ProductMachine",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    # IDs de repuestos compatibles expuestos en MachineResponse
    @property
    def product_ids(self) -> list[int]:
        return sorted(link.product_id for link in self.product_links)


class ProductMachine(Base):
    """Repuestos compatibles con una máquina (tabla product_machine)."""

    __tablename__ = "product_machine"

    product_id: Mapped[int] = mapped_column(
        ForeignKey("product.id"),
        primary_key=True
    )

    machine_id: Mapped[int] = mapped_column(
        ForeignKey("machine.id"),
        primary_key=True
    )
