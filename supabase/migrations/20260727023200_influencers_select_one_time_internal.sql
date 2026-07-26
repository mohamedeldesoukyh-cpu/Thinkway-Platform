-- Collapse internal read into one STABLE helper so COUNT(*) / exact counts
-- use a One-Time Filter instead of evaluating auth helpers on every row.

CREATE OR REPLACE FUNCTION public.can_read_all_influencers()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_permission('influencers.read')
    AND public.is_internal_user();
$$;

COMMENT ON FUNCTION public.can_read_all_influencers() IS
  'True when the caller may list all influencers (internal + influencers.read).';

DROP POLICY IF EXISTS influencers_select ON public.influencers;
CREATE POLICY influencers_select
  ON public.influencers
  FOR SELECT
  TO authenticated
  USING (
    public.can_read_all_influencers()
    OR (
      public.has_permission('influencers.read')
      AND profile_id = auth.uid()
    )
    OR (
      public.has_permission('influencers.read')
      AND EXISTS (
        SELECT 1
        FROM public.campaign_influencers ci
        WHERE ci.influencer_id = influencers.id
          AND ci.campaign_header_id IS NOT NULL
          AND public.can_access_campaign_header(ci.campaign_header_id)
      )
    )
    OR (
      public.has_permission('influencers.read')
      AND EXISTS (
        SELECT 1
        FROM public.campaign_influencers ci
        JOIN public.campaigns c ON c.id = ci.campaign_id
        WHERE ci.influencer_id = influencers.id
          AND ci.campaign_id IS NOT NULL
          AND public.can_access_campaign(c.id)
      )
    )
  );
