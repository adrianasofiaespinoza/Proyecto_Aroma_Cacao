-- =========================================================
-- 002 - Trazabilidad por lote por producto
-- =========================================================
-- Añade product.requires_lot. En estos productos toda entrada,
-- salida y ajuste debe indicar un lote, y la suma de sus lotes
-- coincide con current_stock. Los productos existentes quedan en
-- FALSE y siguen funcionando igual.
--
-- Ejecución, desde la raíz del proyecto:
--   docker exec -i aroma-postgres psql -U aroma_user -d aroma_inventory \
--     -v ON_ERROR_STOP=1 < database/migrations/002_product_requires_lot.sql

BEGIN;

ALTER TABLE product
    ADD COLUMN requires_lot BOOLEAN NOT NULL DEFAULT FALSE;

COMMIT;
