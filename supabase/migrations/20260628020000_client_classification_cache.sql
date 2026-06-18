-- Persistent classification cache keyed by normalized company name
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
