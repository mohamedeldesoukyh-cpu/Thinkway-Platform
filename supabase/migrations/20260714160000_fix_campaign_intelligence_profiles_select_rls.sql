-- Ensure creators can always read profiles they own (RETURNING after insert, library refresh).

DROP POLICY IF EXISTS campaign_intelligence_profiles_select ON public.campaign_intelligence_profiles;
CREATE POLICY campaign_intelligence_profiles_select ON public.campaign_intelligence_profiles
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR public.can_access_campaign_intelligence_profile(id)
  );
