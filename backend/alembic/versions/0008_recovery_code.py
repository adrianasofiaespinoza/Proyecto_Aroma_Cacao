"""Código de recuperación: cada persona recupera su contraseña sin depender del coordinador.

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-27
"""

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Solo el hash Argon2id del código; los usuarios existentes lo generan desde su cuenta.
    op.add_column("users", sa.Column("recovery_code_hash", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "recovery_code_hash")
