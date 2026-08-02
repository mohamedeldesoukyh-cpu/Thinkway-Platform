-- Release 2.3 Phase 1 / Sprint 2 — Enterprise Creator Intelligence
-- Commercial Intelligence (append-only commercial metric history)
-- Target: Development first (hsxrewjcbvmbkqdlzjhs). Production requires explicit approval.
--
-- Extends Sprint 1 Historical baseline. Does not alter historical capture tables.
-- Commercial history is append-only — never UPDATE prior capture rows in app code.

CREATE TABLE IF NOT EXISTS public.creator_intelligence_commercial_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  platform text,
  captured_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  currency_code text,
  -- Full explainable metric envelopes (current/previous/trend/confidence/source/formula)
  metrics jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_hints jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'commercial_compute',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS creator_intelligence_commercial_history_lookup_idx
  ON public.creator_intelligence_commercial_history (influencer_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS creator_intelligence_commercial_history_platform_idx
  ON public.creator_intelligence_commercial_history (influencer_id, platform, captured_at DESC)
  WHERE platform IS NOT NULL;

COMMENT ON TABLE public.creator_intelligence_commercial_history IS
  'Enterprise Creator Intelligence Sprint 2 — append-only commercial metric captures (CPM/CPE/EMV/ROI/pricing).';

ALTER TABLE public.creator_intelligence_commercial_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_intelligence_commercial_history_select
  ON public.creator_intelligence_commercial_history;
CREATE POLICY creator_intelligence_commercial_history_select
  ON public.creator_intelligence_commercial_history
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

GRANT SELECT ON public.creator_intelligence_commercial_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_intelligence_commercial_history TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.creator_intelligence_commercial_history FROM authenticated;
