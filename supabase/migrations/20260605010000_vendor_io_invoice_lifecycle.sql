-- =============================================================================
-- Vendor IO & Invoice operational lifecycle (Phase 1)
-- - Line operational_status gate for invoicing
-- - VIO-YYYY-NNNN numbering + line linkage
-- - Disable auto vendor IO triggers (manual generation only)
-- - One-time invoice data reset (preserves campaigns, assignments, vendor IOs)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Line operational status (billing gate; separate from assignment_status)
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'campaign_line_operational_status'
  ) THEN
    CREATE TYPE public.campaign_line_operational_status AS ENUM (
      'draft',
      'io_generated',
      'partially_invoiced',
      'invoiced',
      'reopened'
    );
  END IF;
END $$;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS operational_status public.campaign_line_operational_status
    NOT NULL DEFAULT 'draft';

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS vendor_io_id uuid REFERENCES public.vendor_ios (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS campaign_lines_operational_status_idx
  ON public.campaign_lines (operational_status);

CREATE INDEX IF NOT EXISTS campaign_lines_vendor_io_id_idx
  ON public.campaign_lines (vendor_io_id);

-- Backfill: lines linked to an existing vendor_io → io_generated
UPDATE public.campaign_lines cl
SET
  operational_status = 'io_generated',
  vendor_io_id = vio.id
FROM public.campaign_influencers ci
JOIN public.vendor_ios vio ON vio.assignment_id = ci.id
WHERE ci.campaign_line_id = cl.id
  AND cl.operational_status = 'draft';

UPDATE public.campaign_lines
SET operational_status = 'invoiced'
WHERE billing_status IN ('invoiced', 'paid', 'closed')
  AND operational_status NOT IN ('invoiced', 'reopened');

UPDATE public.campaign_lines
SET operational_status = 'partially_invoiced'
WHERE billing_status = 'partially_invoiced'
  AND operational_status NOT IN ('invoiced', 'reopened');

-- -----------------------------------------------------------------------------
-- Vendor IO document numbers + revisions
-- -----------------------------------------------------------------------------
ALTER TABLE public.vendor_ios
  ADD COLUMN IF NOT EXISTS document_number text,
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_ios_document_number_unique
  ON public.vendor_ios (document_number)
  WHERE document_number IS NOT NULL;

-- Allow one vendor_io per influencer batch (drop strict 1:1 assignment uniqueness)
ALTER TABLE public.vendor_ios
  DROP CONSTRAINT IF EXISTS vendor_ios_assignment_id_key;

CREATE INDEX IF NOT EXISTS vendor_ios_assignment_id_idx
  ON public.vendor_ios (assignment_id);

-- Link multiple campaign lines to one vendor_io
CREATE TABLE IF NOT EXISTS public.vendor_io_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_io_id uuid NOT NULL REFERENCES public.vendor_ios (id) ON DELETE CASCADE,
  campaign_line_id uuid NOT NULL REFERENCES public.campaign_lines (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT vendor_io_lines_line_unique UNIQUE (campaign_line_id)
);

CREATE INDEX IF NOT EXISTS vendor_io_lines_vendor_io_id_idx
  ON public.vendor_io_lines (vendor_io_id);

-- VIO-YYYY-NNNN (4-digit serial, yearly reset via prefix)
CREATE OR REPLACE FUNCTION public.assign_vendor_io_document_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year text := to_char(timezone('utc', now()), 'YYYY');
  v_prefix text := 'VIO-' || v_year;
  v_next bigint;
  v_base text;
BEGIN
  IF NEW.document_number IS NULL OR btrim(NEW.document_number) = '' THEN
    INSERT INTO public.document_sequences AS ds (prefix, last_value)
    VALUES (v_prefix, 1)
    ON CONFLICT (prefix) DO UPDATE
      SET last_value = ds.last_value + 1
    RETURNING last_value INTO v_next;

    v_base := v_prefix || '-' || lpad(v_next::text, 4, '0');
    IF COALESCE(NEW.revision_number, 0) > 0 THEN
      NEW.document_number := v_base || '/' || NEW.revision_number::text;
    ELSE
      NEW.document_number := v_base;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_vendor_ios_document_number ON public.vendor_ios;
CREATE TRIGGER assign_vendor_ios_document_number
  BEFORE INSERT ON public.vendor_ios
  FOR EACH ROW EXECUTE FUNCTION public.assign_vendor_io_document_number();

-- Disable automatic vendor IO creation (manual "Generate Vendor IO" only)
DROP TRIGGER IF EXISTS auto_create_vendor_io_on_assignment ON public.campaign_influencers;
DROP TRIGGER IF EXISTS auto_create_vendor_io_on_line_assigned ON public.campaign_lines;

-- -----------------------------------------------------------------------------
-- Invoice lock flag (operational; complements regeneration_status)
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS is_operational_locked boolean NOT NULL DEFAULT false;

UPDATE public.invoices
SET is_operational_locked = true
WHERE regeneration_status = 'pending_regeneration'
   OR status IN ('paid', 'void');

-- -----------------------------------------------------------------------------
-- One-time invoice reset (keeps campaigns, lines, vendor IOs)
-- Run via: npx supabase db push
-- -----------------------------------------------------------------------------
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

-- RLS for vendor_io_lines
ALTER TABLE public.vendor_io_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_io_lines_select ON public.vendor_io_lines;
CREATE POLICY vendor_io_lines_select ON public.vendor_io_lines
  FOR SELECT TO authenticated
  USING (
    public.is_internal_user()
    OR public.has_permission('vendor_ios.read')
    OR EXISTS (
      SELECT 1 FROM public.vendor_ios vio
      WHERE vio.id = vendor_io_id
        AND public.can_access_campaign(vio.campaign_header_id)
    )
  );

DROP POLICY IF EXISTS vendor_io_lines_write ON public.vendor_io_lines;
CREATE POLICY vendor_io_lines_write ON public.vendor_io_lines
  FOR ALL TO authenticated
  USING (public.has_permission('vendor_ios.write'))
  WITH CHECK (public.has_permission('vendor_ios.write'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_io_lines TO authenticated;
