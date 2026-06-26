-- Impressions forecasting & transparency on campaign_publications.
--
-- Priority (application layer):
--   1. Manual impressions (impressions_source = 'manual')
--   2. Actual provider impressions (impressions_source = 'actual', actual_impressions populated)
--   3. Forecast from views/reach multipliers (impressions_source = 'forecast')
--   4. Null

ALTER TABLE public.campaign_publications
  ADD COLUMN IF NOT EXISTS impressions_source text DEFAULT 'actual',
  ADD COLUMN IF NOT EXISTS forecast_impressions numeric,
  ADD COLUMN IF NOT EXISTS actual_impressions numeric;

COMMENT ON COLUMN public.campaign_publications.impressions_source IS
  'How impressions were determined: actual (provider), forecast (views/reach estimate), manual (user override).';
COMMENT ON COLUMN public.campaign_publications.forecast_impressions IS
  'Estimated impressions from views/reach multipliers; retained when actual provider impressions replace forecast.';
COMMENT ON COLUMN public.campaign_publications.actual_impressions IS
  'Impressions reported by metrics provider; null when only forecast or manual is used.';

UPDATE public.campaign_publications
SET
  impressions_source = COALESCE(impressions_source, 'actual'),
  actual_impressions = COALESCE(actual_impressions, impressions)
WHERE impressions IS NOT NULL
  AND (actual_impressions IS NULL OR impressions_source IS NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_publications_impressions_source_check'
  ) THEN
    ALTER TABLE public.campaign_publications
      ADD CONSTRAINT campaign_publications_impressions_source_check
      CHECK (impressions_source IS NULL OR impressions_source IN ('actual', 'forecast', 'manual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS campaign_publications_impressions_source_idx
  ON public.campaign_publications (campaign_header_id, impressions_source)
  WHERE impressions_source IS NOT NULL;
