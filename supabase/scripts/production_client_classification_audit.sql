-- Idempotent production patch: optional client columns + classification audit + review + cache
-- Run once in Supabase SQL editor if migrations 20260625010000–20260628020000 are not applied.

-- 0) Arabic legal name
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS name_ar text;

COMMENT ON COLUMN public.clients.name_ar IS
  'Optional Arabic legal / display name for the client';

-- 1) Intelligence taxonomy (slug text; convert legacy enum if present)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_subcategory text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'client_category'
  ) THEN
    ALTER TABLE public.clients
      ALTER COLUMN client_category DROP DEFAULT;

    ALTER TABLE public.clients
      ALTER COLUMN client_category TYPE text
      USING client_category::text;

    DROP TYPE IF EXISTS public.client_category;
  END IF;
END $$;

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS client_category text;

COMMENT ON COLUMN public.clients.client_category IS
  'Intelligence-engine category slug (see lib/clients/client-category-taxonomy.ts). Distinct from brand md_categories.';

COMMENT ON COLUMN public.clients.client_subcategory IS
  'Intelligence-engine subcategory slug paired with client_category.';

CREATE INDEX IF NOT EXISTS clients_client_category_idx
  ON public.clients (client_category);

-- 2) Default VR% on legal entity
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS vr_rate_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.clients'::regclass
      AND conname = 'clients_vr_rate_id_fkey'
  ) THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_vr_rate_id_fkey
      FOREIGN KEY (vr_rate_id) REFERENCES public.md_vr_rates (id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS clients_vr_rate_id_idx ON public.clients (vr_rate_id);

COMMENT ON COLUMN public.clients.vr_rate_id IS
  'Default vendor rebate % for brands under this legal entity. Brands with vr_rate_id set override; null brand rate inherits this value.';

-- 3) Credit limit enforcement toggles
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS credit_limit_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accept_credit_risk boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.clients.credit_limit_active IS
  'When true and credit_limit is set, campaign creation is blocked when exposure exceeds the limit.';
COMMENT ON COLUMN public.clients.accept_credit_risk IS
  'When true, users may acknowledge and proceed past credit limit exceedance.';

-- 4) Classification audit columns on clients
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

-- 5) Review queue flag
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

-- 6) Classification cache table
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
