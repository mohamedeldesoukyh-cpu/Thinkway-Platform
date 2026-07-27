-- =============================================================================
-- ROLLBACK: Creator Intelligence RLS least-privilege (SEC-003)
-- Restores pre-hardening SELECT USING (true) policies and clears FORCE RLS.
-- Manual apply only — NOT auto-run by supabase migration up.
-- Development: use only if forward migration must be undone.
-- NEVER apply to Production without explicit approval.
-- =============================================================================

DROP POLICY IF EXISTS creator_dna_select ON public.creator_dna;
DROP POLICY IF EXISTS creator_dna_insert ON public.creator_dna;
DROP POLICY IF EXISTS creator_dna_update ON public.creator_dna;

DROP POLICY IF EXISTS creator_dna_staging_select ON public.creator_dna_staging;
DROP POLICY IF EXISTS creator_dna_staging_insert ON public.creator_dna_staging;
DROP POLICY IF EXISTS creator_dna_staging_update ON public.creator_dna_staging;

DROP POLICY IF EXISTS creator_dna_versions_select ON public.creator_dna_versions;
DROP POLICY IF EXISTS creator_dna_versions_insert ON public.creator_dna_versions;

DROP POLICY IF EXISTS creator_dna_lineage_events_select ON public.creator_dna_lineage_events;
DROP POLICY IF EXISTS creator_dna_lineage_events_insert ON public.creator_dna_lineage_events;

DROP POLICY IF EXISTS creator_intelligence_select ON public.creator_intelligence;
DROP POLICY IF EXISTS ipl_refresh_policies_select ON public.ipl_refresh_policies;
DROP POLICY IF EXISTS ipl_provider_runs_select ON public.ipl_provider_runs;
DROP POLICY IF EXISTS ipl_snapshots_select ON public.ipl_snapshots;
DROP POLICY IF EXISTS ipl_reprocess_jobs_select ON public.ipl_reprocess_jobs;
DROP POLICY IF EXISTS creator_enrichment_runs_select ON public.creator_enrichment_runs;
DROP POLICY IF EXISTS influencer_metrics_history_select ON public.influencer_metrics_history;
DROP POLICY IF EXISTS creator_content_baselines_select
  ON public.creator_content_performance_baselines;

DROP FUNCTION IF EXISTS public.can_write_creator_dna_for_discovered(uuid);
DROP FUNCTION IF EXISTS public.can_write_creator_dna_for_influencer(uuid);
DROP FUNCTION IF EXISTS public.can_write_creator_intelligence();
DROP FUNCTION IF EXISTS public.can_read_creator_intelligence();

ALTER TABLE public.creator_dna NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creator_dna_staging NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creator_dna_versions NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creator_dna_lineage_events NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creator_intelligence NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_refresh_policies NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_provider_runs NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_snapshots NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ipl_reprocess_jobs NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creator_enrichment_runs NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_metrics_history NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creator_content_performance_baselines NO FORCE ROW LEVEL SECURITY;

-- Restore legacy permissive SELECT + DNA write policies
CREATE POLICY creator_dna_read ON public.creator_dna
  FOR SELECT TO authenticated USING (true);
CREATE POLICY creator_dna_staging_read ON public.creator_dna_staging
  FOR SELECT TO authenticated USING (true);
CREATE POLICY creator_dna_versions_read ON public.creator_dna_versions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY creator_dna_lineage_events_read ON public.creator_dna_lineage_events
  FOR SELECT TO authenticated USING (true);

CREATE POLICY creator_dna_insert ON public.creator_dna
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR EXISTS (
      SELECT 1 FROM public.influencers i
      WHERE i.id = influencer_id AND i.created_by = auth.uid()
    )
  );

CREATE POLICY creator_dna_update ON public.creator_dna
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR EXISTS (
      SELECT 1 FROM public.influencers i
      WHERE i.id = influencer_id AND i.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR EXISTS (
      SELECT 1 FROM public.influencers i
      WHERE i.id = influencer_id AND i.created_by = auth.uid()
    )
  );

CREATE POLICY creator_dna_staging_insert ON public.creator_dna_staging
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR EXISTS (
      SELECT 1 FROM public.discovered_profiles dp
      INNER JOIN public.influencers i ON i.id = dp.influencer_id
      WHERE dp.id = discovered_profile_id AND i.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.influencers i
      WHERE i.id = promoted_to_influencer_id AND i.created_by = auth.uid()
    )
  );

CREATE POLICY creator_dna_staging_update ON public.creator_dna_staging
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR EXISTS (
      SELECT 1 FROM public.discovered_profiles dp
      INNER JOIN public.influencers i ON i.id = dp.influencer_id
      WHERE dp.id = discovered_profile_id AND i.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.influencers i
      WHERE i.id = promoted_to_influencer_id AND i.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR EXISTS (
      SELECT 1 FROM public.discovered_profiles dp
      INNER JOIN public.influencers i ON i.id = dp.influencer_id
      WHERE dp.id = discovered_profile_id AND i.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.influencers i
      WHERE i.id = promoted_to_influencer_id AND i.created_by = auth.uid()
    )
  );

CREATE POLICY creator_dna_versions_insert ON public.creator_dna_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR EXISTS (
      SELECT 1 FROM public.influencers i
      WHERE i.id = influencer_id AND i.created_by = auth.uid()
    )
  );

CREATE POLICY creator_dna_lineage_events_insert ON public.creator_dna_lineage_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR (
      influencer_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.influencers i
        WHERE i.id = influencer_id AND i.created_by = auth.uid()
      )
    )
    OR (
      discovered_profile_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.discovered_profiles dp
        INNER JOIN public.influencers i ON i.id = dp.influencer_id
        WHERE dp.id = discovered_profile_id AND i.created_by = auth.uid()
      )
    )
  );

CREATE POLICY creator_intelligence_read ON public.creator_intelligence
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ipl_refresh_policies_read ON public.ipl_refresh_policies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ipl_provider_runs_read ON public.ipl_provider_runs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ipl_snapshots_read ON public.ipl_snapshots
  FOR SELECT TO authenticated USING (true);
CREATE POLICY ipl_reprocess_jobs_read ON public.ipl_reprocess_jobs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY creator_enrichment_runs_read ON public.creator_enrichment_runs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY influencer_metrics_history_select_authenticated
  ON public.influencer_metrics_history FOR SELECT TO authenticated USING (true);
CREATE POLICY creator_content_baselines_select_authenticated
  ON public.creator_content_performance_baselines FOR SELECT TO authenticated USING (true);

-- Restore broad grants (pre-hardening)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_dna TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_dna_staging TO authenticated, service_role;
GRANT SELECT, INSERT ON public.creator_dna_versions TO authenticated, service_role;
GRANT SELECT, INSERT ON public.creator_dna_lineage_events TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_intelligence TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ipl_snapshots TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ipl_provider_runs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ipl_refresh_policies TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ipl_reprocess_jobs TO authenticated, service_role;

DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20260726120000';
