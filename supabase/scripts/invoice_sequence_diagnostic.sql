-- Invoice sequence diagnostic + repair (run once, linked DB)
SELECT 'invoices' AS section;
SELECT id, document_number, status, campaign_header_id, total, created_at
FROM invoices
ORDER BY created_at;

SELECT 'document_sequences' AS section;
SELECT prefix, last_value, updated_at
FROM document_sequences
WHERE prefix LIKE 'INV-%';

SELECT 'finance_documents' AS section;
SELECT fd.id, fd.document_number, fd.status, fd.source_table, fd.source_id, fd.created_at
FROM finance_documents fd
WHERE fd.source_table = 'invoices'
   OR fd.document_number LIKE 'INV-2026%'
ORDER BY fd.created_at;

SELECT 'invoice_line_items counts' AS section;
SELECT invoice_id, count(*) AS line_count
FROM invoice_line_items
GROUP BY invoice_id
ORDER BY invoice_id;

SELECT 'repair_dry_run' AS section;
SELECT *
FROM public.repair_invoice_sequence_for_year(2026, true);
