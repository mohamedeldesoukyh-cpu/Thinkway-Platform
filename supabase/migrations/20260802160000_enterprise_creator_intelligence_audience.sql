-- Release 2.3 Phase 1 / Sprint 5 — Enterprise Creator Intelligence
-- Audience Intelligence (append-only audience behaviour history)
-- Target: Development first (hsxrewjcbvmbkqdlzjhs). Production requires explicit approval.
--
-- Extends Sprint 1–4 baselines. Does not alter prior capture tables.
-- Append-only — never UPDATE prior rows in app code.

CREATE TABLE IF NOT EXISTS public.creator_intelligence_audience_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  platform text,
  captured_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  intelligence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_hints jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'audience_compute',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS creator_intelligence_audience_history_lookup_idx
  ON public.creator_intelligence_audience_history (influencer_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS creator_intelligence_audience_history_platform_idx
  ON public.creator_intelligence_audience_history (influencer_id, platform, captured_at DESC)
  WHERE platform IS NOT NULL;

COMMENT ON TABLE public.creator_intelligence_audience_history IS
  'Enterprise Creator Intelligence Sprint 5 — append-only Audience Intelligence captures.';

ALTER TABLE public.creator_intelligence_audience_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_intelligence_audience_history_select
  ON public.creator_intelligence_audience_history;
CREATE POLICY creator_intelligence_audience_history_select
  ON public.creator_intelligence_audience_history
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

GRANT SELECT ON public.creator_intelligence_audience_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_intelligence_audience_history TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.creator_intelligence_audience_history FROM authenticated;
