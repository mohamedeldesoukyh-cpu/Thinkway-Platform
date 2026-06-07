-- Pre-state
SELECT 'before_invoices' AS step, id, document_number, status, campaign_header_id, total, created_at
FROM invoices ORDER BY created_at;

SELECT 'before_sequences' AS step, prefix, last_value FROM document_sequences WHERE prefix LIKE 'INV-%';

-- Apply repair
SELECT 'repair_apply' AS step, * FROM public.repair_invoice_sequence_for_year(2026, false);

-- Post-state
SELECT 'after_invoices' AS step, id, document_number, status, created_at FROM invoices ORDER BY created_at;
SELECT 'after_sequences' AS step, prefix, last_value FROM document_sequences WHERE prefix LIKE 'INV-%';
SELECT 'after_finance_documents' AS step, id, document_number, source_id FROM finance_documents WHERE source_table = 'invoices' ORDER BY created_at;
