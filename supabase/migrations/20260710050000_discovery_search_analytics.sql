-- Discovery creator search analytics — intent, latency, and interaction events.

CREATE TABLE IF NOT EXISTS public.discovery_search_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  event_type text NOT NULL,
  query text,
  intent_mode text,
  confidence smallint,
  latency_ms integer,
  results_count integer,
  creator_unified_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT discovery_search_analytics_event_type_check CHECK (
    event_type IN (
      'search_executed',
      'creator_clicked',
      'add_missing_creator',
      'search_abandoned'
    )
  ),
  CONSTRAINT discovery_search_analytics_confidence_check CHECK (
    confidence IS NULL OR (confidence >= 0 AND confidence <= 100)
  )
);

CREATE INDEX IF NOT EXISTS discovery_search_analytics_created_at_idx
  ON public.discovery_search_analytics (created_at DESC);

CREATE INDEX IF NOT EXISTS discovery_search_analytics_event_type_idx
  ON public.discovery_search_analytics (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS discovery_search_analytics_user_id_idx
  ON public.discovery_search_analytics (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.discovery_search_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS discovery_search_analytics_insert ON public.discovery_search_analytics;
CREATE POLICY discovery_search_analytics_insert ON public.discovery_search_analytics
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY IF EXISTS discovery_search_analytics_select ON public.discovery_search_analytics;
CREATE POLICY discovery_search_analytics_select ON public.discovery_search_analytics
  FOR SELECT TO authenticated
  USING (
    public.has_permission('discovery.admin')
    OR public.has_permission('analytics.read')
  );

GRANT INSERT ON public.discovery_search_analytics TO authenticated;
GRANT SELECT ON public.discovery_search_analytics TO authenticated;
GRANT ALL ON public.discovery_search_analytics TO service_role;
