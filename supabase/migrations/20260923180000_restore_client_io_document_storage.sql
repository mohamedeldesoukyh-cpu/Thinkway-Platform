-- Restore the intended Client IO storage policies without public document access.
BEGIN;
UPDATE storage.buckets SET public = false WHERE id = 'client-io-documents';
DROP POLICY IF EXISTS client_io_documents_storage_select ON storage.objects;
CREATE POLICY client_io_documents_storage_select ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'client-io-documents' AND public.has_permission('campaigns.read')
);
DROP POLICY IF EXISTS client_io_documents_storage_insert ON storage.objects;
CREATE POLICY client_io_documents_storage_insert ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'client-io-documents' AND public.has_permission('campaigns.write') AND public.is_internal_user()
);
DROP POLICY IF EXISTS client_io_documents_storage_update ON storage.objects;
CREATE POLICY client_io_documents_storage_update ON storage.objects
FOR UPDATE TO authenticated USING (
  bucket_id = 'client-io-documents' AND public.has_permission('campaigns.write') AND public.is_internal_user()
) WITH CHECK (
  bucket_id = 'client-io-documents' AND public.has_permission('campaigns.write') AND public.is_internal_user()
);
DROP POLICY IF EXISTS client_io_documents_storage_delete ON storage.objects;
CREATE POLICY client_io_documents_storage_delete ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'client-io-documents' AND public.has_permission('campaigns.write') AND public.is_internal_user()
);
COMMIT;
