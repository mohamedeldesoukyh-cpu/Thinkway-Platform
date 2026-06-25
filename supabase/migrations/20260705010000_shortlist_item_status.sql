-- Per-creator workflow status on discovery_shortlist_items (Phase 2.5 bulk selection).
-- Additive + idempotent. NOT auto-applied.

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typname = 'shortlist_item_status'
  ) THEN
    CREATE TYPE public.shortlist_item_status AS ENUM (
      'draft',
      'under_review',
      'approved',
      'rejected',
      'moved_to_campaign',
      'cancelled'
    );
  END IF;
END $$;

ALTER TABLE public.discovery_shortlist_items
  ADD COLUMN IF NOT EXISTS item_status public.shortlist_item_status NOT NULL DEFAULT 'draft';

CREATE INDEX IF NOT EXISTS discovery_shortlist_items_status_idx
  ON public.discovery_shortlist_items (shortlist_id, item_status);

COMMENT ON COLUMN public.discovery_shortlist_items.item_status IS
  'Per-creator workflow status within a shortlist (independent of shortlist header status).';

-- Backfill: items linked to campaign assignments are already moved.
UPDATE public.discovery_shortlist_items dsi
SET item_status = 'moved_to_campaign'
WHERE dsi.item_status = 'draft'
  AND EXISTS (
    SELECT 1
    FROM public.campaign_influencers ci
    WHERE ci.source_shortlist_item_id = dsi.id
  );
