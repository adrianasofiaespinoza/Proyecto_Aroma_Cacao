"""Crea una cuenta de soporte (rol Support) para el equipo de desarrollo.

La empresa cliente no ve estas cuentas en Usuarios ni puede editarlas.
Con ellas se cambia la Configuración (marca, moneda, módulos) desde el navegador.
La contraseña se pide sin mostrarse y se guarda solo como hash.

Ejecución, desde backend/ (Fish), con DATABASE_URL apuntando a la BD de la empresa:
    set -x PYTHONPATH .
    python app/create_support.py
"""

from app.create_coordinator import ask_coordinator, insert_coordinator
from app.database import SessionLocal
from app.security.auth import SUPPORT_ROLE


def main() -> None:
    print("Nueva cuenta de soporte (equipo de desarrollo)")
    data = ask_coordinator()
    if data is None:
        return

    with SessionLocal() as db:
        if not insert_coordinator(db, data, role=SUPPORT_ROLE):
            return
        db.commit()
        print(f"Cuenta de soporte {data['username']} creada. La empresa no la ve en Usuarios.")


if __name__ == "__main__":
    main()
