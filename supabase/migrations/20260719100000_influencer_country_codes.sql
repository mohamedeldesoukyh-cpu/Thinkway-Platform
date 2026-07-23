-- Multi-country creator locations (bio-inferred + enrichment). Primary filter column stays country_code.
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS country_codes text[];

COMMENT ON COLUMN public.influencers.country_codes IS
  'All creator location countries (ISO-3166-1 alpha-2). country_code holds the primary code for filters.';
