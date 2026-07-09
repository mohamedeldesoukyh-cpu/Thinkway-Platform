-- Allow discovery.read users to create intelligence profiles for brands they can access.
-- Upload flow inserts documents for any authenticated user; profile insert previously
-- required discovery.write/ai.write only, blocking "Create new" after brand selection.

DROP POLICY IF EXISTS campaign_intelligence_profiles_insert ON public.campaign_intelligence_profiles;
CREATE POLICY campaign_intelligence_profiles_insert ON public.campaign_intelligence_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND brand_id IS NOT NULL
    AND (
      public.can_write_campaign_intelligence_profile(brand_id, campaign_header_id)
      OR (
        public.can_access_brand(brand_id)
        AND public.has_permission('discovery.read')
      )
    )
  );
