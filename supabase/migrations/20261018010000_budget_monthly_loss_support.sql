-- Monthly plans can include a loss; never clamp gross profit to zero.
ALTER TABLE public.budget_lines DROP CONSTRAINT IF EXISTS budget_lines_amounts_non_negative;
ALTER TABLE public.budget_lines ADD CONSTRAINT budget_lines_amounts_non_negative CHECK (
  revenue_budget >= 0 AND cost_budget >= 0 AND collections_budget >= 0
  AND vendor_cost_budget >= 0 AND po_budget >= 0
);
ALTER TABLE public.budget_lines DROP CONSTRAINT IF EXISTS budget_lines_margin_range;
ALTER TABLE public.budget_lines ADD CONSTRAINT budget_lines_margin_range CHECK (margin_budget <= 100);
