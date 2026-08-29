-- Campaign Script Phase 3: translation metadata on creator assignments.
-- Development first. Do not apply to Production without approval.
-- Reuses Phase 2 translation rules. Does not change master campaign_scripts.

ALTER TABLE public.campaign_script_assignments
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
    WHERE conname = 'campaign_script_assignments_translation_status_check'
  ) THEN
    ALTER TABLE public.campaign_script_assignments
      ADD CONSTRAINT campaign_script_assignments_translation_status_check
      CHECK (translation_status IN ('idle', 'pending', 'generated', 'failed'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaign_script_assignments_translation_target_language_check'
  ) THEN
    ALTER TABLE public.campaign_script_assignments
      ADD CONSTRAINT campaign_script_assignments_translation_target_language_check
      CHECK (
        translation_target_language IS NULL
        OR translation_target_language IN ('en', 'ar')
      );
  END IF;
END
$$;

COMMENT ON COLUMN public.campaign_script_assignments.translation_status IS
  'Override translation only. Master translation stays on campaign_scripts.';
