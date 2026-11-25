"""Intentos fallidos de inicio de sesión por correo (bloqueo temporal).

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-24
"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "login_attempt",
        sa.Column("email", sa.String(100), primary_key=True),
        sa.Column("failed_count", sa.Integer, nullable=False, server_default="0"),
        sa.Column("first_failed_at", sa.DateTime, nullable=False),
        sa.Column("locked_until", sa.DateTime, nullable=True),
        sa.CheckConstraint("failed_count >= 0", name="chk_login_attempt_count"),
    )


def downgrade() -> None:
    op.drop_table("login_attempt")
