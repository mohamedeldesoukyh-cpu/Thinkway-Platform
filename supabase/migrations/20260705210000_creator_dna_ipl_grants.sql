-- =============================================================================
-- Fix: creator_dna + IPL tables missing PostgREST role grants
--
-- Tables were created with RLS read policies but no GRANT to authenticated /
-- service_role. Worker enrichment (service_role) and Table Editor reads failed
-- with: permission denied for table creator_dna (SQLSTATE 42501).
-- =============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_dna TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_dna_staging TO authenticated, service_role;
GRANT SELECT, INSERT ON public.creator_dna_versions TO authenticated, service_role;
GRANT SELECT, INSERT ON public.creator_dna_lineage_events TO authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ipl_snapshots TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ipl_provider_runs TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ipl_refresh_policies TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ipl_reprocess_jobs TO authenticated, service_role;
