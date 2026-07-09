-- Fix campaign_intelligence_profiles RLS for Studio workflow linking.
--
-- Root cause: UPDATE WITH CHECK required brand_id IS NOT NULL even when
-- created_by = auth.uid(), blocking creators from linking saved library briefs
-- whose brand_id was never set (pre-CIO rows or failed backfill).
--
-- Also extend write helper so Studio users (ai.write) can create/link profiles
-- for brands they can access, not only discovery.write holders.

CREATE OR REPLACE FUNCTION public.can_write_campaign_intelligence_profile(
  p_brand_id uuid,
  p_campaign_header_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      public.is_admin()
      OR public.has_permission('discovery.write')
      OR public.has_permission('ai.write')
    )
    AND p_brand_id IS NOT NULL
    AND public.can_access_brand(p_brand_id)
    AND (
      p_campaign_header_id IS NULL
      OR (
        public.has_permission('campaigns.write')
        AND public.can_access_campaign_header(p_campaign_header_id)
      )
    );
$$;

DROP POLICY IF EXISTS campaign_intelligence_profiles_update ON public.campaign_intelligence_profiles;
CREATE POLICY campaign_intelligence_profiles_update ON public.campaign_intelligence_profiles
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.can_write_campaign_intelligence_profile(brand_id, campaign_header_id)
  )
  WITH CHECK (
    created_by = auth.uid()
    OR (
      brand_id IS NOT NULL
      AND public.can_write_campaign_intelligence_profile(brand_id, campaign_header_id)
    )
  );
