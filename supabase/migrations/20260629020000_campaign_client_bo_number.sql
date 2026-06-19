-- Client BO number on campaign header (optional commercial reference)
-- Idempotent

ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS client_bo_number text;

COMMENT ON COLUMN public.campaign_headers.client_bo_number IS
  'Optional client booking order reference number at campaign header level.';
