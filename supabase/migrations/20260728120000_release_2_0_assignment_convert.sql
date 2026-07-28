-- =============================================================================
-- Release 2.0 Phase 1 — Assignment convert provenance + commercial snapshot
-- Additive + idempotent. Apply on Development first (hsxrewjcbvmbkqdlzjhs).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Campaign header — accepted quotation pin
-- -----------------------------------------------------------------------------
ALTER TABLE public.campaign_headers
  ADD COLUMN IF NOT EXISTS accepted_quotation_id uuid
    REFERENCES public.quotations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_quotation_version integer;

CREATE INDEX IF NOT EXISTS campaign_headers_accepted_quotation_idx
  ON public.campaign_headers (accepted_quotation_id)
  WHERE accepted_quotation_id IS NOT NULL;

COMMENT ON COLUMN public.campaign_headers.accepted_quotation_id IS
  'Release 2.0: immutable pin of the approved quotation used at Assignment convert.';
COMMENT ON COLUMN public.campaign_headers.accepted_quotation_version IS
  'Release 2.0: quotations.version_number at convert time.';

-- -----------------------------------------------------------------------------
-- 2. Campaign lines — quotation item provenance
-- -----------------------------------------------------------------------------
ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS source_quotation_id uuid
    REFERENCES public.quotations (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_quotation_item_id uuid
    REFERENCES public.quotation_items (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS campaign_lines_source_quotation_idx
  ON public.campaign_lines (source_quotation_id)
  WHERE source_quotation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_lines_source_quotation_item_idx
  ON public.campaign_lines (source_quotation_item_id)
  WHERE source_quotation_item_id IS NOT NULL;

COMMENT ON COLUMN public.campaign_lines.source_quotation_id IS
  'Release 2.0: quotation that projected this Assignment.';
COMMENT ON COLUMN public.campaign_lines.source_quotation_item_id IS
  'Release 2.0: primary quotation_items row (package leader or selected item).';

-- -----------------------------------------------------------------------------
-- 3. Optional deliverable ops fields (field ownership matrix)
-- -----------------------------------------------------------------------------
ALTER TABLE public.assignment_deliverables
  ADD COLUMN IF NOT EXISTS service_description text,
  ADD COLUMN IF NOT EXISTS free_for_client boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.assignment_deliverables.service_description IS
  'Copied from quotation deliverable/item at convert; planning-locked after Published.';
COMMENT ON COLUMN public.assignment_deliverables.free_for_client IS
  'Complimentary deliverable flag projected from quotation.';

-- -----------------------------------------------------------------------------
-- 4. Immutable commercial snapshot at convert
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_commercial_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  quotation_id uuid NOT NULL REFERENCES public.quotations (id) ON DELETE RESTRICT,
  quotation_serial text,
  version_number integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS campaign_commercial_snapshots_header_idx
  ON public.campaign_commercial_snapshots (campaign_header_id, created_at DESC);

CREATE INDEX IF NOT EXISTS campaign_commercial_snapshots_quotation_idx
  ON public.campaign_commercial_snapshots (quotation_id);

COMMENT ON TABLE public.campaign_commercial_snapshots IS
  'Release 2.0: immutable accepted-offer snapshot written at Assignment convert. Never update payload in place.';

ALTER TABLE public.campaign_commercial_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS campaign_commercial_snapshots_select ON public.campaign_commercial_snapshots;
CREATE POLICY campaign_commercial_snapshots_select ON public.campaign_commercial_snapshots
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_headers ch
      WHERE ch.id = campaign_header_id
        AND (
          ch.created_by = auth.uid()
          OR public.has_permission('campaigns.read')
          OR public.has_permission('campaigns.write')
          OR public.has_permission('campaigns.admin')
          OR public.has_permission('discovery.read')
          OR public.has_permission('discovery.admin')
        )
    )
  );

DROP POLICY IF EXISTS campaign_commercial_snapshots_insert ON public.campaign_commercial_snapshots;
CREATE POLICY campaign_commercial_snapshots_insert ON public.campaign_commercial_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('campaigns.write')
    OR public.has_permission('campaigns.admin')
    OR public.has_permission('discovery.write')
    OR public.has_permission('discovery.admin')
  );

-- No UPDATE/DELETE policies — snapshots are append-only for authenticated roles.

GRANT SELECT, INSERT ON public.campaign_commercial_snapshots TO authenticated, service_role;
