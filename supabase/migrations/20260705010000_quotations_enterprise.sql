-- =============================================================================
-- Client Quotation enterprise redesign — additive, idempotent.
-- Cover/validity/version fields, client portal timestamps, revision history.
-- NOT auto-applied.
-- =============================================================================

ALTER TABLE public.quotations
  ADD COLUMN IF NOT EXISTS issue_date date NOT NULL DEFAULT (timezone('utc', now()))::date,
  ADD COLUMN IF NOT EXISTS validity_date date,
  ADD COLUMN IF NOT EXISTS version text NOT NULL DEFAULT 'v1.0',
  ADD COLUMN IF NOT EXISTS department text,
  ADD COLUMN IF NOT EXISTS reviewed_by_name text,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS gp_target_pct numeric(7, 4) NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS shared_with_client boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS client_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS change_summary text;

COMMENT ON COLUMN public.quotations.shared_with_client IS
  'When true the quotation is visible in the client portal (mirrors client_visible for new code paths).';
COMMENT ON COLUMN public.quotations.validity_date IS
  'Quotation expires after this date (inclusive). Defaults to issue_date + 15 days on first save when unset.';

-- Backfill shared_with_client from legacy client_visible when present.
UPDATE public.quotations
SET shared_with_client = client_visible
WHERE shared_with_client IS DISTINCT FROM client_visible;

-- Default validity for rows missing it.
UPDATE public.quotations
SET validity_date = issue_date + interval '15 days'
WHERE validity_date IS NULL;

CREATE TABLE IF NOT EXISTS public.quotation_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id uuid NOT NULL REFERENCES public.quotations (id) ON DELETE CASCADE,
  version text NOT NULL,
  updated_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_by_name text,
  change_summary text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS quotation_revisions_quotation_idx
  ON public.quotation_revisions (quotation_id, created_at DESC);

ALTER TABLE public.quotation_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS quotation_revisions_select ON public.quotation_revisions;
CREATE POLICY quotation_revisions_select ON public.quotation_revisions
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

DROP POLICY IF EXISTS quotation_revisions_write ON public.quotation_revisions;
CREATE POLICY quotation_revisions_write ON public.quotation_revisions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_id
        AND (
          q.owner_id = auth.uid()
          OR public.has_permission('discovery.write')
          OR public.has_permission('discovery.admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quotations q
      WHERE q.id = quotation_id
        AND (
          q.owner_id = auth.uid()
          OR public.has_permission('discovery.write')
          OR public.has_permission('discovery.admin')
        )
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quotation_revisions TO authenticated, service_role;

COMMENT ON TABLE public.quotation_revisions IS
  'Append-only version history for client quotations (version label, author, change summary).';
