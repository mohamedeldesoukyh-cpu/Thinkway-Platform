-- Campaign Script Phase 2: translation job metadata on the existing master row.
-- Development first. Do not apply to Production without approval.
-- Does not change revisions (append-only) or add a Scripts tab.

-- Minimum fields so the UI can show pending / generated / failed, the job can
-- CAS against the source revision, and retries can surface an error.
-- Origins remain on campaign_script_revisions (source | generated | human_edited).

ALTER TABLE public.campaign_scripts
  ADD COLUMN IF NOT EXISTS translation_status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS translation_target_language text,
  ADD COLUMN IF NOT EXISTS translation_source_revision_id uuid,
  ADD COLUMN IF NOT EXISTS translation_error text,
  ADD COLUMN IF NOT EXISTS translation_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS translation_updated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaign_scripts_translation_status_check'
  ) THEN
    ALTER TABLE public.campaign_scripts
      ADD CONSTRAINT campaign_scripts_translation_status_check
      CHECK (translation_status IN ('idle', 'pending', 'generated', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaign_scripts_translation_target_language_check'
  ) THEN
    ALTER TABLE public.campaign_scripts
      ADD CONSTRAINT campaign_scripts_translation_target_language_check
      CHECK (
        translation_target_language IS NULL
        OR translation_target_language IN ('en', 'ar')
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.campaign_scripts.translation_status IS
  'idle | pending | generated | failed. pending means the non-source language is being generated and must not be shown as complete.';
COMMENT ON COLUMN public.campaign_scripts.translation_target_language IS
  'Language the in-flight or last translation job is filling (en or ar).';
COMMENT ON COLUMN public.campaign_scripts.translation_source_revision_id IS
  'Revision the translation is aligned with. Stale jobs discard when current_revision_id differs. Pointer only — no FK (same cycle as current_revision_id).';
COMMENT ON COLUMN public.campaign_scripts.translation_error IS
  'Last translation failure message for UI retry. Cleared when a job is queued or succeeds.';
COMMENT ON COLUMN public.campaign_scripts.translation_attempts IS
  'Attempt count for the current/last translation job.';
COMMENT ON COLUMN public.campaign_scripts.translation_updated_at IS
  'Last translation status change.';
