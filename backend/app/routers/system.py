"""Panel técnico de soporte (decisión de la usuaria, 2026-11-27).

Estado de la instalación para el equipo de desarrollo: versión, base de datos, migraciones,
módulos, usuarios y totales. Solo cifras: no muestra datos de la bodega.
"""

import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.alert import Alert
from app.models.loan import Loan
from app.models.login_attempt import LoginAttempt
from app.models.movement import Movement
from app.models.product import Product
from app.models.user import User
from app.security.auth import SUPPORT_ROLE, require_roles
from app.services.company import get_settings

router = APIRouter(prefix="/system", tags=["System"])

BACKEND_DIR = Path(__file__).resolve().parents[2]


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def migration_head() -> str | None:
    """Última migración que trae el código (alembic/versions)."""
    try:
        from alembic.config import Config
        from alembic.script import ScriptDirectory

        config = Config(str(BACKEND_DIR / "alembic.ini"))
        config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
        return ScriptDirectory.from_config(config).get_current_head()
    except Exception:
        return None


def migration_current(db: Session) -> str | None:
    """Migración aplicada en la base de datos."""
    try:
        with db.begin_nested():
            return db.scalar(text("SELECT version_num FROM alembic_version"))
    except Exception:
        return None


@router.get("/status", summary="Installation status for the support team")
def system_status(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(SUPPORT_ROLE)),
):
    now = utc_now()
    settings = get_settings(db)

    def count(stmt) -> int:
        return int(db.scalar(stmt) or 0)

    users = db.execute(
        select(User.role, User.is_active, func.count())
        .where(User.role != SUPPORT_ROLE)
        .group_by(User.role, User.is_active)
    ).all()
    by_role: dict[str, dict[str, int]] = {}
    for role, active, n in users:
        by_role.setdefault(role, {"active": 0, "inactive": 0})["active" if active else "inactive"] += n

    head = migration_head()
    current = migration_current(db)
    commit = os.getenv("RENDER_GIT_COMMIT") or os.getenv("APP_VERSION")

    return {
        "server_time": now,
        "version": commit[:7] if commit else None,
        "database": {
            "ok": True,
            "migration": current,
            "migration_expected": head,
            "up_to_date": bool(head and current == head),
        },
        "company": {
            "name": settings.name,
            "modules": {
                "loans": settings.module_loans,
                "machines": settings.module_machines,
                "suppliers": settings.module_suppliers,
            },
            "coordinator_auto_approve": settings.coordinator_auto_approve,
        },
        "users": {
            "by_role": by_role,
            "pending_password_change": count(
                select(func.count()).select_from(User).where(
                    User.role != SUPPORT_ROLE, User.is_active.is_(True), User.must_change_password.is_(True)
                )
            ),
            "without_recovery_code": count(
                select(func.count()).select_from(User).where(
                    User.role != SUPPORT_ROLE, User.is_active.is_(True), User.recovery_code_hash.is_(None)
                )
            ),
            # Correos bloqueados ahora por intentos fallidos (se liberan solos a los 15 min)
            "locked_emails": db.scalars(
                select(LoginAttempt.email).where(LoginAttempt.locked_until > now).order_by(LoginAttempt.email)
            ).all(),
        },
        "totals": {
            "products_active": count(select(func.count()).select_from(Product).where(Product.status == "active")),
            "products_inactive": count(select(func.count()).select_from(Product).where(Product.status != "active")),
            "movements": count(select(func.count()).select_from(Movement)),
            "movements_pending": count(select(func.count()).select_from(Movement).where(Movement.status == "pending")),
            "last_movement_at": db.scalar(select(func.max(Movement.date))),
            "alerts_active": count(select(func.count()).select_from(Alert).where(Alert.status == "active")),
            "loans_open": count(select(func.count()).select_from(Loan).where(Loan.status == "loaned")),
        },
    }
