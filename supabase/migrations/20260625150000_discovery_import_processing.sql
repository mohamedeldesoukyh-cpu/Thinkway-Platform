-- Discovery Import Center — Phase 2 processing counters.

ALTER TABLE public.creator_import_files
  ADD COLUMN IF NOT EXISTS failed_creators integer NOT NULL DEFAULT 0;
