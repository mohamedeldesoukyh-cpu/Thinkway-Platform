-- Post-level billing ledger: operational rows become invoice source of truth when present.

ALTER TABLE public.assignment_post_schedule
  ADD COLUMN IF NOT EXISTS billable_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (billable_amount >= 0),
  ADD COLUMN IF NOT EXISTS invoiced_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (invoiced_amount >= 0),
  ADD COLUMN IF NOT EXISTS collected_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (collected_amount >= 0),
  ADD COLUMN IF NOT EXISTS remaining_amount numeric(14, 2) NOT NULL DEFAULT 0 CHECK (remaining_amount >= 0),
  ADD COLUMN IF NOT EXISTS invoice_line_item_id uuid REFERENCES public.invoice_line_items (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoiced_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS assignment_post_schedule_id uuid REFERENCES public.assignment_post_schedule (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS assignment_post_schedule_invoice_line_item_idx
  ON public.assignment_post_schedule (invoice_line_item_id);

CREATE INDEX IF NOT EXISTS invoice_line_items_post_schedule_idx
  ON public.invoice_line_items (assignment_post_schedule_id);

-- Backfill post billable amounts from commercial columns.
UPDATE public.assignment_post_schedule ps
SET
  billable_amount = COALESCE(NULLIF(ps.billable_amount, 0), ps.revenue_before_vat, 0),
  remaining_amount = CASE
    WHEN ps.locked_at IS NOT NULL OR ps.invoice_line_item_id IS NOT NULL THEN 0
    ELSE COALESCE(NULLIF(ps.remaining_amount, 0), ps.revenue_before_vat, 0)
  END,
  invoiced_amount = CASE
    WHEN ps.locked_at IS NOT NULL OR ps.invoice_line_item_id IS NOT NULL
      THEN COALESCE(NULLIF(ps.invoiced_amount, 0), ps.revenue_before_vat, 0)
    ELSE COALESCE(ps.invoiced_amount, 0)
  END
WHERE ps.billable_amount = 0 OR ps.remaining_amount = 0;

-- Roll post totals up to deliverables when posts exist.
UPDATE public.assignment_deliverables ad
SET
  billable_amount = sub.billable,
  invoiced_amount = sub.invoiced,
  collected_amount = sub.collected,
  remaining_amount = sub.remaining
FROM (
  SELECT
    ps.assignment_deliverable_id AS deliverable_id,
    round(sum(ps.billable_amount), 2) AS billable,
    round(sum(ps.invoiced_amount), 2) AS invoiced,
    round(sum(ps.collected_amount), 2) AS collected,
    round(sum(ps.remaining_amount), 2) AS remaining
  FROM public.assignment_post_schedule ps
  GROUP BY ps.assignment_deliverable_id
) sub
WHERE ad.id = sub.deliverable_id;
