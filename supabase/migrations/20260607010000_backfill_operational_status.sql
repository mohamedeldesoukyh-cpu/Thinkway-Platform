-- Reconcile campaign_lines.operational_status with vendor_io + billing (idempotent).

UPDATE public.campaign_lines
SET operational_status = 'io_generated'
WHERE vendor_io_id IS NOT NULL
  AND operational_status = 'draft';

UPDATE public.campaign_lines
SET operational_status = 'partially_invoiced'
WHERE billing_status = 'partially_invoiced'
  AND operational_status NOT IN ('partially_invoiced', 'invoiced', 'reopened', 'closed');

UPDATE public.campaign_lines
SET operational_status = 'invoiced'
WHERE billing_status IN ('invoiced', 'paid')
  AND operational_status NOT IN ('invoiced', 'reopened', 'closed');

UPDATE public.campaign_lines
SET operational_status = 'closed'
WHERE billing_status = 'closed'
  AND operational_status <> 'closed';

UPDATE public.campaign_lines cl
SET operational_status = 'reopened'
WHERE cl.finance_override_until IS NOT NULL
  AND cl.finance_override_until > timezone('utc', now())
  AND cl.invoice_id IS NULL
  AND cl.billing_status IN ('moved_to_billing', 'approved', 'partially_invoiced', 'invoiced')
  AND cl.operational_status NOT IN ('reopened', 'closed');

UPDATE public.campaign_lines cl
SET operational_status = 'moved_to_billing'
WHERE cl.vendor_io_id IS NOT NULL
  AND cl.billing_status IN ('moved_to_billing', 'approved')
  AND cl.operational_status IN ('draft', 'io_generated');
