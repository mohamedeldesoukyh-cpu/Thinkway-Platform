\set ON_ERROR_STOP on
BEGIN;
CREATE TEMP TABLE correction_map(id uuid PRIMARY KEY,old_number text UNIQUE,new_number text UNIQUE,expected_total numeric) ON COMMIT DROP;
INSERT INTO correction_map
SELECT id,document_number,CASE document_number WHEN 'INV-2026-00020' THEN 'INV-2026-00018' WHEN 'INV-2026-00018' THEN 'INV-2026-00019' ELSE 'INV-2026-00020' END,total
FROM public.invoices WHERE document_number IN ('INV-2026-00018','INV-2026-00019','INV-2026-00020');
\ir invoice-serial-rotation-20261108-core.sql
-- Dev has different invoices; exercise the same transaction then restore them.
ROLLBACK;

