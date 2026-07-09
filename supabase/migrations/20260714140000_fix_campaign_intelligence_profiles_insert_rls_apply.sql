-- Re-apply campaign_intelligence_profiles INSERT RLS.
--
-- 20260714120000_fix_campaign_intelligence_profiles_insert_rls.sql never ran on
-- linked remotes: that version slot was consumed by quotation_option_number_nullable
-- before the duplicate timestamp was renamed to 20260714130000.
--
-- Discovery Search upload → brand link → Create new requires INSERT for users who
-- can access the brand (same rule as the brand picker) without discovery.write.

DROP POLICY IF EXISTS campaign_intelligence_profiles_insert ON public.campaign_intelligence_profiles;
CREATE POLICY campaign_intelligence_profiles_insert ON public.campaign_intelligence_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND brand_id IS NOT NULL
    AND (
      public.can_write_campaign_intelligence_profile(brand_id, campaign_header_id)
      OR public.can_access_brand(brand_id)
    )
  );
