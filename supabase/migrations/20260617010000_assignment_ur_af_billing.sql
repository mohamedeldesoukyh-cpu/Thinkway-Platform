-- Usage Rights (UR) and Agency Fees (AF) on assignments and child deliverables.
-- VAT base = Revenue + UR + AF; Total billing = base + VAT; GP = base - cost.

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS usage_rights_amount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agency_fee_percent numeric(6, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agency_fee_amount numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.assignment_deliverables
  ADD COLUMN IF NOT EXISTS usage_rights_amount numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agency_fee_percent numeric(6, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agency_fee_amount numeric(14, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.campaign_lines.usage_rights_amount IS
  'Manual usage rights fee (client billing).';
COMMENT ON COLUMN public.campaign_lines.agency_fee_percent IS
  'Agency fee percentage applied to (revenue + usage rights).';
COMMENT ON COLUMN public.campaign_lines.agency_fee_amount IS
  'Computed agency fee: (revenue + usage_rights_amount) * agency_fee_percent / 100.';
