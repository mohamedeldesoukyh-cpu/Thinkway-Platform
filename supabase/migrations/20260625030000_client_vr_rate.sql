-- Default VR% on legal entity; brands override via brands.vr_rate_id when set.
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS vr_rate_id uuid REFERENCES public.md_vr_rates (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.clients.vr_rate_id IS
  'Default vendor rebate % for brands under this legal entity. Brands with vr_rate_id set override; null brand rate inherits this value.';

CREATE INDEX IF NOT EXISTS clients_vr_rate_id_idx ON public.clients (vr_rate_id);
