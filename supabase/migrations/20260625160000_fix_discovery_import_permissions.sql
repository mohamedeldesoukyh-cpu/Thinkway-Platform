-- Discovery Import Center — PostgREST table grants for worker + dashboard.
-- New tables created after baseline schema grants do not inherit service_role access.
-- RLS policies alone are insufficient; PostgREST returns "permission denied for table".

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_import_files TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_sources TO authenticated, service_role;

-- Worker downloads import files from private storage using service_role.
DROP POLICY IF EXISTS creator_imports_storage_select_service ON storage.objects;
CREATE POLICY creator_imports_storage_select_service
  ON storage.objects FOR SELECT TO service_role
  USING (bucket_id = 'creator-imports');

DROP POLICY IF EXISTS creator_imports_storage_insert_service ON storage.objects;
CREATE POLICY creator_imports_storage_insert_service
  ON storage.objects FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'creator-imports');

DROP POLICY IF EXISTS creator_imports_storage_update_service ON storage.objects;
CREATE POLICY creator_imports_storage_update_service
  ON storage.objects FOR UPDATE TO service_role
  USING (bucket_id = 'creator-imports');

DROP POLICY IF EXISTS creator_imports_storage_delete_service ON storage.objects;
CREATE POLICY creator_imports_storage_delete_service
  ON storage.objects FOR DELETE TO service_role
  USING (bucket_id = 'creator-imports');
