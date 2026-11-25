"""Esquema inicial: equivalente a database/schema.sql (incluye las migraciones manuales 001 y 002).

Una base que ya existe (creada con schema.sql y las migraciones 001 y 002) no se recrea:
se marca con `alembic stamp 0001` y desde ahí se aplican solo las revisiones nuevas.

Revision ID: 0001
Revises:
Create Date: 2026-11-24
"""

from pathlib import Path

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

SQL_FILE = Path(__file__).with_name("0001_initial_schema.sql")

TABLES = (
    "loan",
    "worker",
    "alert",
    "movement_detail",
    "movement",
    "lot",
    "product_machine",
    "machine",
    "product_supplier",
    "supplier",
    "product",
    "unit_of_measure",
    "category",
    "refresh_tokens",
    "users",
)


def upgrade() -> None:
    # exec_driver_sql: el archivo tiene varias sentencias y no debe interpretar ":" ni "%"
    op.get_bind().exec_driver_sql(SQL_FILE.read_text(encoding="utf-8"))


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
