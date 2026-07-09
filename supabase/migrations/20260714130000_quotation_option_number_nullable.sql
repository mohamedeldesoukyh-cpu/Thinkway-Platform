-- Allow blank option labels on quotation / shortlist lines.

ALTER TABLE public.quotation_items
  ALTER COLUMN option_number DROP NOT NULL;

ALTER TABLE public.discovery_shortlist_items
  ALTER COLUMN option_number DROP NOT NULL;

COMMENT ON COLUMN public.quotation_items.option_number IS
  'Alternative pricing option for the same creator (1 = Option 1, 2 = Option 2, …). NULL = no option label.';

COMMENT ON COLUMN public.discovery_shortlist_items.option_number IS
  'Synced from quotation when commercial sync is enabled. NULL = no option label.';
