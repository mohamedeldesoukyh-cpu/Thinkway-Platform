-- Add markup calculation mode to commercial_input_mode enum (idempotent).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'commercial_input_mode'
      AND e.enumlabel = 'cost_markup_pct'
  ) THEN
    ALTER TYPE public.commercial_input_mode ADD VALUE 'cost_markup_pct' BEFORE 'cost_gp_pct';
  END IF;
END $$;
