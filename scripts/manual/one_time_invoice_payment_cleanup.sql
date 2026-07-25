-- =============================================================================
-- MANUAL ONE-TIME OPERATIONS SCRIPT — NOT A MIGRATION
-- =============================================================================
--
-- File: scripts/manual/one_time_invoice_payment_cleanup.sql
--
-- THIS SCRIPT IS NOT PART OF NORMAL MIGRATIONS.
-- Do NOT add it to supabase/migrations/.
-- Do NOT run via `npx supabase db push`.
--
-- Explicit manual execution only (Supabase SQL Editor or psql), after:
--   1. Written approval from Finance + Engineering
--   2. Confirmed recent database backup / PITR
--   3. Confirmation that wiping ALL invoices and invoice-linked payments is intended
--
-- -----------------------------------------------------------------------------
-- Why this existed
-- -----------------------------------------------------------------------------
-- Originally embedded in migration
--   20260605010000_vendor_io_invoice_lifecycle.sql
-- as a "one-time invoice data reset" while introducing Vendor IO operational
-- lifecycle (operational_status, vendor_io_lines, VIO numbering, manual VIO
-- generation). It cleared legacy invoice/payment rows so billing could restart
-- against the new gates, while preserving campaigns, assignments, and vendor IOs.
--
-- That cleanup is inappropriate for automatic production migration apply.
-- It was extracted here so schema/RLS changes remain in the migration and
-- destructive data reset requires deliberate human action.
--
-- -----------------------------------------------------------------------------
-- What this does (DESTRUCTIVE)
-- -----------------------------------------------------------------------------
-- - Unlocks assignment deliverables / post schedule billing locks
-- - Resets campaign_lines billing linkage / operational_status for invoiced lines
-- - DELETE all payments with invoice_id set
-- - DELETE all invoice_versions, invoice_line_items, invoices
-- - Resets document_sequences for prefix INV-<current UTC year> to 0
--
-- Safe on an empty billing ledger (no-op deletes). Catastrophic on populated prod.
--
-- =============================================================================

-- Require the operator to uncomment the block below after reading the warnings.
-- Default: no statements execute.

/*
DO $$
DECLARE
  v_year text := to_char(timezone('utc', now()), 'YYYY');
  v_inv_prefix text := 'INV-' || v_year;
BEGIN
  -- Unlock deliverables
  UPDATE public.assignment_deliverables
  SET
    invoiced_amount = 0,
    remaining_amount = billable_amount,
    billing_status = 'ready_to_invoice',
    invoice_line_item_id = NULL,
    invoiced_at = NULL,
    locked_at = NULL
  WHERE invoice_line_item_id IS NOT NULL OR locked_at IS NOT NULL;

  UPDATE public.assignment_post_schedule
  SET
    invoiced_amount = 0,
    remaining_amount = COALESCE(billable_amount, revenue_before_vat, 0),
    billing_status = 'ready_to_invoice',
    invoice_line_item_id = NULL,
    locked_at = NULL
  WHERE invoice_line_item_id IS NOT NULL OR locked_at IS NOT NULL;

  UPDATE public.campaign_lines
  SET
    billing_status = 'moved_to_billing',
    operational_status = CASE
      WHEN vendor_io_id IS NOT NULL THEN 'io_generated'::public.campaign_line_operational_status
      ELSE 'draft'::public.campaign_line_operational_status
    END,
    invoice_id = NULL
  WHERE billing_status IN ('invoiced', 'partially_invoiced', 'partially_paid', 'paid')
     OR invoice_id IS NOT NULL;

  DELETE FROM public.payments WHERE invoice_id IS NOT NULL;

  DELETE FROM public.invoice_versions;
  DELETE FROM public.invoice_line_items;
  DELETE FROM public.invoices;

  DELETE FROM public.document_sequences WHERE prefix = v_inv_prefix;

  INSERT INTO public.document_sequences (prefix, last_value)
  VALUES (v_inv_prefix, 0)
  ON CONFLICT (prefix) DO UPDATE SET last_value = 0;
END $$;
*/
