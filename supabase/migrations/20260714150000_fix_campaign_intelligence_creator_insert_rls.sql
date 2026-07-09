-- Discovery brief upload: creators must be able to INSERT their own CIP row.
--
-- Root cause: CIO insert policy required can_write_campaign_intelligence_profile
-- (discovery.write / ai.write) or can_access_brand. Director/manager and some
-- internal roles can upload briefs and see brands but fail those helpers.
--
-- Match pre-CIO creator policy + require brand_id (brand-scoped SSOT).

DROP POLICY IF EXISTS campaign_intelligence_profiles_insert ON public.campaign_intelligence_profiles;
CREATE POLICY campaign_intelligence_profiles_insert ON public.campaign_intelligence_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND brand_id IS NOT NULL
  );

-- Creators can always update profiles they own (link brand, save extracted data).
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

-- Uploader can link their document to a profile they just created.
DROP POLICY IF EXISTS campaign_intelligence_documents_update ON public.campaign_intelligence_documents;
CREATE POLICY campaign_intelligence_documents_update ON public.campaign_intelligence_documents
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());
