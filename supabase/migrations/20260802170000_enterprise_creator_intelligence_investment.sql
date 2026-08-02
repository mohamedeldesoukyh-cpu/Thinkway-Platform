-- Release 2.3 Phase 1 / Sprint 6 — Enterprise Creator Intelligence
-- Creator Investment Intelligence (append-only investment recommendation history)
-- Target: Development first (hsxrewjcbvmbkqdlzjhs). Production requires explicit approval.
--
-- Extends Sprint 1–5 baselines. Does not alter prior capture tables.
-- Append-only — never UPDATE prior rows in app code.

CREATE TABLE IF NOT EXISTS public.creator_intelligence_investment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  platform text,
  captured_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  overall_score numeric,
  recommendation text,
  intelligence jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_hints jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'investment_compute',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS creator_intelligence_investment_history_lookup_idx
  ON public.creator_intelligence_investment_history (influencer_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS creator_intelligence_investment_history_platform_idx
  ON public.creator_intelligence_investment_history (influencer_id, platform, captured_at DESC)
  WHERE platform IS NOT NULL;

CREATE INDEX IF NOT EXISTS creator_intelligence_investment_history_recommendation_idx
  ON public.creator_intelligence_investment_history (recommendation, captured_at DESC)
  WHERE recommendation IS NOT NULL;

COMMENT ON TABLE public.creator_intelligence_investment_history IS
  'Enterprise Creator Intelligence Sprint 6 — append-only Creator Investment Intelligence captures.';

ALTER TABLE public.creator_intelligence_investment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_intelligence_investment_history_select
  ON public.creator_intelligence_investment_history;
CREATE POLICY creator_intelligence_investment_history_select
  ON public.creator_intelligence_investment_history
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

GRANT SELECT ON public.creator_intelligence_investment_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_intelligence_investment_history TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.creator_intelligence_investment_history FROM authenticated;
