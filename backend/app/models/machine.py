from sqlalchemy import (
    Integer,
    String,
)

from sqlalchemy.orm import Mapped, mapped_column

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
