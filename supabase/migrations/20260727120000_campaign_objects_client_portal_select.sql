-- Allow Client Portal (and other actors with campaign header access) to SELECT
-- linked campaign_objects / versions for read-only Media Plan Original.
-- Writes remain conversation-owner + AI conversation permissions only.

CREATE POLICY campaign_objects_select_via_campaign_header
  ON public.campaign_objects
  FOR SELECT
  TO authenticated
  USING (
    campaign_header_id IS NOT NULL
    AND public.can_access_campaign_header(campaign_header_id)
  );

CREATE POLICY campaign_object_versions_select_via_campaign_header
  ON public.campaign_object_versions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.campaign_objects co
      WHERE co.id = campaign_object_id
        AND co.campaign_header_id IS NOT NULL
        AND public.can_access_campaign_header(co.campaign_header_id)
    )
  );

COMMENT ON POLICY campaign_objects_select_via_campaign_header ON public.campaign_objects IS
  'Read-only access for Client Portal (and campaign-scoped actors) via can_access_campaign_header.';

COMMENT ON POLICY campaign_object_versions_select_via_campaign_header ON public.campaign_object_versions IS
  'Read-only version access matching campaign_objects_select_via_campaign_header.';
