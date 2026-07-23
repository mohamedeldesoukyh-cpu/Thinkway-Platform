-- Phase 3 — Unified Forecast Data Foundation
-- Adds internal creator metrics history + reusable performance baselines.
-- Idempotent & additive. Does not modify Discovery, DNA, or campaign execution.

-- -----------------------------------------------------------------------------
-- Internal creator metrics time-series (mirrors profile_metrics for inf: creators)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.influencer_metrics_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  platform text,
  followers bigint,
  engagement_rate numeric(6, 3),
  avg_views bigint,
  posting_frequency_per_week numeric(6, 2),
  captured_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  source text NOT NULL DEFAULT 'enrichment_sync',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS influencer_metrics_history_influencer_captured_idx
  ON public.influencer_metrics_history (influencer_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS influencer_metrics_history_platform_idx
  ON public.influencer_metrics_history (influencer_id, platform, captured_at DESC)
  WHERE platform IS NOT NULL;

COMMENT ON TABLE public.influencer_metrics_history IS
  'Time-series creator metrics for internal influencers — feeds Forecast Profile historicalPerformance.';

-- -----------------------------------------------------------------------------
-- Reusable creator performance baselines (platform × content type)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_content_performance_baselines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid REFERENCES public.influencers (id) ON DELETE CASCADE,
  discovered_profile_id uuid REFERENCES public.discovered_profiles (id) ON DELETE CASCADE,
  platform text NOT NULL,
  content_type text NOT NULL,
  sample_count integer NOT NULL DEFAULT 0 CHECK (sample_count >= 0),
  avg_reach numeric(14, 2),
  avg_views numeric(14, 2),
  avg_impressions numeric(14, 2),
  avg_engagements numeric(14, 2),
  avg_engagement_rate numeric(6, 3),
  confidence numeric(5, 2),
  data_source text NOT NULL DEFAULT 'blended',
  oldest_sample_at timestamptz,
  newest_sample_at timestamptz,
  computed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  baseline_version text NOT NULL DEFAULT 'baseline_v1',
  CONSTRAINT creator_content_baselines_owner_chk CHECK (
    influencer_id IS NOT NULL OR discovered_profile_id IS NOT NULL
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS creator_content_baselines_unique_inf_idx
  ON public.creator_content_performance_baselines (influencer_id, platform, content_type)
  WHERE influencer_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS creator_content_baselines_unique_dis_idx
  ON public.creator_content_performance_baselines (discovered_profile_id, platform, content_type)
  WHERE discovered_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS creator_content_baselines_lookup_inf_idx
  ON public.creator_content_performance_baselines (influencer_id, platform);

CREATE INDEX IF NOT EXISTS creator_content_baselines_lookup_dis_idx
  ON public.creator_content_performance_baselines (discovered_profile_id, platform);

COMMENT ON TABLE public.creator_content_performance_baselines IS
  'Normalized creator performance baselines for Campaign Forecast Profile forecastBaselines.';

-- -----------------------------------------------------------------------------
-- RLS (read for authenticated; write via service_role / enrichment jobs)
-- -----------------------------------------------------------------------------
ALTER TABLE public.influencer_metrics_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_content_performance_baselines ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'influencer_metrics_history'
      AND policyname = 'influencer_metrics_history_select_authenticated'
  ) THEN
    CREATE POLICY influencer_metrics_history_select_authenticated
      ON public.influencer_metrics_history FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'creator_content_performance_baselines'
      AND policyname = 'creator_content_baselines_select_authenticated'
  ) THEN
    CREATE POLICY creator_content_baselines_select_authenticated
      ON public.creator_content_performance_baselines FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

GRANT SELECT ON public.influencer_metrics_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.influencer_metrics_history TO service_role;

GRANT SELECT ON public.creator_content_performance_baselines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_content_performance_baselines TO service_role;
