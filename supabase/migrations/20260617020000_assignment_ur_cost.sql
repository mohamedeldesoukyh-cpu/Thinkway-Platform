-- Usage rights cost (UR Cost) — creator-side usage rights paid on assignments and deliverables.
-- GP = (Revenue + UR Rev + AF) - Cost - UR Cost; billing/VAT unchanged.

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS usage_rights_cost numeric(12, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.assignment_deliverables
  ADD COLUMN IF NOT EXISTS usage_rights_cost numeric(12, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.campaign_lines.usage_rights_cost IS
  'Usage rights cost paid to creator (deducted from GP).';
COMMENT ON COLUMN public.assignment_deliverables.usage_rights_cost IS
  'Per-deliverable usage rights cost paid to creator (deducted from GP).';
