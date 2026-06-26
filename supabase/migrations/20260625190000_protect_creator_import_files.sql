-- Discovery Import Center — source file immutability / protection.
--
-- Goal: once an import source file (PDF/CSV/XLSX/ZIP) is uploaded it becomes an
-- immutable audit/source-of-truth record. Authenticated users may upload (INSERT)
-- and download (SELECT) but may NEVER overwrite (UPDATE) or delete (DELETE) the
-- stored bytes, and may never tamper with the provenance columns of the DB record.
--
-- Role × action matrix (after this migration):
--
--   storage.objects (bucket creator-imports)
--     | role            | SELECT | INSERT | UPDATE (overwrite) | DELETE |
--     |-----------------|--------|--------|--------------------|--------|
--     | authenticated*  |  yes   |  yes   |        NO          |   NO   |
--     | service_role    |  yes   |  yes   |        NO          |  yes** |
--     (* with discovery.read/write/admin as appropriate)
--     (** retained only as a backend/admin escape hatch — legal/GDPR purge and
--         orphan cleanup on a failed upload via createSupabaseAdminClient.)
--
--   public.creator_import_files
--     | role            | SELECT | INSERT | UPDATE                         | DELETE          |
--     |-----------------|--------|--------|--------------------------------|-----------------|
--     | authenticated   |  r/w/a |  w/a   | w/a, processing columns only   | admin only      |
--     | service_role    |  yes   |  yes   | yes (worker writes processing) | yes             |
--
--   Provenance columns (filename, storage_path, file_type, uploaded_by, created_at)
--   are immutable for every authenticated session via a BEFORE UPDATE trigger.
--   service_role bypasses the trigger so the backend can correct records if needed.
--
-- Additive policy/trigger work only. Apply with `npx supabase db push`.

-- -----------------------------------------------------------------------------
-- 1. Storage immutability — bucket creator-imports
-- -----------------------------------------------------------------------------

-- Read (download) for authorized discovery users — recreate idempotently.
DROP POLICY IF EXISTS creator_imports_storage_select ON storage.objects;
CREATE POLICY creator_imports_storage_select
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'creator-imports'
    AND (
      public.has_permission('discovery.read')
      OR public.has_permission('discovery.write')
      OR public.has_permission('discovery.admin')
    )
  );

-- Upload (insert) — internal users with discovery write/admin. The uuid-prefixed
-- object path guarantees a fresh path per upload, so INSERT never collides and a
-- second write to the same path is impossible (no overwrite vector).
DROP POLICY IF EXISTS creator_imports_storage_insert ON storage.objects;
CREATE POLICY creator_imports_storage_insert
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'creator-imports'
    AND public.is_internal_user()
    AND (
      public.has_permission('discovery.write')
      OR public.has_permission('discovery.admin')
    )
  );

-- DENY UPDATE (overwrite) and DELETE for every non-service role by removing any
-- such policies. With RLS enabled and no permissive UPDATE/DELETE policy present,
-- PostgreSQL denies the operation by default for authenticated users.
DROP POLICY IF EXISTS creator_imports_storage_update ON storage.objects;
DROP POLICY IF EXISTS creator_imports_storage_delete ON storage.objects;

-- service_role: keep SELECT (worker downloads for processing) and INSERT.
-- Drop service_role UPDATE so even the backend cannot overwrite existing bytes
-- (true byte-level immutability). Keep service_role DELETE strictly as an admin
-- escape hatch (legal/GDPR purge + failed-upload orphan cleanup).
DROP POLICY IF EXISTS creator_imports_storage_select_service ON storage.objects;
CREATE POLICY creator_imports_storage_select_service
  ON storage.objects FOR SELECT TO service_role
  USING (bucket_id = 'creator-imports');

DROP POLICY IF EXISTS creator_imports_storage_insert_service ON storage.objects;
CREATE POLICY creator_imports_storage_insert_service
  ON storage.objects FOR INSERT TO service_role
  WITH CHECK (bucket_id = 'creator-imports');

-- Remove backend overwrite capability — no UPDATE policy for service_role.
DROP POLICY IF EXISTS creator_imports_storage_update_service ON storage.objects;

DROP POLICY IF EXISTS creator_imports_storage_delete_service ON storage.objects;
CREATE POLICY creator_imports_storage_delete_service
  ON storage.objects FOR DELETE TO service_role
  USING (bucket_id = 'creator-imports');

-- -----------------------------------------------------------------------------
-- 2. DB record protection — public.creator_import_files
-- -----------------------------------------------------------------------------

-- Replace the broad FOR ALL write policy with granular policies so DELETE can be
-- restricted to discovery.admin while INSERT/UPDATE remain for discovery.write.
DROP POLICY IF EXISTS creator_import_files_write ON public.creator_import_files;

DROP POLICY IF EXISTS creator_import_files_insert ON public.creator_import_files;
CREATE POLICY creator_import_files_insert ON public.creator_import_files
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  );

-- UPDATE stays available to discovery.write/admin (the upload action flips status
-- to 'queued'); the immutable-column trigger below blocks provenance tampering.
DROP POLICY IF EXISTS creator_import_files_update ON public.creator_import_files;
CREATE POLICY creator_import_files_update ON public.creator_import_files
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  )
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  );

-- DELETE is admin-only: import files are an audit trail. Source provenance and
-- duplicate detection rely on these rows surviving.
DROP POLICY IF EXISTS creator_import_files_delete ON public.creator_import_files;
CREATE POLICY creator_import_files_delete ON public.creator_import_files
  FOR DELETE TO authenticated
  USING (public.has_permission('discovery.admin'));

-- service_role retains full access (worker writes processing columns).
-- (creator_import_files_service FOR ALL TO service_role already exists.)

-- Immutable provenance columns: filename, storage_path, file_type, uploaded_by,
-- created_at. The worker (service_role) only touches processing/diagnostic
-- columns, so it is unaffected. service_role bypasses for record corrections.
CREATE OR REPLACE FUNCTION public.guard_creator_import_file_immutable_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role / backend sessions have no auth.uid(); allow corrections there.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.filename IS DISTINCT FROM OLD.filename
     OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
     OR NEW.file_type IS DISTINCT FROM OLD.file_type
     OR NEW.uploaded_by IS DISTINCT FROM OLD.uploaded_by
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION
      'Import source files are immutable: filename, storage_path, file_type, uploaded_by, and created_at cannot be modified.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_creator_import_file_immutable_columns ON public.creator_import_files;
CREATE TRIGGER guard_creator_import_file_immutable_columns
  BEFORE UPDATE ON public.creator_import_files
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_creator_import_file_immutable_columns();

COMMENT ON FUNCTION public.guard_creator_import_file_immutable_columns() IS
  'Keeps creator_import_files provenance columns (filename, storage_path, file_type, uploaded_by, created_at) immutable for authenticated sessions; service_role bypasses for corrections.';
