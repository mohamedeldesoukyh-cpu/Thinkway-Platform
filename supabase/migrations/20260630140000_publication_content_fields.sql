-- Publication content enrichment: counts and manual-edit source tracking.

ALTER TABLE public.campaign_publications
  ADD COLUMN IF NOT EXISTS hashtag_count integer,
  ADD COLUMN IF NOT EXISTS mention_count integer,
  ADD COLUMN IF NOT EXISTS caption_source text,
  ADD COLUMN IF NOT EXISTS hashtags_source text,
  ADD COLUMN IF NOT EXISTS mentions_source text;

COMMENT ON COLUMN public.campaign_publications.hashtag_count IS
  'Denormalized count of hashtags (synced or manual).';
COMMENT ON COLUMN public.campaign_publications.mention_count IS
  'Denormalized count of mentions (synced or manual).';
COMMENT ON COLUMN public.campaign_publications.caption_source IS
  'Origin of caption: sync (provider), derived (parsed), manual (user edit).';
COMMENT ON COLUMN public.campaign_publications.hashtags_source IS
  'Origin of hashtags: sync, derived, manual.';
COMMENT ON COLUMN public.campaign_publications.mentions_source IS
  'Origin of mentions: sync, derived, manual.';
