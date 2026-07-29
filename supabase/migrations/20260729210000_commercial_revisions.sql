-- Commercial SSOT Phase 4 — Commercial Revision entity (append-friendly workflow).
-- Spec: docs/architecture/COMMERCIAL_SSOT_QUOTE_CAMPAIGN.md §8

CREATE TABLE IF NOT EXISTS public.commercial_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  quotation_id uuid NOT NULL REFERENCES public.quotations (id) ON DELETE RESTRICT,
  revision_number integer NOT NULL,
  commercial_version_number integer,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft',
      'pending_approval',
      'approved',
      'rejected',
      'cancelled',
      'applied'
    )),
  reason text NOT NULL,
  comments text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  submitted_at timestamptz,
  approved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  approved_at timestamptz,
  rejected_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  rejected_at timestamptz,
  decision_notes text,
  applied_at timestamptz,
  concurrency_tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (campaign_header_id, revision_number)
);

CREATE INDEX IF NOT EXISTS commercial_revisions_campaign_status_idx
  ON public.commercial_revisions (campaign_header_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS commercial_revisions_quotation_idx
  ON public.commercial_revisions (quotation_id);

COMMENT ON TABLE public.commercial_revisions IS
  'Commercial SSOT Phase 4: governed commercial change requests after Finance Lock. Never mutate applied history rows.';

CREATE TABLE IF NOT EXISTS public.commercial_revision_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id uuid NOT NULL REFERENCES public.commercial_revisions (id) ON DELETE CASCADE,
  commercial_line_id uuid NOT NULL REFERENCES public.quotation_items (id) ON DELETE RESTRICT,
  assignment_ids uuid[] NOT NULL DEFAULT '{}',
  old_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  new_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  changed_fields text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (revision_id, commercial_line_id)
);

CREATE INDEX IF NOT EXISTS commercial_revision_lines_cml_idx
  ON public.commercial_revision_lines (commercial_line_id);

COMMENT ON TABLE public.commercial_revision_lines IS
  'Per Commercial Line Master deltas for a Commercial Revision (logical Master keys).';

ALTER TABLE public.commercial_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_revision_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_revisions_select ON public.commercial_revisions;
CREATE POLICY commercial_revisions_select ON public.commercial_revisions
  FOR SELECT TO authenticated
  USING (
    public.has_permission('campaigns.read')
    OR public.has_permission('campaigns.write')
    OR public.has_permission('campaigns.admin')
    OR public.has_permission('approvals.read')
    OR public.has_permission('approvals.decide')
  );

DROP POLICY IF EXISTS commercial_revisions_insert ON public.commercial_revisions;
CREATE POLICY commercial_revisions_insert ON public.commercial_revisions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('campaigns.write')
    OR public.has_permission('campaigns.admin')
    OR public.has_permission('approvals.write')
  );

DROP POLICY IF EXISTS commercial_revisions_update ON public.commercial_revisions;
CREATE POLICY commercial_revisions_update ON public.commercial_revisions
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('campaigns.write')
    OR public.has_permission('campaigns.admin')
    OR public.has_permission('approvals.write')
    OR public.has_permission('approvals.decide')
  )
  WITH CHECK (
    public.has_permission('campaigns.write')
    OR public.has_permission('campaigns.admin')
    OR public.has_permission('approvals.write')
    OR public.has_permission('approvals.decide')
  );

DROP POLICY IF EXISTS commercial_revision_lines_select ON public.commercial_revision_lines;
CREATE POLICY commercial_revision_lines_select ON public.commercial_revision_lines
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.commercial_revisions r
      WHERE r.id = revision_id
        AND (
          public.has_permission('campaigns.read')
          OR public.has_permission('campaigns.write')
          OR public.has_permission('campaigns.admin')
          OR public.has_permission('approvals.read')
          OR public.has_permission('approvals.decide')
        )
    )
  );

DROP POLICY IF EXISTS commercial_revision_lines_insert ON public.commercial_revision_lines;
CREATE POLICY commercial_revision_lines_insert ON public.commercial_revision_lines
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('campaigns.write')
    OR public.has_permission('campaigns.admin')
    OR public.has_permission('approvals.write')
  );

DROP POLICY IF EXISTS commercial_revision_lines_update ON public.commercial_revision_lines;
CREATE POLICY commercial_revision_lines_update ON public.commercial_revision_lines
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('campaigns.write')
    OR public.has_permission('campaigns.admin')
    OR public.has_permission('approvals.write')
  )
  WITH CHECK (
    public.has_permission('campaigns.write')
    OR public.has_permission('campaigns.admin')
    OR public.has_permission('approvals.write')
  );

DROP POLICY IF EXISTS commercial_revision_lines_delete ON public.commercial_revision_lines;
CREATE POLICY commercial_revision_lines_delete ON public.commercial_revision_lines
  FOR DELETE TO authenticated
  USING (
    public.has_permission('campaigns.write')
    OR public.has_permission('campaigns.admin')
    OR public.has_permission('approvals.write')
  );

GRANT SELECT, INSERT, UPDATE ON public.commercial_revisions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_revision_lines TO authenticated, service_role;

-- Extend snapshots with optional revision linkage (nullable; convert rows remain valid).
ALTER TABLE public.campaign_commercial_snapshots
  ADD COLUMN IF NOT EXISTS commercial_revision_id uuid
    REFERENCES public.commercial_revisions (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.campaign_commercial_snapshots.commercial_revision_id IS
  'Commercial SSOT Phase 4: revision that produced this commercial version (null for convert baseline).';
