-- =============================================================================
-- Fix: creator_dna tables missing INSERT/UPDATE RLS policies
--
-- Tables had SELECT policies + table grants but no write policies. Authenticated
-- users with discovery.write (or creators they added) hit:
--   new row violates row-level security policy for table creator_dna
--
-- service_role bypasses RLS natively in Supabase (workers use service_role key);
-- grants from 20260705210000_creator_dna_ipl_grants.sql are sufficient for workers.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- creator_dna — keyed by influencers.id
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS creator_dna_insert ON public.creator_dna;
CREATE POLICY creator_dna_insert ON public.creator_dna
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR EXISTS (
      SELECT 1 FROM public.influencers i
      WHERE i.id = influencer_id
        AND i.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS creator_dna_update ON public.creator_dna;
CREATE POLICY creator_dna_update ON public.creator_dna
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR EXISTS (
      SELECT 1 FROM public.influencers i
      WHERE i.id = influencer_id
        AND i.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR EXISTS (
      SELECT 1 FROM public.influencers i
      WHERE i.id = influencer_id
        AND i.created_by = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- creator_dna_staging — pre-promotion DNA for discovered_profiles
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS creator_dna_staging_insert ON public.creator_dna_staging;
CREATE POLICY creator_dna_staging_insert ON public.creator_dna_staging
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR EXISTS (
      SELECT 1 FROM public.discovered_profiles dp
      INNER JOIN public.influencers i ON i.id = dp.influencer_id
      WHERE dp.id = discovered_profile_id
        AND i.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.influencers i
      WHERE i.id = promoted_to_influencer_id
        AND i.created_by = auth.uid()
    )
  );

DROP POLICY IF EXISTS creator_dna_staging_update ON public.creator_dna_staging;
CREATE POLICY creator_dna_staging_update ON public.creator_dna_staging
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR EXISTS (
      SELECT 1 FROM public.discovered_profiles dp
      INNER JOIN public.influencers i ON i.id = dp.influencer_id
      WHERE dp.id = discovered_profile_id
        AND i.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.influencers i
      WHERE i.id = promoted_to_influencer_id
        AND i.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR EXISTS (
      SELECT 1 FROM public.discovered_profiles dp
      INNER JOIN public.influencers i ON i.id = dp.influencer_id
      WHERE dp.id = discovered_profile_id
        AND i.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.influencers i
      WHERE i.id = promoted_to_influencer_id
        AND i.created_by = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- creator_dna_versions — append-only version history
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS creator_dna_versions_insert ON public.creator_dna_versions;
CREATE POLICY creator_dna_versions_insert ON public.creator_dna_versions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR EXISTS (
      SELECT 1 FROM public.influencers i
      WHERE i.id = influencer_id
        AND i.created_by = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- creator_dna_lineage_events — audit trail (influencer or discovered_profile)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS creator_dna_lineage_events_insert ON public.creator_dna_lineage_events;
CREATE POLICY creator_dna_lineage_events_insert ON public.creator_dna_lineage_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
    OR (
      influencer_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.influencers i
        WHERE i.id = influencer_id
          AND i.created_by = auth.uid()
      )
    )
    OR (
      discovered_profile_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.discovered_profiles dp
        INNER JOIN public.influencers i ON i.id = dp.influencer_id
        WHERE dp.id = discovered_profile_id
          AND i.created_by = auth.uid()
      )
    )
  );
