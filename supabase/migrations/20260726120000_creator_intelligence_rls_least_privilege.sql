-- =============================================================================
-- Creator Intelligence RLS least-privilege (SEC-003)
-- Mirrors Finance P0 pattern (20260724150000):
--   is_internal_user() + has_permission(discovery.*|intelligence.read) + FORCE RLS
-- Portal / client_user / influencer JWTs denied on SELECT even via PostgREST.
-- service_role continues to bypass RLS for workers / enrichment / IPL.
-- Development-first; Production requires explicit approval.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Ensure permissions exist (idempotent)
-- -----------------------------------------------------------------------------
INSERT INTO public.permissions (slug, resource, action, description)
VALUES
  ('discovery.read', 'discovery', 'read', 'View discovered influencer profiles and search'),
  ('discovery.write', 'discovery', 'write', 'Manage discovery jobs, lists, and profile promotion'),
  ('discovery.admin', 'discovery', 'admin', 'Run discovery crawlers and enrichment pipelines'),
  ('intelligence.read', 'intelligence', 'read', 'View historical intelligence warehouse and benchmarks')
ON CONFLICT (slug) DO UPDATE
  SET resource = EXCLUDED.resource,
      action = EXCLUDED.action,
      description = EXCLUDED.description,
      updated_at = timezone('utc', now());

-- Internal roles that operate Discovery / DNA / Forecast UIs
WITH role_map AS (SELECT slug, id FROM public.roles),
     perm_map AS (SELECT slug, id FROM public.permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM role_map r
JOIN perm_map p ON p.slug IN (
  'discovery.read',
  'discovery.write',
  'discovery.admin',
  'intelligence.read'
)
WHERE r.slug IN ('super_admin', 'admin', 'account_manager', 'operations', 'finance')
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------------------
-- Helpers (portal roles excluded via is_internal_user)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_read_creator_intelligence()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR (
      public.is_internal_user()
      AND (
        public.has_permission('discovery.read')
        OR public.has_permission('discovery.write')
        OR public.has_permission('discovery.admin')
        OR public.has_permission('intelligence.read')
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_write_creator_intelligence()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_admin()
    OR (
      public.is_internal_user()
      AND (
        public.has_permission('discovery.write')
        OR public.has_permission('discovery.admin')
      )
    );
$$;

-- DNA row owner path: internal staff who created the influencer / discovered profile
CREATE OR REPLACE FUNCTION public.can_write_creator_dna_for_influencer(p_influencer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_write_creator_intelligence()
    OR (
      public.is_internal_user()
      AND p_influencer_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.influencers i
        WHERE i.id = p_influencer_id
          AND i.created_by = auth.uid()
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.can_write_creator_dna_for_discovered(p_discovered_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_write_creator_intelligence()
    OR (
      public.is_internal_user()
      AND p_discovered_profile_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.discovered_profiles dp
        INNER JOIN public.influencers i ON i.id = dp.influencer_id
        WHERE dp.id = p_discovered_profile_id
          AND i.created_by = auth.uid()
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.can_read_creator_intelligence() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_creator_intelligence() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_creator_dna_for_influencer(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_creator_dna_for_discovered(uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- ENABLE + FORCE RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.creator_dna ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_dna_staging ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_dna_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_dna_lineage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_refresh_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_provider_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_reprocess_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_enrichment_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_metrics_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_content_performance_baselines ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.creator_dna FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creator_dna_staging FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creator_dna_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creator_dna_lineage_events FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creator_intelligence FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_refresh_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_provider_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_reprocess_jobs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creator_enrichment_runs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_metrics_history FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creator_content_performance_baselines FORCE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- Drop legacy permissive / write policies
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS creator_dna_read ON public.creator_dna;
DROP POLICY IF EXISTS creator_dna_insert ON public.creator_dna;
DROP POLICY IF EXISTS creator_dna_update ON public.creator_dna;
DROP POLICY IF EXISTS creator_dna_delete ON public.creator_dna;

DROP POLICY IF EXISTS creator_dna_staging_read ON public.creator_dna_staging;
DROP POLICY IF EXISTS creator_dna_staging_insert ON public.creator_dna_staging;
DROP POLICY IF EXISTS creator_dna_staging_update ON public.creator_dna_staging;

DROP POLICY IF EXISTS creator_dna_versions_read ON public.creator_dna_versions;
DROP POLICY IF EXISTS creator_dna_versions_insert ON public.creator_dna_versions;

DROP POLICY IF EXISTS creator_dna_lineage_events_read ON public.creator_dna_lineage_events;
DROP POLICY IF EXISTS creator_dna_lineage_events_insert ON public.creator_dna_lineage_events;

DROP POLICY IF EXISTS creator_intelligence_read ON public.creator_intelligence;

DROP POLICY IF EXISTS ipl_refresh_policies_read ON public.ipl_refresh_policies;
DROP POLICY IF EXISTS ipl_provider_runs_read ON public.ipl_provider_runs;
DROP POLICY IF EXISTS ipl_snapshots_read ON public.ipl_snapshots;
DROP POLICY IF EXISTS ipl_reprocess_jobs_read ON public.ipl_reprocess_jobs;

DROP POLICY IF EXISTS creator_enrichment_runs_read ON public.creator_enrichment_runs;

DROP POLICY IF EXISTS influencer_metrics_history_select_authenticated
  ON public.influencer_metrics_history;
DROP POLICY IF EXISTS creator_content_baselines_select_authenticated
  ON public.creator_content_performance_baselines;

-- -----------------------------------------------------------------------------
-- creator_dna
-- -----------------------------------------------------------------------------
CREATE POLICY creator_dna_select ON public.creator_dna
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

CREATE POLICY creator_dna_insert ON public.creator_dna
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_creator_dna_for_influencer(influencer_id));

CREATE POLICY creator_dna_update ON public.creator_dna
  FOR UPDATE TO authenticated
  USING (public.can_write_creator_dna_for_influencer(influencer_id))
  WITH CHECK (public.can_write_creator_dna_for_influencer(influencer_id));

-- -----------------------------------------------------------------------------
-- creator_dna_staging
-- -----------------------------------------------------------------------------
CREATE POLICY creator_dna_staging_select ON public.creator_dna_staging
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

CREATE POLICY creator_dna_staging_insert ON public.creator_dna_staging
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_write_creator_dna_for_discovered(discovered_profile_id)
    OR public.can_write_creator_dna_for_influencer(promoted_to_influencer_id)
  );

CREATE POLICY creator_dna_staging_update ON public.creator_dna_staging
  FOR UPDATE TO authenticated
  USING (
    public.can_write_creator_dna_for_discovered(discovered_profile_id)
    OR public.can_write_creator_dna_for_influencer(promoted_to_influencer_id)
  )
  WITH CHECK (
    public.can_write_creator_dna_for_discovered(discovered_profile_id)
    OR public.can_write_creator_dna_for_influencer(promoted_to_influencer_id)
  );

-- -----------------------------------------------------------------------------
-- creator_dna_versions (append-only)
-- -----------------------------------------------------------------------------
CREATE POLICY creator_dna_versions_select ON public.creator_dna_versions
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

CREATE POLICY creator_dna_versions_insert ON public.creator_dna_versions
  FOR INSERT TO authenticated
  WITH CHECK (public.can_write_creator_dna_for_influencer(influencer_id));

-- -----------------------------------------------------------------------------
-- creator_dna_lineage_events (append-only)
-- -----------------------------------------------------------------------------
CREATE POLICY creator_dna_lineage_events_select ON public.creator_dna_lineage_events
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

CREATE POLICY creator_dna_lineage_events_insert ON public.creator_dna_lineage_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_write_creator_intelligence()
    OR public.can_write_creator_dna_for_influencer(influencer_id)
    OR public.can_write_creator_dna_for_discovered(discovered_profile_id)
  );

-- -----------------------------------------------------------------------------
-- creator_intelligence + ipl_* + enrichment + forecast baselines (read-only for authn)
-- Writes remain service_role (RLS bypass); no authenticated write policies.
-- -----------------------------------------------------------------------------
CREATE POLICY creator_intelligence_select ON public.creator_intelligence
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

CREATE POLICY ipl_refresh_policies_select ON public.ipl_refresh_policies
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

CREATE POLICY ipl_provider_runs_select ON public.ipl_provider_runs
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

CREATE POLICY ipl_snapshots_select ON public.ipl_snapshots
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

CREATE POLICY ipl_reprocess_jobs_select ON public.ipl_reprocess_jobs
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

CREATE POLICY creator_enrichment_runs_select ON public.creator_enrichment_runs
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

CREATE POLICY influencer_metrics_history_select ON public.influencer_metrics_history
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

CREATE POLICY creator_content_baselines_select ON public.creator_content_performance_baselines
  FOR SELECT TO authenticated
  USING (public.can_read_creator_intelligence());

-- -----------------------------------------------------------------------------
-- Grant hygiene: SELECT for authenticated; DML for service_role only on
-- service-written tables. DNA keeps INSERT/UPDATE for internal write policies.
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE ON public.creator_dna TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_dna TO service_role;
REVOKE DELETE ON public.creator_dna FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON public.creator_dna_staging TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_dna_staging TO service_role;
REVOKE DELETE ON public.creator_dna_staging FROM authenticated;

GRANT SELECT, INSERT ON public.creator_dna_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_dna_versions TO service_role;
REVOKE UPDATE, DELETE ON public.creator_dna_versions FROM authenticated;

GRANT SELECT, INSERT ON public.creator_dna_lineage_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_dna_lineage_events TO service_role;
REVOKE UPDATE, DELETE ON public.creator_dna_lineage_events FROM authenticated;

GRANT SELECT ON public.creator_intelligence TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_intelligence TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.creator_intelligence FROM authenticated;

GRANT SELECT ON public.ipl_refresh_policies TO authenticated;
GRANT SELECT ON public.ipl_provider_runs TO authenticated;
GRANT SELECT ON public.ipl_snapshots TO authenticated;
GRANT SELECT ON public.ipl_reprocess_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ipl_refresh_policies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ipl_provider_runs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ipl_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ipl_reprocess_jobs TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.ipl_refresh_policies FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ipl_provider_runs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ipl_snapshots FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ipl_reprocess_jobs FROM authenticated;

GRANT SELECT ON public.creator_enrichment_runs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_enrichment_runs TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.creator_enrichment_runs FROM authenticated;

GRANT SELECT ON public.influencer_metrics_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.influencer_metrics_history TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.influencer_metrics_history FROM authenticated;

GRANT SELECT ON public.creator_content_performance_baselines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_content_performance_baselines TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.creator_content_performance_baselines FROM authenticated;

COMMENT ON FUNCTION public.can_read_creator_intelligence() IS
  'SEC-003: internal users with discovery.* or intelligence.read may read Creator Intelligence tables';
COMMENT ON FUNCTION public.can_write_creator_intelligence() IS
  'SEC-003: internal users with discovery.write/admin may write Creator Intelligence DNA rows';
