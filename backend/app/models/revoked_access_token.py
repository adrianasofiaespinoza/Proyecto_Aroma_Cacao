from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RevokedAccessToken(Base):
    """Tokens de acceso invalidados antes de vencer (al cerrar sesión).

    Se guarda solo el `jti` del token. Los registros con `expires_at` pasado
    ya no hacen falta, porque el token vencido se rechaza igual, y se pueden borrar.
    """

    __tablename__ = "revoked_access_token"

    jti: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
