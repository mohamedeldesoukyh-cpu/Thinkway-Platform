-- Make influencers_select internal path a true one-time filter so COUNT(*) /
-- PostgREST Prefer: count=exact does not re-evaluate auth helpers per row.

DROP POLICY IF EXISTS influencers_select ON public.influencers;
CREATE POLICY influencers_select
  ON public.influencers
  FOR SELECT
  TO authenticated
  USING (
    (
      public.has_permission('influencers.read')
      AND public.is_internal_user()
    )
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
