-- Creator Workspace: a linked creator must read their own influencers row.
-- Internal CRM still uses influencers.read. Self-read does not grant listing others.
-- Development only. Additive. Does not change Production until approved.

DROP POLICY IF EXISTS influencers_select ON public.influencers;
CREATE POLICY influencers_select
  ON public.influencers
  FOR SELECT
  TO authenticated
  USING (
    public.can_read_all_influencers()
    OR profile_id = auth.uid()
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
