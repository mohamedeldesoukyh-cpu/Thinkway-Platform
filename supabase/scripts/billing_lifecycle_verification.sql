-- Billing lifecycle SQL verification (run in Supabase SQL Editor after E2E retest)
-- All checks should return zero rows unless noted.

-- 1. Duplicate invoice line items (same post on same invoice)
SELECT
  invoice_id,
  assignment_post_schedule_id AS post_id,
  count(*) AS duplicate_count,
  array_agg(id ORDER BY created_at) AS line_item_ids
FROM public.invoice_line_items
WHERE assignment_post_schedule_id IS NOT NULL
GROUP BY invoice_id, assignment_post_schedule_id
HAVING count(*) > 1;

-- 2. Duplicate deliverable lines (no post grain)
SELECT
  invoice_id,
  assignment_deliverable_id AS deliverable_id,
  count(*) AS duplicate_count,
  array_agg(id ORDER BY created_at) AS line_item_ids
FROM public.invoice_line_items
WHERE assignment_deliverable_id IS NOT NULL
  AND assignment_post_schedule_id IS NULL
GROUP BY invoice_id, assignment_deliverable_id
HAVING count(*) > 1;

-- 3. Orphan post invoice links (post points to missing line item)
SELECT ps.id AS post_id, ps.invoice_line_item_id
FROM public.assignment_post_schedule ps
LEFT JOIN public.invoice_line_items ili ON ili.id = ps.invoice_line_item_id
WHERE ps.invoice_line_item_id IS NOT NULL
  AND ili.id IS NULL;

-- 4. Orphan deliverable invoice links
SELECT ad.id AS deliverable_id, ad.invoice_line_item_id
FROM public.assignment_deliverables ad
LEFT JOIN public.invoice_line_items ili ON ili.id = ad.invoice_line_item_id
WHERE ad.invoice_line_item_id IS NOT NULL
  AND ili.id IS NULL;

-- 5. Invoices stuck in pending_regeneration (should be empty after successful regenerate)
SELECT id, document_number, regeneration_status, status, updated_at
FROM public.invoices
WHERE regeneration_status = 'pending_regeneration'
ORDER BY updated_at DESC;

-- 6. Stale assignment locks (invoiced billing without invoice_id)
SELECT id, document_number, billing_status, operational_status, invoice_id
FROM public.campaign_lines
WHERE billing_status IN ('invoiced', 'paid', 'closed')
  AND invoice_id IS NULL;

-- 7. Invoice totals vs line sum mismatch
SELECT
  i.id,
  i.document_number,
  i.subtotal AS invoice_subtotal,
  coalesce(sum(ili.revenue_before_vat), 0) AS line_sum,
  i.subtotal - coalesce(sum(ili.revenue_before_vat), 0) AS delta
FROM public.invoices i
LEFT JOIN public.invoice_line_items ili ON ili.invoice_id = i.id
WHERE i.status <> 'void'
GROUP BY i.id, i.document_number, i.subtotal
HAVING abs(i.subtotal - coalesce(sum(ili.revenue_before_vat), 0)) > 0.01;

-- 8. Billing queue mismatch: lines moved_to_billing with active invoice linkage but no remaining work
SELECT
  cl.id,
  cl.document_number,
  cl.billing_status,
  cl.operational_status,
  cl.invoice_id,
  i.document_number AS invoice_doc,
  i.regeneration_status
FROM public.campaign_lines cl
LEFT JOIN public.invoices i ON i.id = cl.invoice_id
WHERE cl.billing_status = 'moved_to_billing'
  AND cl.vendor_io_id IS NOT NULL
  AND cl.invoice_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.assignment_deliverables ad
    WHERE ad.campaign_line_id = cl.id
      AND ad.billing_status IN ('invoiced', 'collected')
      AND ad.invoice_line_item_id IS NOT NULL
  );
