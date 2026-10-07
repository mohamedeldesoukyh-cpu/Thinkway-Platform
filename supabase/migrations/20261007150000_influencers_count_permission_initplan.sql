-- Evaluate statement-constant user checks once, preserving all creator self-read and campaign access branches.
DROP POLICY IF EXISTS influencers_select ON public.influencers;
CREATE POLICY influencers_select
  ON public.influencers
  FOR SELECT
  TO authenticated
  USING (
    (SELECT public.can_read_all_influencers())
    OR profile_id = (SELECT auth.uid())
    OR (
      (SELECT public.has_permission('influencers.read'))
      AND profile_id = (SELECT auth.uid())
    )
    OR (
      (SELECT public.has_permission('influencers.read'))
      AND EXISTS (
        SELECT 1
        FROM public.campaign_influencers ci
        WHERE ci.influencer_id = influencers.id
          AND ci.campaign_header_id IS NOT NULL
          AND public.can_access_campaign_header(ci.campaign_header_id)
      )
    )
    OR (
      (SELECT public.has_permission('influencers.read'))
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
