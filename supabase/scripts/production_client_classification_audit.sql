-- Idempotent production patch: client classification audit + review + cache
-- Run once in Supabase SQL editor if migrations 20260627010000–20260628020000 are not applied.

-- 1) Audit columns on clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS classification_source text,
  ADD COLUMN IF NOT EXISTS classification_confidence numeric(5, 2),
  ADD COLUMN IF NOT EXISTS classification_reason text,
  ADD COLUMN IF NOT EXISTS classified_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by_user uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamptz;

COMMENT ON COLUMN public.clients.classification_source IS
  'How category was determined: approved, rule, historical, ai_search, fallback';

COMMENT ON COLUMN public.clients.classification_confidence IS
  'Classification confidence score 0-100 at time of save';

COMMENT ON COLUMN public.clients.classification_reason IS
  'Human-readable explanation (rule name, matched client, AI reasoning)';

COMMENT ON COLUMN public.clients.classified_at IS
  'When classification metadata was last written';

COMMENT ON COLUMN public.clients.approved_by_user IS
  'User who approved category on save; NULL for legacy/unverified rows';

COMMENT ON COLUMN public.clients.last_verified_at IS
  'When classification was last explicitly verified on save';

CREATE INDEX IF NOT EXISTS clients_classification_source_idx
  ON public.clients (classification_source)
  WHERE classification_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS clients_approved_by_user_idx
  ON public.clients (approved_by_user)
  WHERE approved_by_user IS NOT NULL;

-- 2) Review queue flag
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.needs_review IS
  'True when classification confidence < 80 or source is ai_search and awaiting human review';

CREATE INDEX IF NOT EXISTS clients_needs_review_idx
  ON public.clients (needs_review)
  WHERE needs_review = true;

UPDATE public.clients
SET needs_review = true
WHERE needs_review = false
  AND client_category IS NOT NULL
  AND client_subcategory IS NOT NULL
  AND (
    classification_confidence < 80
    OR classification_source = 'ai_search'
  );

-- 3) Classification cache table
CREATE TABLE IF NOT EXISTS public.client_classification_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name_normalized text NOT NULL UNIQUE,
  category_slug text NOT NULL,
  subcategory_slug text NOT NULL,
  confidence numeric NOT NULL,
  source text NOT NULL,
  classification_reason text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.client_classification_cache IS
  'Reusable client category classifications keyed by normalized company name';

CREATE INDEX IF NOT EXISTS client_classification_cache_verified_idx
  ON public.client_classification_cache (verified_at)
  WHERE verified_at IS NOT NULL;

ALTER TABLE public.client_classification_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_classification_cache_select ON public.client_classification_cache;
CREATE POLICY client_classification_cache_select
  ON public.client_classification_cache
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS client_classification_cache_insert ON public.client_classification_cache;
CREATE POLICY client_classification_cache_insert
  ON public.client_classification_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS client_classification_cache_update ON public.client_classification_cache;
CREATE POLICY client_classification_cache_update
  ON public.client_classification_cache
  FOR UPDATE
  TO authenticated
  USING (public.is_internal_user())
  WITH CHECK (public.is_internal_user());

DROP POLICY IF EXISTS client_classification_cache_delete ON public.client_classification_cache;
CREATE POLICY client_classification_cache_delete
  ON public.client_classification_cache
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
