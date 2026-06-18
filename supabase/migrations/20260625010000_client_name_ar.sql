-- Optional Arabic client name on legal entities

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS name_ar text;

COMMENT ON COLUMN public.clients.name_ar IS
  'Optional Arabic display / legal name for the client legal entity';
