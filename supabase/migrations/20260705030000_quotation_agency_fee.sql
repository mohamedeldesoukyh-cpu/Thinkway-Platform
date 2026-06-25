-- =============================================================================
-- Quotation Agency Fee (AF) — per-line AF% / AF value + header totals
-- Additive + idempotent. NOT auto-applied.
--
-- Formula (matches campaign client billing):
--   AF Value  = Client cost (revenue) × (AF% / 100)
--   Agency margin (Total GP) = GP Value + AF Value
-- =============================================================================

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS af_pct numeric(7, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS af_value numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS af_value_egp numeric(14, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.quotation_items.af_pct IS
  'Agency fee percentage applied to client cost (revenue). Stored as percent (e.g. 10 = 10%).';
COMMENT ON COLUMN public.quotation_items.af_value IS
  'Agency fee in line entry currency: revenue × (af_pct / 100).';
COMMENT ON COLUMN public.quotation_items.af_value_egp IS
  'Agency fee converted to EGP via fx_rate_to_egp.';

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS total_af_egp numeric(14, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_agency_margin_egp numeric(14, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.quotations.total_af_egp IS
  'Sum of quotation_items.af_value_egp (agency fees on client cost).';
COMMENT ON COLUMN public.quotations.total_agency_margin_egp IS
  'Total GP + total AF in EGP (full agency margin on the quotation).';
