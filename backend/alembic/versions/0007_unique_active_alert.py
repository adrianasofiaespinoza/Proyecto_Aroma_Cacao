"""Una sola alerta activa por producto, garantizada por la BD.

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-25
"""

from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Si ya hay duplicados, se conserva la alerta activa más reciente de cada
    # producto y las demás pasan a resueltas (no se borra ninguna).
    op.execute(
        """
        UPDATE alert SET status = 'resolved'
        WHERE status = 'active'
          AND id NOT IN (
            SELECT DISTINCT ON (product_id) id
            FROM alert
            WHERE status = 'active'
            ORDER BY product_id, date_generated DESC, id DESC
          )
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX uq_alert_active_product ON alert (product_id) WHERE status = 'active'"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_alert_active_product")
