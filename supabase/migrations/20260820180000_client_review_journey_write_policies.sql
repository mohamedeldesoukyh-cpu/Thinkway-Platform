-- Staff Generate/Show link must be able to insert and update journeys.
-- FORCE RLS was enabled with SELECT only, so journey insert failed silently and
-- Client Workspace URLs were minted with a token that was never stored.

DROP POLICY IF EXISTS campaign_client_journeys_insert ON public.campaign_client_journeys;
CREATE POLICY campaign_client_journeys_insert ON public.campaign_client_journeys
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('discovery.write')
    OR (
      campaign_header_id IS NOT NULL
      AND public.can_access_campaign_header(campaign_header_id)
    )
  );

DROP POLICY IF EXISTS campaign_client_journeys_update ON public.campaign_client_journeys;
CREATE POLICY campaign_client_journeys_update ON public.campaign_client_journeys
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('discovery.write')
    OR (
      campaign_header_id IS NOT NULL
      AND public.can_access_campaign_header(campaign_header_id)
    )
  )
  WITH CHECK (
    public.has_permission('discovery.write')
    OR (
      campaign_header_id IS NOT NULL
      AND public.can_access_campaign_header(campaign_header_id)
    )
  );
