"""Instala el sistema para una empresa nueva con un solo comando.

1. Aplica las migraciones de Alembic (crea las tablas si la BD está vacía).
2. Carga los catálogos básicos de categorías y unidades que falten.
3. Pide el nombre de la empresa si todavía tiene el genérico.
4. Crea el primer Coordinator si no hay ninguno activo.
5. Ofrece crear la cuenta de soporte del equipo de desarrollo si no hay ninguna.

Ejecutarlo dos veces no duplica nada ni cambia ninguna contraseña. La contraseña
se pide por teclado; nunca va en argumentos ni en archivos.

Ejecución, desde backend/ (Fish), con DATABASE_URL apuntando a la BD de la empresa:
    set -x PYTHONPATH .
    python app/install.py
"""

import sys
from pathlib import Path

from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.create_coordinator import ask_coordinator, insert_coordinator
from app.database import SessionLocal, engine
from app.models.product import Category, UnitOfMeasure
from app.models.user import User
from app.security.auth import SUPPORT_ROLE
from app.services.company import DEFAULTS, get_or_create_settings

BACKEND_DIR = Path(__file__).resolve().parents[1]

# Los mismos de la revisión 0001 (database/schema.sql).
CATEGORIES = ("Tools", "Spare Parts", "Supplies", "Equipment", "Materials")
UNITS = (("Unit", "u"), ("Kilogram", "kg"), ("Liter", "L"), ("Meter", "m"))


def run_migrations() -> bool:
    """Aplica `alembic upgrade head`. Se detiene si la BD tiene tablas pero no está versionada."""
    from alembic import command
    from alembic.config import Config

    tables = set(inspect(engine).get_table_names())
    if tables and "alembic_version" not in tables:
        print(
            "La base ya tiene tablas pero no está versionada con Alembic.\n"
            "Si se creó con database/schema.sql y las migraciones 001 y 002, márcala una vez y vuelve a ejecutar:\n"
            "    alembic stamp 0001"
        )
        return False

    command.upgrade(Config(str(BACKEND_DIR / "alembic.ini")), "head")
    print("Migraciones aplicadas.")
    return True


def seed_catalogs(db: Session) -> int:
    """Agrega las categorías y unidades básicas que falten. Devuelve cuántas agregó."""
    added = 0
    existing = set(db.scalars(select(Category.name)))
    for name in CATEGORIES:
        if name not in existing:
            db.add(Category(name=name))
            added += 1
    existing = set(db.scalars(select(UnitOfMeasure.name)))
    for name, abbreviation in UNITS:
        if name not in existing:
            db.add(UnitOfMeasure(name=name, abbreviation=abbreviation))
            added += 1
    db.flush()
    return added


def configure_company(db: Session) -> None:
    """Pide el nombre solo si la empresa todavía tiene el genérico. Enter lo conserva."""
    settings = get_or_create_settings(db)
    if settings.name != DEFAULTS["name"]:
        print(f"Empresa: {settings.name} (sin cambios).")
        return

    name = input(f"Nombre de la empresa [{settings.name}]: ").strip()[:100]
    if name:
        settings.name = name
        short = input(f"Nombre corto para el menú [{name[:40]}]: ").strip()[:40]
        settings.short_name = short or name[:40]
    db.flush()
    print("El logo, los colores y la moneda se cambian después en Configuración.")


def has_active_coordinator(db: Session) -> bool:
    return db.scalar(
        select(User.id).where(User.role == "Coordinator", User.is_active.is_(True)).limit(1)
    ) is not None


def ensure_coordinator(db: Session, attempts: int = 3) -> bool:
    """Crea el primer Coordinator si no hay ninguno activo. Nunca toca usuarios existentes."""
    if has_active_coordinator(db):
        print("Ya hay un Coordinator activo; no se crea otro.")
        return True

    print("Primer Coordinator")
    for _ in range(attempts):
        data = ask_coordinator()
        if data and insert_coordinator(db, data):
            db.flush()
            print(f"Coordinator {data['username']} creado.")
            return True
    print("No se creó el Coordinator. Vuelve a ejecutar el script.")
    return False


def ensure_support(db: Session) -> None:
    """Cuenta de soporte (equipo de desarrollo), opcional. Nunca toca las existentes."""
    exists = db.scalar(select(User.id).where(User.role == SUPPORT_ROLE).limit(1))
    if exists is not None:
        print("Ya hay una cuenta de soporte; no se crea otra.")
        return
    if input("¿Crear la cuenta de soporte del equipo de desarrollo? [S/n]: ").strip().lower() in ("n", "no"):
        print("Sin cuenta de soporte. Se puede crear después con app/create_support.py.")
        return
    print("Cuenta de soporte")
    data = ask_coordinator()
    if data and insert_coordinator(db, data, role=SUPPORT_ROLE):
        db.flush()
        print(f"Cuenta de soporte {data['username']} creada.")
    else:
        print("No se creó la cuenta de soporte. Se puede crear después con app/create_support.py.")


def main() -> int:
    if not run_migrations():
        return 1

    with SessionLocal() as db:
        added = seed_catalogs(db)
        print(f"Catálogos básicos: {added} agregados." if added else "Catálogos básicos completos.")
        configure_company(db)
        ok = ensure_coordinator(db)
        if ok:
            ensure_support(db)
        db.commit()

    print("Instalación lista." if ok else "Instalación incompleta: falta el Coordinator.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
