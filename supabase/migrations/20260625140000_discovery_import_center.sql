-- Discovery Import Center — Phase 1 foundation (upload, storage, duplicate prevention).
-- Extraction / OCR / AI processing is intentionally out of scope for this migration.

-- -----------------------------------------------------------------------------
-- Duplicate prevention: normalized platform usernames
-- -----------------------------------------------------------------------------
UPDATE public.influencer_platform_accounts
SET normalized_username = lower(
  regexp_replace(
    trim(both '@' from trim(COALESCE(username::text, handle::text))),
    '\s+',
    '',
    'g'
  )
)::citext
WHERE username IS NOT NULL OR handle IS NOT NULL;

-- Keep the earliest account per platform + normalized username for unique enforcement.
WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY platform, normalized_username
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM public.influencer_platform_accounts
  WHERE normalized_username IS NOT NULL
    AND btrim(normalized_username::text) <> ''
)
UPDATE public.influencer_platform_accounts ipa
SET normalized_username = NULL
FROM ranked r
WHERE ipa.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS public.influencer_platform_accounts_platform_normalized_username_idx;

CREATE UNIQUE INDEX IF NOT EXISTS influencer_platform_accounts_platform_normalized_username_uniq
  ON public.influencer_platform_accounts (platform, normalized_username)
  WHERE normalized_username IS NOT NULL
    AND btrim(normalized_username::text) <> '';

-- -----------------------------------------------------------------------------
-- Import file registry
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_import_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  source_name text,
  file_type text NOT NULL,
  storage_path text,
  uploaded_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'uploaded',
  total_creators integer NOT NULL DEFAULT 0,
  imported_creators integer NOT NULL DEFAULT 0,
  updated_creators integer NOT NULL DEFAULT 0,
  duplicate_creators integer NOT NULL DEFAULT 0,
  processing_log jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS creator_import_files_uploaded_by_idx
  ON public.creator_import_files (uploaded_by, created_at DESC);

CREATE INDEX IF NOT EXISTS creator_import_files_status_idx
  ON public.creator_import_files (status, created_at DESC);

ALTER TABLE public.creator_import_files
  DROP CONSTRAINT IF EXISTS creator_import_files_status_check;

ALTER TABLE public.creator_import_files
  ADD CONSTRAINT creator_import_files_status_check
  CHECK (status IN ('uploaded', 'queued', 'processing', 'completed', 'failed'));

-- -----------------------------------------------------------------------------
-- Creator source provenance (links influencers to import files)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.creator_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  influencer_id uuid NOT NULL REFERENCES public.influencers (id) ON DELETE CASCADE,
  source_name text NOT NULL,
  source_file_id uuid REFERENCES public.creator_import_files (id) ON DELETE SET NULL,
  imported_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS creator_sources_influencer_id_idx
  ON public.creator_sources (influencer_id);

CREATE INDEX IF NOT EXISTS creator_sources_source_file_id_idx
  ON public.creator_sources (source_file_id);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.creator_import_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.creator_sources ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.creator_import_files FORCE ROW LEVEL SECURITY;
ALTER TABLE public.creator_sources FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS creator_import_files_select ON public.creator_import_files;
CREATE POLICY creator_import_files_select ON public.creator_import_files
  FOR SELECT TO authenticated
  USING (
    public.has_permission('discovery.read')
    OR public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  );

DROP POLICY IF EXISTS creator_import_files_write ON public.creator_import_files;
CREATE POLICY creator_import_files_write ON public.creator_import_files
  FOR ALL TO authenticated
  USING (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  )
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  );

DROP POLICY IF EXISTS creator_import_files_service ON public.creator_import_files;
CREATE POLICY creator_import_files_service ON public.creator_import_files
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS creator_sources_select ON public.creator_sources;
CREATE POLICY creator_sources_select ON public.creator_sources
  FOR SELECT TO authenticated
  USING (
    public.has_permission('discovery.read')
    OR public.has_permission('influencers.read')
  );

DROP POLICY IF EXISTS creator_sources_write ON public.creator_sources;
CREATE POLICY creator_sources_write ON public.creator_sources
  FOR ALL TO authenticated
  USING (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  )
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  );

DROP POLICY IF EXISTS creator_sources_service ON public.creator_sources;
CREATE POLICY creator_sources_service ON public.creator_sources
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- Storage bucket: creator-imports (private)
-- -----------------------------------------------------------------------------
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

DROP POLICY IF EXISTS creator_imports_storage_delete ON storage.objects;
CREATE POLICY creator_imports_storage_delete
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'creator-imports'
    AND (
      public.has_permission('discovery.write')
      OR public.has_permission('discovery.admin')
    )
  );
