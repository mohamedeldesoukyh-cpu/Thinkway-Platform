-- =============================================================================
-- Supabase Storage buckets + baseline policies
-- Run AFTER schema.sql, seed.sql, and policies.sql (needs RLS helpers).
-- Safe before migrations: bucket inserts are idempotent (ON CONFLICT).
-- Later migrations may refine policies / add more buckets.
-- =============================================================================

-- Baseline private buckets (also re-asserted by early migrations)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'client-documents',
  'client-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'influencer-documents',
  'influencer-documents',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'creator-imports',
  'creator-imports',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

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

-- Creator imports: path layout {user_id}/{import_id}/{file}
-- IMMUTABLE source files: authenticated users may upload (INSERT) and download
-- (SELECT) only. UPDATE (overwrite) and DELETE are denied for all non-service
-- roles — there is intentionally no authenticated UPDATE/DELETE policy here.
-- See migration 20260625190000_protect_creator_import_files.sql for the full
-- guarantee (incl. service_role policies and the DB immutability trigger).
DROP POLICY IF EXISTS "creator_imports_storage_select" ON storage.objects;
CREATE POLICY "creator_imports_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'creator-imports'
    AND (
      public.has_permission('discovery.read')
      OR public.has_permission('discovery.write')
      OR public.has_permission('discovery.admin')
    )
  );

DROP POLICY IF EXISTS "creator_imports_storage_insert" ON storage.objects;
CREATE POLICY "creator_imports_storage_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'creator-imports'
    AND public.is_internal_user()
    AND (
      public.has_permission('discovery.write')
      OR public.has_permission('discovery.admin')
    )
  );

-- Deny overwrite/delete for authenticated users (immutability). Drop any legacy
-- permissive policies so re-running this file cannot re-grant destructive access.
DROP POLICY IF EXISTS "creator_imports_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "creator_imports_storage_delete" ON storage.objects;
