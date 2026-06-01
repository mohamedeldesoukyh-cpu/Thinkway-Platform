-- Deliverable-level billing: assignment_deliverables as billing source of truth.

DO $$ BEGIN
  CREATE TYPE public.assignment_deliverable_billing_status AS ENUM (
    'draft',
    'ready_to_invoice',
    'partially_invoiced',
    'invoiced',
    'partially_collected',
    'collected',
    'disputed',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE public.campaign_line_billing_status ADD VALUE IF NOT EXISTS 'partially_invoiced' BEFORE 'invoiced';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.assignment_deliverables
  ADD COLUMN IF NOT EXISTS billable_amount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoiced_amount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS collected_amount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disputed_amount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS remaining_amount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_status public.assignment_deliverable_billing_status NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS invoice_line_item_id uuid REFERENCES public.invoice_line_items (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoiced_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS assignment_deliverable_id uuid REFERENCES public.assignment_deliverables (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS assignment_deliverables_billing_status_idx
  ON public.assignment_deliverables (billing_status);

CREATE INDEX IF NOT EXISTS assignment_deliverables_invoice_line_item_idx
  ON public.assignment_deliverables (invoice_line_item_id)
  WHERE invoice_line_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS invoice_line_items_assignment_deliverable_idx
  ON public.invoice_line_items (assignment_deliverable_id)
  WHERE assignment_deliverable_id IS NOT NULL;

-- Sync billable/remaining from revenue columns
UPDATE public.assignment_deliverables
SET
  billable_amount = COALESCE(revenue_before_vat, 0),
  remaining_amount = GREATEST(COALESCE(revenue_before_vat, 0) - COALESCE(invoiced_amount, 0) - COALESCE(disputed_amount, 0), 0)
WHERE billable_amount = 0 AND COALESCE(revenue_before_vat, 0) > 0;

-- Backfill synthetic deliverable rows for legacy assignment lines without commercial rows
INSERT INTO public.assignment_deliverables (
  campaign_header_id,
  campaign_line_id,
  sort_order,
  platform,
  deliverable_type,
  quantity,
  unit_cost,
  total_cost,
  revenue_before_vat,
  revenue_vat_percent,
  revenue_vat_amount,
  revenue_after_vat,
  cost_before_vat,
  cost_vat_percent,
  cost_vat_amount,
  cost_after_vat,
  billable_amount,
  remaining_amount,
  billing_status,
  schedule_mode,
  metadata
)
SELECT
  cl.campaign_header_id,
  cl.id,
  0,
  COALESCE(cl.platform, 'other'),
  'other',
  1,
  COALESCE(cl.cost_before_vat, cl.cost, 0),
  COALESCE(cl.cost_before_vat, cl.cost, 0),
  COALESCE(cl.revenue_before_vat, cl.revenue, 0),
  COALESCE(cl.revenue_vat_percent, 0),
  COALESCE(cl.revenue_vat_amount, 0),
  COALESCE(cl.revenue_after_vat, cl.revenue, 0),
  COALESCE(cl.cost_before_vat, cl.cost, 0),
  COALESCE(cl.cost_vat_percent, 0),
  COALESCE(cl.cost_vat_amount, 0),
  COALESCE(cl.cost_after_vat, cl.cost, 0),
  COALESCE(cl.revenue_before_vat, cl.revenue, 0),
  CASE
    WHEN cl.billing_status IN ('invoiced', 'partially_paid', 'paid', 'closed') THEN 0
    ELSE COALESCE(cl.revenue_before_vat, cl.revenue, 0)
  END,
  CASE
    WHEN cl.billing_status IN ('invoiced', 'partially_paid', 'paid', 'closed') THEN 'invoiced'::public.assignment_deliverable_billing_status
    WHEN cl.billing_status IN ('moved_to_billing', 'approved') THEN 'ready_to_invoice'::public.assignment_deliverable_billing_status
    ELSE 'draft'::public.assignment_deliverable_billing_status
  END,
  'single',
  jsonb_build_object('legacy_synthetic', true)
FROM public.campaign_lines cl
WHERE NOT EXISTS (
  SELECT 1 FROM public.assignment_deliverables ad WHERE ad.campaign_line_id = cl.id
);

-- Link legacy invoice line items to synthetic deliverables where possible
UPDATE public.invoice_line_items ili
SET assignment_deliverable_id = ad.id
FROM public.assignment_deliverables ad
WHERE ili.campaign_line_id = ad.campaign_line_id
  AND ili.assignment_deliverable_id IS NULL
  AND ad.metadata->>'legacy_synthetic' = 'true';

-- Mark legacy invoiced deliverables
UPDATE public.assignment_deliverables ad
SET
  invoiced_amount = billable_amount,
  remaining_amount = 0,
  billing_status = 'invoiced'::public.assignment_deliverable_billing_status,
  locked_at = COALESCE(ad.locked_at, timezone('utc', now()))
FROM public.campaign_lines cl
WHERE ad.campaign_line_id = cl.id
  AND cl.billing_status IN ('invoiced', 'partially_paid', 'paid', 'closed')
  AND ad.invoiced_amount = 0
  AND ad.billable_amount > 0;

CREATE OR REPLACE FUNCTION public.sync_assignment_deliverable_amounts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.billable_amount := COALESCE(NEW.revenue_before_vat, 0);
  NEW.remaining_amount := GREATEST(
    COALESCE(NEW.billable_amount, 0) - COALESCE(NEW.invoiced_amount, 0) - COALESCE(NEW.disputed_amount, 0),
    0
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_assignment_deliverable_amounts ON public.assignment_deliverables;
CREATE TRIGGER sync_assignment_deliverable_amounts
  BEFORE INSERT OR UPDATE OF revenue_before_vat, invoiced_amount, disputed_amount
  ON public.assignment_deliverables
  FOR EACH ROW EXECUTE FUNCTION public.sync_assignment_deliverable_amounts();
