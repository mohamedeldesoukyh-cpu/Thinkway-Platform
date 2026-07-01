-- Allow paused status for Discovery Import Center in-flight imports.

ALTER TABLE public.creator_import_files
  DROP CONSTRAINT IF EXISTS creator_import_files_status_check;

ALTER TABLE public.creator_import_files
  ADD CONSTRAINT creator_import_files_status_check
  CHECK (status IN ('uploaded', 'queued', 'processing', 'paused', 'completed', 'failed'));
