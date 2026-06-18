-- Client classification review queue flag
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.needs_review IS
  'True when classification confidence < 80 or source is ai_search and awaiting human review';

CREATE INDEX IF NOT EXISTS clients_needs_review_idx
  ON public.clients (needs_review)
  WHERE needs_review = true;

-- Backfill: flag existing low-confidence or AI classifications
UPDATE public.clients
SET needs_review = true
WHERE needs_review = false
  AND client_category IS NOT NULL
  AND client_subcategory IS NOT NULL
  AND (
    classification_confidence < 80
    OR classification_source = 'ai_search'
  );
