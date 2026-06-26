-- Discovery Import Center — extraction diagnostics.
-- Surfaces how each upload was parsed so empty/zero-creator imports are debuggable
-- without re-running the worker (text length, parser used, text vs OCR, warnings).

ALTER TABLE public.creator_import_files
  ADD COLUMN IF NOT EXISTS extracted_text_length integer,
  ADD COLUMN IF NOT EXISTS parser_strategy text,
  ADD COLUMN IF NOT EXISTS extraction_method text,
  ADD COLUMN IF NOT EXISTS warning_message text;

ALTER TABLE public.creator_import_files
  DROP CONSTRAINT IF EXISTS creator_import_files_extraction_method_check;

ALTER TABLE public.creator_import_files
  ADD CONSTRAINT creator_import_files_extraction_method_check
  CHECK (extraction_method IS NULL OR extraction_method IN ('text', 'ocr'));
