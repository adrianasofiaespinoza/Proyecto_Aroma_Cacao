"""Crea un usuario Coordinator desde la consola (uso local y administrativo).

Sustituye al registro público, que se cerró en el Sprint 2. Sirve para crear el
primer Coordinator de una base nueva; los demás usuarios se crean desde la
pantalla Usuarios. La contraseña se pide sin mostrarse y se guarda solo como hash.

Ejecución, desde backend/ (Fish):
    set -x PYTHONPATH .
    python app/create_coordinator.py
"""

from getpass import getpass

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


def main() -> None:
    print("Nuevo Coordinator")
    username = ask("Usuario", 50)
    full_name = ask("Nombre completo", 100)
    email = ask("Correo", 100).lower()

    password = getpass("Contraseña: ")
    if len(password) < MIN_PASSWORD:
        print(f"La contraseña debe tener al menos {MIN_PASSWORD} caracteres.")
        return
    if password != getpass("Confirma la contraseña: "):
        print("Las contraseñas no coinciden.")
        return

    with SessionLocal() as db:
        exists = db.scalar(
            select(User.id).where(
                or_(User.username == username, User.email == email)
            )
        )
        if exists:
            print("Ya existe un usuario con ese nombre de usuario o correo.")
            return

        db.add(
            User(
                username=username,
                full_name=full_name,
                email=email,
                password_hash=hash_password(password),
                role="Coordinator",
                is_active=True,
                auth_provider="local",
            )
        )
        db.commit()
        print(f"Coordinator {username} creado. Ya puede iniciar sesión.")


if __name__ == "__main__":
    main()
