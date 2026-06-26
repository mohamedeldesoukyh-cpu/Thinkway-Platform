-- =============================================================================
-- Quotation ↔ Shortlist ↔ Campaign commercial lifecycle
-- Temporary client/brand, versioning, bidirectional links, version history.
-- Additive + idempotent. NOT auto-applied.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Quotation lifecycle columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS parent_quotation_id uuid REFERENCES public.quotations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS revision_notes text,
  ADD COLUMN IF NOT EXISTS is_temporary_client boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_temporary_brand boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temporary_client_name text,
  ADD COLUMN IF NOT EXISTS temporary_brand_name text;

CREATE INDEX IF NOT EXISTS quotations_parent_quotation_idx
  ON public.quotations (parent_quotation_id)
  WHERE parent_quotation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS quotations_version_number_idx
  ON public.quotations (version_number);

COMMENT ON COLUMN public.quotations.is_temporary_client IS
  'When true, client_id may be null; temporary_client_name is quotation-scoped only until promoted.';
COMMENT ON COLUMN public.quotations.is_temporary_brand IS
  'When true, brand_id may be null; temporary_brand_name is quotation-scoped only until promoted.';

-- -----------------------------------------------------------------------------
-- 2. Shortlist ↔ quotation link (reverse of quotations.shortlist_id)
-- -----------------------------------------------------------------------------
ALTER TABLE public.discovery_shortlists
  ADD COLUMN IF NOT EXISTS quotation_id uuid REFERENCES public.quotations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS discovery_shortlists_quotation_idx
  ON public.discovery_shortlists (quotation_id)
  WHERE quotation_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. Campaign header provenance links
-- -----------------------------------------------------------------------------
ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS shortlist_id uuid REFERENCES public.discovery_shortlists (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quotation_id uuid REFERENCES public.quotations (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS campaign_headers_shortlist_idx
  ON public.campaign_headers (shortlist_id)
  WHERE shortlist_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_headers_quotation_idx
  ON public.campaign_headers (quotation_id)
  WHERE quotation_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. Version history (immutable audit of generated revisions)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quotation_version_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations (id) ON DELETE CASCADE,
  parent_quotation_id uuid REFERENCES public.quotations (id) ON DELETE SET NULL,
  version_number integer NOT NULL,
  serial_number text NOT NULL,
  revision_notes text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS quotation_version_history_quotation_idx
  ON public.quotation_version_history (quotation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS quotation_version_history_parent_idx
  ON public.quotation_version_history (parent_quotation_id)
  WHERE parent_quotation_id IS NOT NULL;

ALTER TABLE public.quotation_version_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotation_version_history_select ON public.quotation_version_history;
CREATE POLICY quotation_version_history_select ON public.quotation_version_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_id
        AND (
          q.owner_id = auth.uid()
          OR q.created_by = auth.uid()
          OR public.has_permission('discovery.read')
          OR public.has_permission('discovery.admin')
        )
    )
  );

DROP POLICY IF EXISTS quotation_version_history_write ON public.quotation_version_history;
CREATE POLICY quotation_version_history_write ON public.quotation_version_history
  FOR ALL TO authenticated
  USING (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  )
  WITH CHECK (
    public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_version_history TO authenticated, service_role;

COMMENT ON TABLE public.quotation_version_history IS
  'Append-only record when a new quotation version (V2+) is generated from a sent/approved parent.';

-- -----------------------------------------------------------------------------
-- 5. Versioned serial helper (QT-YYYY-NNNN-Vn)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.format_quotation_version_serial(
  p_base_serial text,
  p_version_number integer
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_base text;
BEGIN
  v_base := regexp_replace(btrim(p_base_serial), '-V[0-9]+$', '');
  IF p_version_number IS NULL OR p_version_number <= 1 THEN
    RETURN v_base;
  END IF;
  RETURN v_base || '-V' || p_version_number::text;
END;
$$;

COMMENT ON FUNCTION public.format_quotation_version_serial(text, integer) IS
  'Builds QT-YYYY-NNNN-Vn serial from base QT-YYYY-NNNN and version_number (>1 adds suffix).';
