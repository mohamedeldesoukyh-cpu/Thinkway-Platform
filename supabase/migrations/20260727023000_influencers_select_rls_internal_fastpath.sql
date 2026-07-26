-- Fix Vendors list statement timeout after removing legacy allow-all SELECT.
-- Root cause: influencers_select required can_access_influencer(id) per row. That
-- SECURITY DEFINER helper re-ran role lookups for every row (~3s for 7k rows;
-- exact COUNT doubles cost → statement timeout under PostgREST).
--
-- Fast path: internal users with influencers.read use STABLE one-time filters.
-- External/creator paths use row attributes + campaign assignment checks.
-- Does not widen permissions and does not raise statement_timeout.

CREATE OR REPLACE FUNCTION public.can_access_influencer(p_influencer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_internal_user()
    OR EXISTS (
      SELECT 1
      FROM public.influencers i
      WHERE i.id = p_influencer_id
        AND i.profile_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.campaign_influencers ci
      WHERE ci.influencer_id = p_influencer_id
        AND ci.campaign_header_id IS NOT NULL
        AND public.can_access_campaign_header(ci.campaign_header_id)
    )
    OR EXISTS (
      SELECT 1
      FROM public.campaign_influencers ci
      JOIN public.campaigns c ON c.id = ci.campaign_id
      WHERE ci.influencer_id = p_influencer_id
        AND ci.campaign_id IS NOT NULL
        AND public.can_access_campaign(c.id)
    );
$$;

COMMENT ON FUNCTION public.can_access_influencer(uuid) IS
  'Influencer access: internal users, linked creator profile, or campaign assignment access.';

DROP POLICY IF EXISTS influencers_select ON public.influencers;
CREATE POLICY influencers_select
  ON public.influencers
  FOR SELECT
  TO authenticated
  USING (
    public.has_permission('influencers.read')
    AND (
      public.is_internal_user()
      OR profile_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM public.campaign_influencers ci
        WHERE ci.influencer_id = influencers.id
          AND ci.campaign_header_id IS NOT NULL
          AND public.can_access_campaign_header(ci.campaign_header_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.campaign_influencers ci
        JOIN public.campaigns c ON c.id = ci.campaign_id
        WHERE ci.influencer_id = influencers.id
          AND ci.campaign_id IS NOT NULL
          AND public.can_access_campaign(c.id)
      )
    )
  );

DROP POLICY IF EXISTS influencers_update ON public.influencers;
CREATE POLICY influencers_update
  ON public.influencers
  FOR UPDATE
  TO authenticated
  USING (
    public.has_permission('influencers.write')
    AND (
      public.is_internal_user()
      OR profile_id = auth.uid()
      OR public.can_access_influencer(id)
    )
  )
  WITH CHECK (
    public.has_permission('influencers.write')
    AND (
      public.is_internal_user()
      OR profile_id = auth.uid()
      OR public.can_access_influencer(id)
    )
  );

-- Support ORDER BY created_at DESC LIMIT n used by Vendors list.
CREATE INDEX IF NOT EXISTS influencers_created_at_desc_idx
  ON public.influencers (created_at DESC);
