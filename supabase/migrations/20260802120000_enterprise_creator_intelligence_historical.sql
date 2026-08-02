-- Release 2.3 Phase 1 / Sprint 1 — Enterprise Creator Intelligence
-- Historical Creator Intelligence (monthly time-series)
-- Target: Development first (hsxrewjcbvmbkqdlzjhs). Production requires explicit approval.
--
-- Raw captures remain append-only on influencer_metrics_history.
-- Monthly series is a derived projection (unique per creator × platform × month)
-- recomputed from append-only captures without deleting prior capture rows.

-- ---------------------------------------------------------------------------
-- Extend raw capture series (append-only — never UPDATE existing rows in app code)
-- ---------------------------------------------------------------------------

ALTER TABLE public.influencer_metrics_history
  ADD COLUMN IF NOT EXISTS following bigint,
  ADD COLUMN IF NOT EXISTS posts_count bigint,
  ADD COLUMN IF NOT EXISTS median_views bigint;

COMMENT ON COLUMN public.influencer_metrics_history.following IS
  'Following count at capture time (Enterprise Creator Intelligence).';
COMMENT ON COLUMN public.influencer_metrics_history.posts_count IS
  'Total posts at capture time.';
COMMENT ON COLUMN public.influencer_metrics_history.median_views IS
  'Median views from recent publications sample at capture time.';

-- ---------------------------------------------------------------------------
-- Monthly historical series (Enterprise Creator Intelligence SSOT for months)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.creator_intelligence_monthly_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  platform text NOT NULL,
  -- First day of the UTC month (e.g. 2026-07-01)
  period_month date NOT NULL,
  followers bigint,
  following bigint,
  posts_count bigint,
  avg_views numeric(14, 2),
  median_views numeric(14, 2),
  engagement_rate numeric(8, 4),
  posting_frequency_per_week numeric(8, 3),
  -- Derived vs prior month (null for first observed month)
  monthly_growth_rate numeric(10, 6),
  follower_difference bigint,
  sample_capture_count integer NOT NULL DEFAULT 1 CHECK (sample_capture_count >= 0),
  source text NOT NULL DEFAULT 'enrichment_capture',
  ipl_snapshot_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  computed_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT creator_intelligence_monthly_metrics_unique
    UNIQUE (influencer_id, platform, period_month)
);

CREATE INDEX IF NOT EXISTS creator_intelligence_monthly_metrics_lookup_idx
  ON public.creator_intelligence_monthly_metrics (influencer_id, platform, period_month DESC);

CREATE INDEX IF NOT EXISTS creator_intelligence_monthly_metrics_month_idx
  ON public.creator_intelligence_monthly_metrics (period_month DESC);

COMMENT ON TABLE public.creator_intelligence_monthly_metrics IS
  'Enterprise Creator Intelligence — monthly historical metrics (time-series). Raw captures stay append-only; monthly rows are projections.';

ALTER TABLE public.creator_intelligence_monthly_metrics ENABLE ROW LEVEL SECURITY;

-- Readers: same gate as other creator intelligence tables.
-- Writers: service_role (IPL / enrichment capture path). Authenticated DML not granted.
DROP POLICY IF EXISTS creator_intelligence_monthly_metrics_select ON public.creator_intelligence_monthly_metrics;
CREATE POLICY creator_intelligence_monthly_metrics_select
  ON public.creator_intelligence_monthly_metrics
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

GRANT SELECT ON public.creator_intelligence_monthly_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_intelligence_monthly_metrics TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.creator_intelligence_monthly_metrics FROM authenticated;
