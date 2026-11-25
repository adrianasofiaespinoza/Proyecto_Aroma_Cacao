"""Configuración de la empresa instalada (una sola fila).

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-24
"""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "company_settings",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("short_name", sa.String(40), nullable=False),
        sa.Column("subtitle", sa.String(60), nullable=False, server_default="Mantenimiento"),
        sa.Column("tax_id_label", sa.String(10), nullable=False, server_default="RUC"),
        sa.Column("tax_id", sa.String(30), nullable=True),
        sa.Column("currency", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("date_format", sa.String(10), nullable=False, server_default="dd/mm/aaaa"),
        sa.Column("brand_color", sa.String(7), nullable=False, server_default="#0b6e4f"),
        sa.Column("accent_color", sa.String(7), nullable=False, server_default="#f2a900"),
        sa.Column("logo", sa.LargeBinary, nullable=True),
        sa.Column("logo_mime", sa.String(30), nullable=True),
        sa.Column("module_loans", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("module_machines", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("module_suppliers", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("coordinator_auto_approve", sa.Boolean, nullable=False, server_default=sa.false()),
        sa.Column("updated_at", sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("id = 1", name="chk_company_settings_single_row"),
        sa.CheckConstraint("brand_color ~ '^#[0-9a-fA-F]{6}$'", name="chk_company_settings_brand_color"),
        sa.CheckConstraint("accent_color ~ '^#[0-9a-fA-F]{6}$'", name="chk_company_settings_accent_color"),
        sa.CheckConstraint(
            "(logo IS NULL) = (logo_mime IS NULL)", name="chk_company_settings_logo_mime"
        ),
    )
    # La fila única con valores genéricos; el equipo de desarrollo la ajusta en Configuración.
    op.execute("INSERT INTO company_settings (id, name, short_name) VALUES (1, 'Mi empresa', 'Mi empresa')")


def downgrade() -> None:
    op.drop_table("company_settings")
