-- P4: campaign-publication-media SELECT was open to any authenticated user.
-- Restrict reads to internal staff with campaigns.read, or service_role.

DROP POLICY IF EXISTS campaign_publication_media_select ON storage.objects;
DROP POLICY IF EXISTS campaign_publication_media_select_service ON storage.objects;

CREATE POLICY campaign_publication_media_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'campaign-publication-media'
    AND public.is_internal_user()
    AND public.has_permission('campaigns.read')
  );

CREATE POLICY campaign_publication_media_select_service ON storage.objects
  FOR SELECT TO service_role
  USING (bucket_id = 'campaign-publication-media');
