-- Allow discovery users to delete creators they added via profile link (wrong URL cleanup).
-- Admins retain influencers_delete (admin + influencers.delete). This policy ORs with it.

DROP POLICY IF EXISTS influencers_delete_discovery_owner ON public.influencers;
CREATE POLICY influencers_delete_discovery_owner ON public.influencers
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    AND (
      public.has_permission('discovery.write')
      OR public.has_permission('discovery.admin')
    )
    AND coalesce(notes, '') ILIKE '%discovery profile link%'
  );
