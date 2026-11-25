"""Tokens de acceso revocados al cerrar sesión (por jti).

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-24
"""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "revoked_access_token",
        sa.Column("jti", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.Integer,
            sa.ForeignKey("users.id", ondelete="CASCADE", name="fk_revoked_access_user"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("revoked_at", sa.DateTime, nullable=False),
    )
    op.create_index(
        "idx_revoked_access_expires", "revoked_access_token", ["expires_at"]
    )


def downgrade() -> None:
    op.drop_index("idx_revoked_access_expires", table_name="revoked_access_token")
    op.drop_table("revoked_access_token")
