BEGIN;
SET LOCAL lock_timeout = '5s';
-- Commercial revisions already project these master fields to quotations.
-- Keep existing rows NULL: do not invent or backfill historical VAT/UR values.
ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS usage_rights_amount numeric,
  ADD COLUMN IF NOT EXISTS usage_rights_cost numeric,
  ADD COLUMN IF NOT EXISTS revenue_vat_percent numeric,
  ADD COLUMN IF NOT EXISTS cost_vat_percent numeric,
  ADD COLUMN IF NOT EXISTS revenue_vat_exempt boolean,
  ADD COLUMN IF NOT EXISTS cost_vat_exempt boolean;
NOTIFY pgrst, 'reload schema';
COMMIT;
