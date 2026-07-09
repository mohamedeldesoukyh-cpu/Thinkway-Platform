-- Release 1.2 Phase 1 — discovery coverage audit trail (DB vs Apify decisions).

CREATE TABLE IF NOT EXISTS public.discovery_coverage_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id uuid NOT NULL,
  timestamp timestamptz NOT NULL DEFAULT timezone('utc', now()),
  search_query jsonb NOT NULL DEFAULT '{}'::jsonb,
  coverage_score smallint NOT NULL,
  coverage_level text NOT NULL,
  database_creators_count integer NOT NULL DEFAULT 0,
  apify_executed boolean NOT NULL DEFAULT false,
  reason text NOT NULL DEFAULT '',
  duration_ms integer,
  CONSTRAINT discovery_coverage_decisions_score_check CHECK (
    coverage_score >= 0 AND coverage_score <= 100
  ),
  CONSTRAINT discovery_coverage_decisions_level_check CHECK (
    coverage_level IN ('excellent', 'good', 'partial', 'insufficient')
  ),
  CONSTRAINT discovery_coverage_decisions_count_check CHECK (
    database_creators_count >= 0
  )
);

CREATE INDEX IF NOT EXISTS discovery_coverage_decisions_search_id_idx
  ON public.discovery_coverage_decisions (search_id);

CREATE INDEX IF NOT EXISTS discovery_coverage_decisions_timestamp_idx
  ON public.discovery_coverage_decisions (timestamp DESC);

CREATE INDEX IF NOT EXISTS discovery_coverage_decisions_level_idx
  ON public.discovery_coverage_decisions (coverage_level, timestamp DESC);

ALTER TABLE public.discovery_coverage_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS discovery_coverage_decisions_insert ON public.discovery_coverage_decisions;
CREATE POLICY discovery_coverage_decisions_insert ON public.discovery_coverage_decisions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR public.has_permission('ai.workspace')
  );

DROP POLICY IF EXISTS discovery_coverage_decisions_select ON public.discovery_coverage_decisions;
CREATE POLICY discovery_coverage_decisions_select ON public.discovery_coverage_decisions
  FOR SELECT TO authenticated
  USING (
    public.has_permission('discovery.admin')
    OR public.has_permission('analytics.read')
    OR public.has_permission('ai.workspace')
  );

GRANT INSERT ON public.discovery_coverage_decisions TO authenticated;
GRANT SELECT ON public.discovery_coverage_decisions TO authenticated;
GRANT ALL ON public.discovery_coverage_decisions TO service_role;

COMMENT ON TABLE public.discovery_coverage_decisions IS
  'Release 1.2 — audit of database-first discovery coverage evaluation vs Apify fallback per search execution.';
