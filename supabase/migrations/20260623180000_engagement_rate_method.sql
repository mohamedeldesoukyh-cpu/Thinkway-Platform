-- Persist engagement rate calculation method on campaign publications.
ALTER TABLE public.campaign_publications
  ADD COLUMN IF NOT EXISTS engagement_rate_method text;

COMMENT ON COLUMN public.campaign_publications.engagement_rate_method IS
  'How engagement_rate was calculated: views, reach, followers, manual, unknown';

CREATE INDEX IF NOT EXISTS campaign_publications_engagement_rate_method_idx
  ON public.campaign_publications (engagement_rate_method)
  WHERE engagement_rate_method IS NOT NULL;
