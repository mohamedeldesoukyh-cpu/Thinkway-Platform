-- =============================================================================
-- Campaign Intelligence Object — brand-scoped SSOT with optional campaign link
-- Extends campaign_intelligence_profiles for platform-wide consumption.
-- =============================================================================

-- Optional campaign association on intelligence profiles
ALTER TABLE public.campaign_intelligence_profiles
  ADD COLUMN IF NOT EXISTS campaign_header_id uuid
    REFERENCES public.campaign_headers (id) ON DELETE SET NULL;

-- Archived workflow state
ALTER TABLE public.campaign_intelligence_profiles
  DROP CONSTRAINT IF EXISTS campaign_intelligence_profiles_status_check;

ALTER TABLE public.campaign_intelligence_profiles
  ADD CONSTRAINT campaign_intelligence_profiles_status_check
  CHECK (status IN ('draft', 'saved', 'archived'));

-- Backfill brand_id from extracted profile brandName where possible
UPDATE public.campaign_intelligence_profiles cip
SET brand_id = b.id
FROM public.brands b
WHERE cip.brand_id IS NULL
  AND NULLIF(trim(cip.profile->>'brandName'), '') IS NOT NULL
  AND lower(trim(b.name)) = lower(trim(cip.profile->>'brandName'));

-- Reverse link: campaign headers reference their intelligence object
ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS campaign_intelligence_profile_id uuid
    REFERENCES public.campaign_intelligence_profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS campaign_intelligence_profiles_brand_idx
  ON public.campaign_intelligence_profiles (brand_id, updated_at DESC)
  WHERE brand_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_intelligence_profiles_campaign_header_idx
  ON public.campaign_intelligence_profiles (campaign_header_id, updated_at DESC)
  WHERE campaign_header_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_intelligence_profiles_status_brand_idx
  ON public.campaign_intelligence_profiles (status, brand_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS campaign_headers_intelligence_profile_idx
  ON public.campaign_headers (campaign_intelligence_profile_id)
  WHERE campaign_intelligence_profile_id IS NOT NULL;

-- Access helper — brand / campaign workspace permissions + creator fallback
CREATE OR REPLACE FUNCTION public.can_access_campaign_intelligence_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.campaign_intelligence_profiles cip
    WHERE cip.id = p_profile_id
      AND (
        cip.created_by = auth.uid()
        OR (
          cip.brand_id IS NOT NULL
          AND public.can_access_brand(cip.brand_id)
          AND public.has_permission('discovery.read')
        )
        OR (
          cip.campaign_header_id IS NOT NULL
          AND public.can_access_campaign_header(cip.campaign_header_id)
          AND public.has_permission('campaigns.read')
        )
        OR public.can_read_ai_conversations()
      )
  );
$$;

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
    public.has_permission('discovery.write')
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

-- RLS — replace creator-only policies with workspace-scoped access
DROP POLICY IF EXISTS campaign_intelligence_profiles_select ON public.campaign_intelligence_profiles;
CREATE POLICY campaign_intelligence_profiles_select ON public.campaign_intelligence_profiles
  FOR SELECT TO authenticated
  USING (public.can_access_campaign_intelligence_profile(id));

DROP POLICY IF EXISTS campaign_intelligence_profiles_insert ON public.campaign_intelligence_profiles;
CREATE POLICY campaign_intelligence_profiles_insert ON public.campaign_intelligence_profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND brand_id IS NOT NULL
    AND public.can_write_campaign_intelligence_profile(brand_id, campaign_header_id)
  );

DROP POLICY IF EXISTS campaign_intelligence_profiles_update ON public.campaign_intelligence_profiles;
CREATE POLICY campaign_intelligence_profiles_update ON public.campaign_intelligence_profiles
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.can_write_campaign_intelligence_profile(brand_id, campaign_header_id)
  )
  WITH CHECK (
    brand_id IS NOT NULL
    AND (
      created_by = auth.uid()
      OR public.can_write_campaign_intelligence_profile(brand_id, campaign_header_id)
    )
  );

DROP POLICY IF EXISTS campaign_intelligence_profiles_delete ON public.campaign_intelligence_profiles;
CREATE POLICY campaign_intelligence_profiles_delete ON public.campaign_intelligence_profiles
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR (
      public.has_permission('discovery.write')
      AND brand_id IS NOT NULL
      AND public.can_access_brand(brand_id)
    )
  );

-- Documents inherit profile access
DROP POLICY IF EXISTS campaign_intelligence_documents_select ON public.campaign_intelligence_documents;
CREATE POLICY campaign_intelligence_documents_select ON public.campaign_intelligence_documents
  FOR SELECT TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR (
      profile_id IS NOT NULL
      AND public.can_access_campaign_intelligence_profile(profile_id)
    )
    OR public.can_read_ai_conversations()
  );

DROP POLICY IF EXISTS campaign_intelligence_documents_insert ON public.campaign_intelligence_documents;
CREATE POLICY campaign_intelligence_documents_insert ON public.campaign_intelligence_documents
  FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      profile_id IS NULL
      OR public.can_write_campaign_intelligence_profile(
        (SELECT brand_id FROM public.campaign_intelligence_profiles WHERE id = profile_id),
        (SELECT campaign_header_id FROM public.campaign_intelligence_profiles WHERE id = profile_id)
      )
    )
  );

DROP POLICY IF EXISTS campaign_intelligence_documents_update ON public.campaign_intelligence_documents;
CREATE POLICY campaign_intelligence_documents_update ON public.campaign_intelligence_documents
  FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR (
      profile_id IS NOT NULL
      AND public.can_write_campaign_intelligence_profile(
        (SELECT brand_id FROM public.campaign_intelligence_profiles WHERE id = profile_id),
        (SELECT campaign_header_id FROM public.campaign_intelligence_profiles WHERE id = profile_id)
      )
    )
  )
  WITH CHECK (
    uploaded_by = auth.uid()
    OR (
      profile_id IS NOT NULL
      AND public.can_write_campaign_intelligence_profile(
        (SELECT brand_id FROM public.campaign_intelligence_profiles WHERE id = profile_id),
        (SELECT campaign_header_id FROM public.campaign_intelligence_profiles WHERE id = profile_id)
      )
    )
  );

COMMENT ON COLUMN public.campaign_intelligence_profiles.campaign_header_id IS
  'Optional campaign header link — intelligence belongs to brand; may scope to one campaign.';
COMMENT ON COLUMN public.campaign_headers.campaign_intelligence_profile_id IS
  'Linked Campaign Intelligence Object — SSOT for brief and extracted requirements.';
