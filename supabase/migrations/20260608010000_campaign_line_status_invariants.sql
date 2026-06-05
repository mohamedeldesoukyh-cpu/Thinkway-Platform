-- =============================================================================
-- Campaign line status invariants (Vendor IO revise / invoice lifecycle)
-- Prevents:
--   • billing_status = invoiced (or paid/closed) with invoice_id IS NULL
--   • operational_status = reopened with invoice_id IS NOT NULL
-- =============================================================================

-- Backfill: header invoiced billing must reference an invoice row
UPDATE public.campaign_lines
SET
  billing_status = CASE
    WHEN vendor_io_id IS NOT NULL THEN 'moved_to_billing'::public.campaign_line_billing_status
    WHEN billing_status = 'approved'::public.campaign_line_billing_status THEN 'approved'::public.campaign_line_billing_status
    ELSE 'moved_to_billing'::public.campaign_line_billing_status
  END,
  operational_status = CASE
    WHEN vendor_io_id IS NOT NULL THEN 'io_generated'::public.campaign_line_operational_status
    ELSE operational_status
  END
WHERE invoice_id IS NULL
  AND billing_status IN (
    'invoiced'::public.campaign_line_billing_status,
    'paid'::public.campaign_line_billing_status,
    'closed'::public.campaign_line_billing_status
  );

-- Backfill: reopened operational rows cannot retain header invoice linkage
UPDATE public.campaign_lines
SET
  invoice_id = NULL,
  operational_status = CASE
    WHEN vendor_io_id IS NOT NULL THEN 'io_generated'::public.campaign_line_operational_status
    ELSE 'draft'::public.campaign_line_operational_status
  END
WHERE operational_status = 'reopened'::public.campaign_line_operational_status
  AND invoice_id IS NOT NULL;

-- Backfill: reopened + stale invoiced billing without active finance override
UPDATE public.campaign_lines
SET
  billing_status = CASE
    WHEN vendor_io_id IS NOT NULL THEN 'moved_to_billing'::public.campaign_line_billing_status
    ELSE 'approved'::public.campaign_line_billing_status
  END,
  operational_status = CASE
    WHEN vendor_io_id IS NOT NULL THEN 'io_generated'::public.campaign_line_operational_status
    ELSE operational_status
  END
WHERE operational_status = 'reopened'::public.campaign_line_operational_status
  AND invoice_id IS NULL
  AND billing_status = 'invoiced'::public.campaign_line_billing_status
  AND (
    finance_override_until IS NULL
    OR finance_override_until <= timezone('utc', now())
  );

ALTER TABLE public.campaign_lines
  DROP CONSTRAINT IF EXISTS campaign_lines_invoiced_billing_requires_invoice;

ALTER TABLE public.campaign_lines
  ADD CONSTRAINT campaign_lines_invoiced_billing_requires_invoice
  CHECK (
    invoice_id IS NOT NULL
    OR billing_status NOT IN (
      'invoiced'::public.campaign_line_billing_status,
      'paid'::public.campaign_line_billing_status,
      'closed'::public.campaign_line_billing_status
    )
  );

ALTER TABLE public.campaign_lines
  DROP CONSTRAINT IF EXISTS campaign_lines_reopened_no_invoice_link;

ALTER TABLE public.campaign_lines
  ADD CONSTRAINT campaign_lines_reopened_no_invoice_link
  CHECK (
    operational_status IS DISTINCT FROM 'reopened'::public.campaign_line_operational_status
    OR invoice_id IS NULL
  );

COMMENT ON CONSTRAINT campaign_lines_invoiced_billing_requires_invoice ON public.campaign_lines IS
  'Header invoiced/paid/closed billing must reference invoices.id';

COMMENT ON CONSTRAINT campaign_lines_reopened_no_invoice_link ON public.campaign_lines IS
  'Reopened correction state cannot retain campaign_lines.invoice_id';
