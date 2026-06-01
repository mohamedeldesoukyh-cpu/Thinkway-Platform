-- Vendor operational governance: archived status + vendor movement type

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public' AND t.typname = 'influencer_status'
      AND e.enumlabel = 'archived'
  ) THEN
    ALTER TYPE public.influencer_status ADD VALUE 'archived';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public' AND t.typname = 'movement_type'
      AND e.enumlabel = 'vendor_to_vendor'
  ) THEN
    ALTER TYPE public.movement_type ADD VALUE 'vendor_to_vendor';
  END IF;
END $$;

ALTER TABLE public.movement_batches
  ADD COLUMN IF NOT EXISTS source_influencer_id uuid REFERENCES public.influencers (id) ON DELETE SET NULL;

ALTER TABLE public.movement_batches
  ADD COLUMN IF NOT EXISTS destination_influencer_id uuid REFERENCES public.influencers (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS movement_batches_source_influencer_idx
  ON public.movement_batches (source_influencer_id);

CREATE INDEX IF NOT EXISTS movement_batches_destination_influencer_idx
  ON public.movement_batches (destination_influencer_id);
