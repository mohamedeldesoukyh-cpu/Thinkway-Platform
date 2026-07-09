-- Quotation line options: alternative pricing scenarios + free-text service scope.

ALTER TABLE public.quotation_items
  ADD COLUMN IF NOT EXISTS option_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS service_description text;

COMMENT ON COLUMN public.quotation_items.option_number IS
  'Alternative pricing option for the same creator (1 = Option 1, 2 = Option 2, …).';
COMMENT ON COLUMN public.quotation_items.service_description IS
  'Free-text service scope shown on client quotation documents.';

ALTER TABLE public.discovery_shortlist_items
  ADD COLUMN IF NOT EXISTS option_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS service_description text;

COMMENT ON COLUMN public.discovery_shortlist_items.option_number IS
  'Synced from quotation when commercial sync is enabled.';
COMMENT ON COLUMN public.discovery_shortlist_items.service_description IS
  'Free-text service scope synced from quotation / shortlist commercial tab.';
