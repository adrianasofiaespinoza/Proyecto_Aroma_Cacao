"""Contraseña propia: cambio obligatorio al primer ingreso y enlaces de restablecimiento.

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-25
"""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Los usuarios existentes ya eligieron su contraseña: no se les obliga a cambiarla.
    op.add_column(
        "users",
        sa.Column("must_change_password", sa.Boolean, nullable=False, server_default=sa.false()),
    )
    op.create_table(
        "password_reset_token",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        # Solo el hash SHA-256: el enlace completo no se guarda en ningún lado
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        # Quién lo generó (auditoría)
        sa.Column("created_by_id", sa.Integer, sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("used_at", sa.DateTime, nullable=True),
    )
    op.create_index("ix_password_reset_token_user_id", "password_reset_token", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_password_reset_token_user_id", table_name="password_reset_token")
    op.drop_table("password_reset_token")
    op.drop_column("users", "must_change_password")
