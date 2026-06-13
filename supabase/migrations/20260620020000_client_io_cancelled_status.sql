-- Client IO cancellation status for campaign cancel cascade (serial numbers preserved).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'client_io_status'
      AND e.enumlabel = 'cancelled'
  ) THEN
    ALTER TYPE public.client_io_status ADD VALUE IF NOT EXISTS 'cancelled';
  END IF;
END $$;
