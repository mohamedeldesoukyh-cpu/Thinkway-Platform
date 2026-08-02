-- Release 2.2d.2 — Enterprise Document Lifecycle Engine (enums)
-- Target: Development first (hsxrewjcbvmbkqdlzjhs). Production requires explicit approval.
--
-- New persisted document statuses:
--   vendor_io_status: revision_required, cancelled
--   client_io_status: revision_required  (cancelled already exists)
--
-- Enum values are added in a dedicated migration so a follow-up migration
-- can safely use them (PostgreSQL enum visibility rules).

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'vendor_io_status'
      AND e.enumlabel = 'revision_required'
  ) THEN
    ALTER TYPE public.vendor_io_status ADD VALUE IF NOT EXISTS 'revision_required';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'vendor_io_status'
      AND e.enumlabel = 'cancelled'
  ) THEN
    ALTER TYPE public.vendor_io_status ADD VALUE IF NOT EXISTS 'cancelled';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'client_io_status'
      AND e.enumlabel = 'revision_required'
  ) THEN
    ALTER TYPE public.client_io_status ADD VALUE IF NOT EXISTS 'revision_required';
  END IF;
END $$;
