-- One-time data fix: void orphan invoices (no operational billing links), then compact sequence.
BEGIN;

-- Orphan = no assignment_deliverables or assignment_post_schedule linked via line items.
UPDATE public.invoices i
SET
  status = 'void',
  updated_at = timezone('utc', now())
WHERE i.document_number ~ '^INV-2026-\d+$'
  AND coalesce(i.status, 'draft') <> 'void'
  AND NOT EXISTS (
    SELECT 1
    FROM public.invoice_line_items ili
    JOIN public.assignment_deliverables ad ON ad.invoice_line_item_id = ili.id
    WHERE ili.invoice_id = i.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.invoice_line_items ili
    JOIN public.assignment_post_schedule ps ON ps.invoice_line_item_id = ili.id
    WHERE ili.invoice_id = i.id
  );

-- Free INV-YYYY-N slots held by voided rows (unique constraint blocks renumber otherwise).
UPDATE public.invoices i
SET
  document_number = 'INV-2026-void-' || replace(i.id::text, '-', ''),
  updated_at = timezone('utc', now())
WHERE coalesce(i.status, 'draft') = 'void'
  AND i.document_number ~ '^INV-2026-\d+$';

SELECT 'voided_orphans' AS step, id, document_number, status
FROM public.invoices
WHERE document_number LIKE 'INV-2026-void-%'
ORDER BY document_number;

SELECT 'repair_result' AS step, *
FROM public.repair_invoice_sequence_for_year(2026, false);

SELECT 'final_invoices' AS step, id, document_number, status, created_at
FROM public.invoices
WHERE document_number ~ '^INV-2026-\d+$'
   OR status = 'void' AND document_number LIKE 'INV-2026%'
ORDER BY created_at;

SELECT 'final_sequences' AS step, prefix, last_value
FROM public.document_sequences
WHERE prefix = 'INV-2026';

COMMIT;
