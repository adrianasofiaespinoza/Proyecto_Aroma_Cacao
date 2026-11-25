"""Enlaces de un solo uso para que cada usuario elija su propia contraseña.

El Coordinator genera el enlace y se lo entrega a la persona; nunca conoce la
contraseña resultante. Se guarda solo el hash del token, vence a las 24 horas,
sirve una sola vez y generar uno nuevo anula los anteriores del mismo usuario.
"""

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.password_reset_token import PasswordResetToken
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.security.password import hash_password
from app.security.token_utils import hash_token
from app.services.login_limit import clear_attempts

RESET_TTL = timedelta(hours=24)


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def create_reset(db: Session, user: User, created_by: User) -> tuple[str, datetime]:
    """Devuelve el token en claro (solo esta vez) y su vencimiento. No hace commit."""
    now = utc_now()
    # Un enlace nuevo anula los anteriores sin usar
    db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    token = secrets.token_urlsafe(32)
    expires_at = now + RESET_TTL
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(token),
            created_by_id=created_by.id,
            expires_at=expires_at,
        )
    )
    db.flush()
    return token, expires_at


def find_valid(db: Session, token: str, lock: bool = False) -> tuple[PasswordResetToken, User] | None:
    """El enlace si existe, no se usó, no venció y su usuario sigue activo."""
    stmt = select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(token))
    if lock:
        stmt = stmt.with_for_update()
    reset = db.scalar(stmt)
    if reset is None or reset.used_at is not None or reset.expires_at <= utc_now():
        return None
    user = db.get(User, reset.user_id)
    if user is None or not user.is_active:
        return None
    return reset, user


def complete_reset(db: Session, reset: PasswordResetToken, user: User, new_password: str) -> None:
    """Fija la contraseña elegida por el usuario y cierra todas sus sesiones. No hace commit."""
    now = utc_now()
    user.password_hash = hash_password(new_password)
    user.must_change_password = False
    reset.used_at = now
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now)
    )
    # Si estaba bloqueado por intentos fallidos, puede entrar de inmediato
    clear_attempts(db, user.email)
