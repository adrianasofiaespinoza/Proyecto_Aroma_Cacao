# Migraciones manuales (histórico)

Estas migraciones SQL se aplicaban a mano antes de Alembic. Se conservan como referencia: su contenido ya está en `database/schema.sql` y en la revisión `0001` de Alembic (`backend/alembic/versions/`).

Desde el Sprint 2, todo cambio de la base va en una revisión de Alembic. Una base creada con estas migraciones se marca con `alembic stamp 0001` (ver `docs/plan/guia-trabajo-equipo.md`, sección 2.4).
