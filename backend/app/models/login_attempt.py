from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LoginAttempt(Base):
    """Fallos de inicio de sesión por correo, para bloquear la fuerza bruta.

    Se guarda por correo aunque la cuenta no exista, para no revelar qué correos
    están registrados. Nunca se guarda la contraseña intentada.
    """

    __tablename__ = "login_attempt"

    # Correo normalizado (minúsculas y sin espacios)
    email: Mapped[str] = mapped_column(String(100), primary_key=True)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    first_failed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
