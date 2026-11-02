-- =========================================================
-- 001 - Rechazo de movimientos y ajustes a cero
-- =========================================================
-- Habilita el estado 'rejected' (PATCH /movements/{id}/reject)
-- y permite ADJUSTMENT con cantidad 0 (conteo físico en cero).
-- Ambas restricciones se relajan: los datos existentes siguen
-- siendo válidos. El backend sigue exigiendo cantidad > 0 para
-- ENTRY y EXIT (app/routers/movements.py).
--
-- Ejecución (Fish), desde la raíz del proyecto:
--   docker exec -i aroma-postgres psql -U aroma_user -d aroma_inventory \
--     -v ON_ERROR_STOP=1 < database/migrations/001_movement_reject_and_zero_adjustment.sql

BEGIN;

ALTER TABLE movement
    DROP CONSTRAINT chk_movement_status,
    ADD CONSTRAINT chk_movement_status
        CHECK (
            status IN (
                'pending',
                'authorized',
                'rejected'
            )
        );

ALTER TABLE movement_detail
    DROP CONSTRAINT chk_movement_quantity,
    ADD CONSTRAINT chk_movement_quantity
        CHECK (
            quantity >= 0
        );

COMMIT;
