-- Operational commercial fields on assignment_post_schedule for per-post ledger rows.

ALTER TABLE public.assignment_post_schedule
  ADD COLUMN IF NOT EXISTS revenue_before_vat numeric(14, 2) NOT NULL DEFAULT 0 CHECK (revenue_before_vat >= 0),
  ADD COLUMN IF NOT EXISTS cost_before_vat numeric(14, 2) NOT NULL DEFAULT 0 CHECK (cost_before_vat >= 0),
  ADD COLUMN IF NOT EXISTS revenue_vat_percent numeric(6, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS revenue_vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_vat_percent numeric(6, 3) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_vat_amount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'draft';

-- Backfill one post per deliverable when missing, splitting unit commercial evenly.
INSERT INTO public.assignment_post_schedule (
  assignment_deliverable_id,
  campaign_line_id,
  sequence_number,
  live_date,
  status,
  notes,
  revenue_before_vat,
  cost_before_vat,
  revenue_vat_percent,
  revenue_vat_amount,
  cost_vat_percent,
  cost_vat_amount,
  billing_status
)
SELECT
  ad.id,
  ad.campaign_line_id,
  gs.seq,
  ad.live_date,
  'draft'::public.assignment_post_status,
  ad.notes,
  CASE
    WHEN ad.quantity > 0 THEN round(ad.revenue_before_vat / ad.quantity, 2)
    ELSE ad.revenue_before_vat
  END,
  CASE
    WHEN ad.quantity > 0 THEN round(ad.cost_before_vat / ad.quantity, 2)
    ELSE ad.cost_before_vat
  END,
  ad.revenue_vat_percent,
  CASE
    WHEN ad.quantity > 0 THEN round(ad.revenue_vat_amount / ad.quantity, 2)
    ELSE ad.revenue_vat_amount
  END,
  ad.cost_vat_percent,
  CASE
    WHEN ad.quantity > 0 THEN round(ad.cost_vat_amount / ad.quantity, 2)
    ELSE ad.cost_vat_amount
  END,
  COALESCE(ad.billing_status, 'draft')
FROM public.assignment_deliverables ad
CROSS JOIN LATERAL generate_series(1, GREATEST(ad.quantity, 1)) AS gs(seq)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.assignment_post_schedule ps
  WHERE ps.assignment_deliverable_id = ad.id
);

-- Expand existing schedules to match deliverable quantity when under-counted.
INSERT INTO public.assignment_post_schedule (
  assignment_deliverable_id,
  campaign_line_id,
  sequence_number,
  live_date,
  status,
  revenue_before_vat,
  cost_before_vat,
  revenue_vat_percent,
  revenue_vat_amount,
  cost_vat_percent,
  cost_vat_amount,
  billing_status
)
SELECT
  ad.id,
  ad.campaign_line_id,
  gs.seq,
  ad.live_date,
  'draft'::public.assignment_post_status,
  CASE WHEN ad.quantity > 0 THEN round(ad.revenue_before_vat / ad.quantity, 2) ELSE 0 END,
  CASE WHEN ad.quantity > 0 THEN round(ad.cost_before_vat / ad.quantity, 2) ELSE 0 END,
  ad.revenue_vat_percent,
  CASE WHEN ad.quantity > 0 THEN round(ad.revenue_vat_amount / ad.quantity, 2) ELSE 0 END,
  ad.cost_vat_percent,
  CASE WHEN ad.quantity > 0 THEN round(ad.cost_vat_amount / ad.quantity, 2) ELSE 0 END,
  COALESCE(ad.billing_status, 'draft')
FROM public.assignment_deliverables ad
CROSS JOIN LATERAL generate_series(
  (SELECT count(*)::int FROM public.assignment_post_schedule ps WHERE ps.assignment_deliverable_id = ad.id) + 1,
  GREATEST(ad.quantity, 1)
) AS gs(seq)
WHERE ad.quantity > (
  SELECT count(*) FROM public.assignment_post_schedule ps WHERE ps.assignment_deliverable_id = ad.id
);
