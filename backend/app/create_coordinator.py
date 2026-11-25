"""Crea un usuario Coordinator desde la consola (uso local y administrativo).

Sustituye al registro público, que se cerró en el Sprint 2. Sirve para crear el
primer Coordinator de una base nueva; los demás usuarios se crean desde la
pantalla Usuarios. La contraseña se pide sin mostrarse y se guarda solo como hash.

Ejecución, desde backend/ (Fish):
    set -x PYTHONPATH .
    python app/create_coordinator.py
"""

from getpass import getpass

from email_validator import EmailNotValidError, validate_email

from sqlalchemy import or_, select

from app.database import SessionLocal
from app.models.user import User
from app.security.password import hash_password

MIN_PASSWORD = 8


def ask(label: str, max_length: int) -> str:
    while True:
        value = input(f"{label}: ").strip()
        if value and len(value) <= max_length:
            return value
        print(f"Escribe entre 1 y {max_length} caracteres.")


def ask_email() -> str:
    """Correo con el mismo formato que exige el login (si no, la cuenta no podría entrar)."""
    while True:
        value = ask("Correo", 100).lower()
        try:
            return validate_email(value, check_deliverability=False).normalized
        except EmailNotValidError:
            print("Ese correo no es válido. Escríbelo completo, por ejemplo nombre@empresa.com.")


def ask_coordinator() -> dict | None:
    """Pide los datos por teclado. La contraseña no se muestra ni se pasa por argumentos."""
    username = ask("Usuario", 50)
    full_name = ask("Nombre completo", 100)
    email = ask_email()

    password = getpass("Contraseña: ")
    if len(password) < MIN_PASSWORD:
        print(f"La contraseña debe tener al menos {MIN_PASSWORD} caracteres.")
        return None
    if password != getpass("Confirma la contraseña: "):
        print("Las contraseñas no coinciden.")
        return None
    return {"username": username, "full_name": full_name, "email": email, "password": password}


def insert_coordinator(db, data: dict, role: str = "Coordinator") -> bool:
    """Crea el usuario (Coordinator por defecto) si el usuario y el correo están libres. No hace commit."""
    exists = db.scalar(
        select(User.id).where(
            or_(User.username == data["username"], User.email == data["email"])
        )
    )
    if exists:
        print("Ya existe un usuario con ese nombre de usuario o correo.")
        return False

    db.add(
        User(
            username=data["username"],
            full_name=data["full_name"],
            email=data["email"],
            password_hash=hash_password(data["password"]),
            role=role,
            is_active=True,
            auth_provider="local",
        )
    )
    return True


def main() -> None:
    print("Nuevo Coordinator")
    data = ask_coordinator()
    if data is None:
        return

    with SessionLocal() as db:
        if not insert_coordinator(db, data):
            return
        db.commit()
        print(f"Coordinator {data['username']} creado. Ya puede iniciar sesión.")


if __name__ == "__main__":
    main()
