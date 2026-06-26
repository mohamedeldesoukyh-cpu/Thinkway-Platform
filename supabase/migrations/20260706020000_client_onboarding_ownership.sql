-- Client ownership fields for quotation promote-to-master-data onboarding wizard.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_owner_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS country_manager_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS clients_client_owner_id_idx ON public.clients (client_owner_id);
CREATE INDEX IF NOT EXISTS clients_country_manager_id_idx ON public.clients (country_manager_id);

COMMENT ON COLUMN public.clients.client_owner_id IS 'Primary client relationship owner (onboarding).';
COMMENT ON COLUMN public.clients.country_manager_id IS 'Country manager assigned during client onboarding.';
COMMENT ON COLUMN public.clients.account_manager_id IS 'Commercial / account manager (maps to Commercial Owner in promote wizard).';
