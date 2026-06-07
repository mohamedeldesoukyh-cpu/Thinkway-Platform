-- Lifecycle snapshot: TW-2026-0003 only
-- Campaign: LIFECYCLE-FINAL-VALIDATION-2026-06-04
-- Run after EACH UI step in Supabase SQL Editor (all sections) or via:
--   npx supabase db query --linked -f supabase/scripts/lifecycle_final_validation_snapshot.sql
--
-- Do NOT use for INV-2026-1 or any other campaign.

-- === 1. INVOICE HEADER ===
SELECT
  i.id,
  i.document_number,
  i.status,
  i.regeneration_status,
  i.is_operational_locked,
  i.subtotal,
  i.tax_amount,
  i.total,
  i.version_number,
  i.updated_at
FROM public.invoices i
WHERE i.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262'
ORDER BY i.created_at;

-- === 2. INVOICE LINE ITEMS + TOTALS CHECK ===
SELECT
  i.document_number,
  count(ili.id) AS line_item_count,
  coalesce(sum(ili.revenue_before_vat), 0) AS line_sum,
  i.subtotal,
  i.subtotal - coalesce(sum(ili.revenue_before_vat), 0) AS delta,
  array_agg(ili.id ORDER BY ili.sort_order) AS line_item_ids
FROM public.invoices i
LEFT JOIN public.invoice_line_items ili ON ili.invoice_id = i.id
WHERE i.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262'
GROUP BY i.id, i.document_number, i.subtotal;

-- === 3. LINE ITEM GRAIN (duplicate detection) ===
SELECT
  ili.invoice_id,
  ili.id AS line_item_id,
  ili.sort_order,
  ili.assignment_deliverable_id,
  ili.assignment_post_schedule_id,
  ili.revenue_before_vat,
  ili.campaign_line_id
FROM public.invoice_line_items ili
JOIN public.invoices i ON i.id = ili.invoice_id
WHERE i.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262'
ORDER BY ili.invoice_id, ili.sort_order;

SELECT
  ili.invoice_id,
  ili.assignment_deliverable_id,
  count(*) AS duplicate_count
FROM public.invoice_line_items ili
JOIN public.invoices i ON i.id = ili.invoice_id
WHERE i.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262'
  AND ili.assignment_deliverable_id IS NOT NULL
GROUP BY 1, 2
HAVING count(*) > 1;

-- === 4. ASSIGNMENT LOCK STATE ===
SELECT
  cl.document_number,
  cl.billing_status,
  cl.operational_status,
  cl.invoice_id,
  cl.vendor_io_id,
  cl.revenue_locked,
  cl.billing_invoiced_at
FROM public.campaign_lines cl
WHERE cl.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262';

-- === 5. DELIVERABLE LOCK + INVOICE LINKAGE ===
SELECT
  ad.sort_order,
  ad.deliverable_type,
  ad.billing_status,
  ad.revenue_before_vat,
  ad.billable_amount,
  ad.invoiced_amount,
  ad.remaining_amount,
  ad.invoice_line_item_id,
  ad.locked_at IS NOT NULL AS is_locked
FROM public.assignment_deliverables ad
WHERE ad.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262'
ORDER BY ad.sort_order;

-- === 6. VENDOR IO REVISION STATE ===
SELECT
  vio.id,
  vio.document_number,
  vio.revision_number,
  vio.status,
  vio.is_active,
  vio.superseded_at,
  vio.replaces_vendor_io_id,
  vio.amount,
  cl.vendor_io_id = vio.id AS is_line_active_vio
FROM public.vendor_ios vio
JOIN public.campaign_lines cl ON cl.campaign_header_id = vio.campaign_header_id
WHERE vio.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262'
ORDER BY vio.created_at;

-- === 7. QUEUE / BILLING READINESS SIGNAL ===
SELECT
  ch.document_number AS campaign_number,
  ch.name,
  cl.document_number AS line_code,
  cl.billing_status,
  cl.operational_status,
  count(ad.id) FILTER (WHERE ad.billing_status = 'ready_to_invoice') AS ready_deliverables,
  count(ad.id) FILTER (WHERE ad.invoice_line_item_id IS NOT NULL) AS invoiced_deliverables,
  count(ad.id) FILTER (WHERE ad.remaining_amount > 0) AS remaining_deliverables
FROM public.campaign_headers ch
JOIN public.campaign_lines cl ON cl.campaign_header_id = ch.id
LEFT JOIN public.assignment_deliverables ad ON ad.campaign_line_id = cl.id
WHERE ch.id = 'd7698a72-6b6a-491b-b012-08be3e923262'
GROUP BY ch.id, ch.document_number, ch.name, cl.id, cl.document_number, cl.billing_status, cl.operational_status;

-- === 8. INVARIANT FAILURES (should return zero rows when healthy) ===
-- Stale pending_regeneration after regenerate complete
SELECT 'stale_pending_regeneration' AS check_name, i.document_number, i.regeneration_status
FROM public.invoices i
WHERE i.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262'
  AND i.regeneration_status = 'pending_regeneration'
  AND i.status = 'draft';

-- Invoiced billing without invoice_id on line
SELECT 'stale_line_lock' AS check_name, cl.document_number, cl.billing_status, cl.invoice_id
FROM public.campaign_lines cl
WHERE cl.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262'
  AND cl.billing_status IN ('invoiced', 'paid', 'closed')
  AND cl.invoice_id IS NULL;

-- Orphan deliverable invoice links
SELECT 'orphan_deliverable_link' AS check_name, ad.id, ad.invoice_line_item_id
FROM public.assignment_deliverables ad
LEFT JOIN public.invoice_line_items ili ON ili.id = ad.invoice_line_item_id
WHERE ad.campaign_header_id = 'd7698a72-6b6a-491b-b012-08be3e923262'
  AND ad.invoice_line_item_id IS NOT NULL
  AND ili.id IS NULL;
