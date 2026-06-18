-- Ensure clients.vr_rate_id exists and has an explicit FK for PostgREST embeds.
-- The prior migration used ADD COLUMN IF NOT EXISTS with inline REFERENCES; if the
-- column already existed without a constraint, the FK was skipped and embeds fail.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS vr_rate_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.clients'::regclass
      AND conname = 'clients_vr_rate_id_fkey'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_vr_rate_id_fkey
      FOREIGN KEY (vr_rate_id) REFERENCES public.md_vr_rates (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS clients_vr_rate_id_idx ON public.clients (vr_rate_id);

COMMENT ON COLUMN public.clients.vr_rate_id IS
  'Default vendor rebate % for brands under this legal entity. Brands with vr_rate_id set override; null brand rate inherits this value.';
