from datetime import datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
)

from decimal import Decimal

from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

if TYPE_CHECKING:
    from app.models.user import User


class Movement(Base):
    __tablename__ = "movement"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    type: Mapped[str] = mapped_column(
        String(10),
        nullable=False
    )

    date: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )

    requesting_user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        nullable=False
    )

    authorizing_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"),
        nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(15),
        nullable=False,
        default="pending"
    )

    reason: Mapped[str | None] = mapped_column(
        String(150),
        nullable=True
    )

    work_order_number: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True
    )

    details: Mapped[list["MovementDetail"]] = relationship(
        "MovementDetail",
        back_populates="movement",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    requesting_user: Mapped["User"] = relationship(
        "User",
        foreign_keys=[requesting_user_id],
        lazy="selectin"
    )

    authorizing_user: Mapped["User | None"] = relationship(
        "User",
        foreign_keys=[authorizing_user_id],
        lazy="selectin"
    )

    # Nombres expuestos en MovementResponse para la interfaz
    @property
    def requesting_user_name(self) -> str | None:
        user = self.requesting_user
        return user.full_name if user else None

    @property
    def authorizing_user_name(self) -> str | None:
        user = self.authorizing_user
        return user.full_name if user else None


class MovementDetail(Base):
    __tablename__ = "movement_detail"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True
    )

    movement_id: Mapped[int] = mapped_column(
        ForeignKey("movement.id", ondelete="CASCADE"),
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

    lot_id: Mapped[int | None] = mapped_column(
        ForeignKey("lot.id"),
        nullable=True
    )

    machine_id: Mapped[int | None] = mapped_column(
        ForeignKey("machine.id"),
        nullable=True
    )

    movement: Mapped["Movement"] = relationship(
        "Movement",
        back_populates="details"
    )
