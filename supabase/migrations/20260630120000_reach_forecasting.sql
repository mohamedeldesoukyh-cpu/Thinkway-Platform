-- Reach forecasting & transparency on campaign_publications.
--
-- Priority (application layer):
--   1. Manual reach (reach_source = 'manual')
--   2. Actual provider reach (reach_source = 'actual', actual_reach populated)
--   3. Forecast from followers × content-type multiplier (reach_source = 'forecast')
--   4. Null
--
-- When provider reach arrives after a forecast, reach + reach_source switch to actual;
-- forecast_reach is retained for audit. Clients always see Actual vs Forecasted vs Manual.

ALTER TABLE public.campaign_publications
  ADD COLUMN IF NOT EXISTS reach_source text DEFAULT 'actual',
  ADD COLUMN IF NOT EXISTS forecast_reach numeric,
  ADD COLUMN IF NOT EXISTS actual_reach numeric;

COMMENT ON COLUMN public.campaign_publications.reach_source IS
  'How reach was determined: actual (provider), forecast (followers estimate), manual (user override).';
COMMENT ON COLUMN public.campaign_publications.forecast_reach IS
  'Follower-based reach estimate; retained when actual provider reach replaces forecast.';
COMMENT ON COLUMN public.campaign_publications.actual_reach IS
  'Reach reported by metrics provider; null when only forecast or manual is used.';

-- Backfill: existing rows with reach are treated as actual provider/manual values.
UPDATE public.campaign_publications
SET
  reach_source = COALESCE(reach_source, 'actual'),
  actual_reach = COALESCE(actual_reach, reach)
WHERE reach IS NOT NULL
  AND (actual_reach IS NULL OR reach_source IS NULL);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'campaign_publications_reach_source_check'
  ) THEN
    ALTER TABLE public.campaign_publications
      ADD CONSTRAINT campaign_publications_reach_source_check
      CHECK (reach_source IS NULL OR reach_source IN ('actual', 'forecast', 'manual'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS campaign_publications_reach_source_idx
  ON public.campaign_publications (campaign_header_id, reach_source)
  WHERE reach_source IS NOT NULL;
