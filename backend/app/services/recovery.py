"""Código de recuperación y contraseña temporal (decisión de la usuaria, 2026-11-27).

- Código de recuperación: se le muestra a la persona una sola vez, al elegir su contraseña.
  Si la olvida, en el login escribe su correo y el código, y elige una nueva sin depender
  del coordinador. Sirve una sola vez: al usarlo recibe uno nuevo. Se guarda solo su hash.
- Contraseña temporal: la genera el coordinador (o soporte) como respaldo. Sirve para un
  solo ingreso, porque al entrar el sistema obliga a cambiarla (must_change_password).
"""

import secrets

from sqlalchemy.orm import Session

from app.models.user import User
from app.security.password import hash_password, verify_password

# Sin 0/O, 1/I/L ni 5/S: se copia a mano sin confundirse
ALPHABET = "ABCDEFGHJKMNPQRTUVWXYZ2346789"


def _random(n: int) -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(n))


def normalize_code(code: str) -> str:
    """Acepta minúsculas, espacios y guiones: «abcd efgh-jkmn» = «ABCD-EFGH-JKMN»."""
    raw = "".join(ch for ch in code.upper() if ch.isalnum())
    return "-".join(raw[i:i + 4] for i in range(0, len(raw), 4))


def issue_recovery_code(user: User) -> str:
    """Genera un código nuevo (anula el anterior) y devuelve el texto en claro. No hace commit."""
    code = "-".join(_random(4) for _ in range(3))
    user.recovery_code_hash = hash_password(code)
    return code


def check_recovery_code(user: User, code: str) -> bool:
    return bool(user.recovery_code_hash) and verify_password(normalize_code(code), user.recovery_code_hash)


def temporary_password() -> str:
    """10 caracteres legibles, con un guion para dictarla en dos partes."""
    return f"{_random(5)}-{_random(5)}"


def new_session_password(db: Session, user: User, password: str) -> str | None:
    """Fija una contraseña elegida por la persona. Si venía de una temporal o inicial
    (o no tenía código), le entrega su código de recuperación. No hace commit."""
    needs_code = user.must_change_password or not user.recovery_code_hash
    user.password_hash = hash_password(password)
    user.must_change_password = False
    return issue_recovery_code(user) if needs_code else None
