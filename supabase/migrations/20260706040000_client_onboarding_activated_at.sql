-- Client activation timestamp when onboarding reaches active (all checklist sections complete).

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

COMMENT ON COLUMN public.clients.activated_at IS 'When the client was fully activated after onboarding (all checklist sections complete).';
