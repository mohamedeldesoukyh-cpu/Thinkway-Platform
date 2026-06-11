-- Bank letter document type for vendor payment verification

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'influencer_document_type' AND e.enumlabel = 'bank_letter'
  ) THEN
    ALTER TYPE public.influencer_document_type ADD VALUE IF NOT EXISTS 'bank_letter';
  END IF;
END $$;
