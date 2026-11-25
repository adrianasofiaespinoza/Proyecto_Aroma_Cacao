"""Rol Support: el equipo de desarrollo, invisible para la empresa cliente.

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-25
"""

from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("chk_user_role", "users", type_="check")
    op.create_check_constraint(
        "chk_user_role", "users", "role IN ('Coordinator', 'Operator', 'Read-only', 'Support')"
    )


def downgrade() -> None:
    # Sin usuarios Support no se puede volver: el chequeo anterior los rechaza.
    op.execute("DELETE FROM refresh_tokens WHERE user_id IN (SELECT id FROM users WHERE role = 'Support')")
    op.execute("DELETE FROM users WHERE role = 'Support'")
    op.drop_constraint("chk_user_role", "users", type_="check")
    op.create_check_constraint(
        "chk_user_role", "users", "role IN ('Coordinator', 'Operator', 'Read-only')"
    )
