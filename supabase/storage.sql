-- =============================================================================
-- Supabase Storage policies — run AFTER migrations and policies.sql
-- =============================================================================

-- Client documents: path layout {client_id}/{document_type}/{file}
DROP POLICY IF EXISTS "client_documents_storage_select" ON storage.objects;
CREATE POLICY "client_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND public.has_permission('clients.read')
    AND public.can_access_client((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "client_documents_storage_insert" ON storage.objects;
CREATE POLICY "client_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'client-documents'
    AND public.has_permission('clients.write')
    AND public.is_internal_user()
    AND public.can_access_client((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "client_documents_storage_update" ON storage.objects;
CREATE POLICY "client_documents_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND public.has_permission('clients.write')
    AND public.can_access_client((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "client_documents_storage_delete" ON storage.objects;
CREATE POLICY "client_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'client-documents'
    AND public.has_permission('clients.write')
    AND public.can_access_client((storage.foldername(name))[1]::uuid)
  );

-- Influencer documents: path layout {influencer_id}/{document_type}/{file}
DROP POLICY IF EXISTS "influencer_documents_storage_select" ON storage.objects;
CREATE POLICY "influencer_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'influencer-documents'
    AND public.has_permission('influencers.read')
    AND public.can_access_influencer((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "influencer_documents_storage_insert" ON storage.objects;
CREATE POLICY "influencer_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'influencer-documents'
    AND public.has_permission('influencers.write')
    AND public.is_internal_user()
    AND public.can_access_influencer((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "influencer_documents_storage_update" ON storage.objects;
CREATE POLICY "influencer_documents_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'influencer-documents'
    AND public.has_permission('influencers.write')
    AND public.can_access_influencer((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "influencer_documents_storage_delete" ON storage.objects;
CREATE POLICY "influencer_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'influencer-documents'
    AND public.has_permission('influencers.write')
    AND public.can_access_influencer((storage.foldername(name))[1]::uuid)
  );

-- Campaign documents: path layout {campaign_header_id}/{document_type}/{file}
DROP POLICY IF EXISTS "campaign_documents_storage_select" ON storage.objects;
CREATE POLICY "campaign_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'campaign-documents'
    AND public.has_permission('campaigns.read')
    AND public.can_access_campaign_header((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "campaign_documents_storage_insert" ON storage.objects;
CREATE POLICY "campaign_documents_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'campaign-documents'
    AND public.has_permission('campaigns.write')
    AND public.is_internal_user()
    AND public.can_access_campaign_header((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "campaign_documents_storage_update" ON storage.objects;
CREATE POLICY "campaign_documents_storage_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'campaign-documents'
    AND public.has_permission('campaigns.write')
    AND public.can_access_campaign_header((storage.foldername(name))[1]::uuid)
  );

DROP POLICY IF EXISTS "campaign_documents_storage_delete" ON storage.objects;
CREATE POLICY "campaign_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'campaign-documents'
    AND public.has_permission('campaigns.write')
    AND public.can_access_campaign_header((storage.foldername(name))[1]::uuid)
  );
