-- Allow discovery operators to delete creators when the app confirms no blockers.
-- Replaces owner-only + profile-link marker policy.

DROP POLICY IF EXISTS influencers_delete_discovery_owner ON public.influencers;
CREATE POLICY influencers_delete_discovery_operators ON public.influencers
  FOR DELETE TO authenticated
  USING (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  );
