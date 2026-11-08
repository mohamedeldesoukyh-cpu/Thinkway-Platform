\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE correction_map(id uuid PRIMARY KEY,old_number text UNIQUE,new_number text UNIQUE,expected_total numeric) ON COMMIT DROP;
INSERT INTO correction_map VALUES
('e9fcfa3d-309a-492f-8fe6-028748b15486','INV-2026-00013','INV-2026-00011',2753100.02),
('0d8bcbe0-a6ce-4ab5-bb11-ecdec6d66df1','INV-2026-00011','INV-2026-00012',313500.00),
('1741f1df-1271-44de-b51d-f0df51b27186','INV-2026-00012','INV-2026-00013',222299.98);
\ir invoice-serial-rotation-20261108-core.sql
COMMIT;
