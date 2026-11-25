"""Límite de intentos de inicio de sesión por correo.

Reglas (docs/authentication.md):
- Tras LOGIN_MAX_ATTEMPTS fallos dentro de LOGIN_LOCK_MINUTES, el correo queda
  bloqueado LOGIN_LOCK_MINUTES y el login responde 429.
- Se cuenta por correo aunque la cuenta no exista: la respuesta no revela si el correo existe.
- Un inicio de sesión correcto borra el contador.
- Nunca se guarda la contraseña intentada.
"""

import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.login_attempt import LoginAttempt

LOGIN_MAX_ATTEMPTS = int(os.getenv("LOGIN_MAX_ATTEMPTS", 5))
LOGIN_LOCK_MINUTES = int(os.getenv("LOGIN_LOCK_MINUTES", 15))


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_attempt(db: Session, email: str) -> LoginAttempt:
    """Devuelve el contador del correo con la fila bloqueada.

    La fila se crea si no existe (ON CONFLICT DO NOTHING) y luego se bloquea, así dos
    intentos simultáneos con el mismo correo esperan su turno y cuentan los dos.
    """
    key = normalize_email(email)
    db.execute(
        insert(LoginAttempt)
        .values(email=key, failed_count=0, first_failed_at=utc_now())
        .on_conflict_do_nothing(index_elements=[LoginAttempt.email])
    )
    return db.scalar(
        select(LoginAttempt)
        .where(LoginAttempt.email == key)
        .with_for_update()
        .execution_options(populate_existing=True)
    )


def seconds_locked(attempt: LoginAttempt, now: datetime | None = None) -> int:
    """Segundos que le quedan al bloqueo (0 si no está bloqueado)."""
    now = now or utc_now()
    if attempt.locked_until is None or attempt.locked_until <= now:
        return 0
    return max(1, int((attempt.locked_until - now).total_seconds()))


def register_failure(attempt: LoginAttempt) -> int:
    """Suma un fallo. Devuelve los segundos de bloqueo si este fallo lo activa (0 si no)."""
    now = utc_now()
    window = timedelta(minutes=LOGIN_LOCK_MINUTES)

    if attempt.failed_count == 0 or attempt.first_failed_at + window <= now or (
        attempt.locked_until is not None and attempt.locked_until <= now
    ):
        # Primer fallo, o la ventana anterior ya pasó: se empieza a contar de nuevo
        attempt.failed_count = 0
        attempt.first_failed_at = now
        attempt.locked_until = None

    attempt.failed_count += 1
    if attempt.failed_count >= LOGIN_MAX_ATTEMPTS:
        attempt.locked_until = now + window
        return seconds_locked(attempt, now)
    return 0


def clear_attempts(db: Session, email: str) -> None:
    db.execute(delete(LoginAttempt).where(LoginAttempt.email == normalize_email(email)))
