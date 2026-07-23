-- creator_import_files.updated_at — required by stuck-import recovery
-- (lib/discovery-import/recover-stuck-imports.ts). Column was never added when
-- the recovery routine was introduced (KI-005 / code-schema drift).

ALTER TABLE public.creator_import_files
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT timezone('utc', now());

-- Prefer activity timestamps over the column default for existing rows.
UPDATE public.creator_import_files
SET updated_at = GREATEST(
  created_at,
  COALESCE(processing_started_at, created_at),
  COALESCE(processing_completed_at, created_at)
);

CREATE INDEX IF NOT EXISTS creator_import_files_status_updated_at_idx
  ON public.creator_import_files (status, updated_at DESC);

DROP TRIGGER IF EXISTS set_creator_import_files_updated_at ON public.creator_import_files;
CREATE TRIGGER set_creator_import_files_updated_at
  BEFORE UPDATE ON public.creator_import_files
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.creator_import_files.updated_at IS
  'Last row change (auto-maintained). Used by stuck queued/processing import recovery.';
