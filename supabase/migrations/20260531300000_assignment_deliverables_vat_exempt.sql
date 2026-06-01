-- VAT exempt flags on assignment deliverables (mirrors campaign_lines VAT governance).

ALTER TABLE public.assignment_deliverables
  ADD COLUMN IF NOT EXISTS revenue_vat_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cost_vat_exempt boolean NOT NULL DEFAULT false;

UPDATE public.assignment_deliverables ad
SET
  revenue_vat_exempt = COALESCE(cl.revenue_vat_exempt, false),
  cost_vat_exempt = COALESCE(cl.cost_vat_exempt, false)
FROM public.campaign_lines cl
WHERE ad.campaign_line_id = cl.id;

COMMENT ON COLUMN public.assignment_deliverables.revenue_vat_exempt IS
  'When true, revenue VAT is not applied to this deliverable at invoice time.';
COMMENT ON COLUMN public.assignment_deliverables.cost_vat_exempt IS
  'When true, cost VAT is not applied to this deliverable.';
