-- Campaign Script Phase 3 (domain): creator script assignments.
-- Development first. Do not apply to Production without approval.
-- No UI, Scripts tab, Creator Workspace, or Document Lifecycle.

-- Override revisions reuse campaign_script_revisions (assignment_id set).
-- Master revisions keep assignment_id NULL. Pointers are not FKs (same cycle
-- as campaign_scripts.current_revision_id).

CREATE TABLE IF NOT EXISTS public.campaign_script_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL
    REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  script_id uuid NOT NULL
    REFERENCES public.campaign_scripts (id) ON DELETE CASCADE,
  campaign_line_id uuid
    REFERENCES public.campaign_lines (id) ON DELETE SET NULL,
  influencer_id uuid NOT NULL
    REFERENCES public.influencers (id) ON DELETE CASCADE,
  campaign_influencer_id uuid
    REFERENCES public.campaign_influencers (id) ON DELETE SET NULL,
  mode text NOT NULL DEFAULT 'inherited'
    CHECK (mode IN ('inherited', 'customized')),
  override_revision_id uuid,
  forked_from_master_revision_id uuid,
  assigned_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (script_id, influencer_id),
  CHECK (
    (
      mode = 'inherited'
      AND override_revision_id IS NULL
      AND forked_from_master_revision_id IS NULL
    )
    OR (
      mode = 'customized'
      AND override_revision_id IS NOT NULL
      AND forked_from_master_revision_id IS NOT NULL
    )
  )
);

COMMENT ON TABLE public.campaign_script_assignments IS
  'One Campaign Script assignment per creator per script. Inherited rows store no body and follow the master tip. Customized rows point at an override revision. Participation is campaign_line_id + influencer_id (campaign_influencers); uniqueness is (script_id, influencer_id) so the same creator on multiple lines does not duplicate.';

COMMENT ON COLUMN public.campaign_script_assignments.mode IS
  'inherited = read campaign_scripts.current_revision_id. customized = read override_revision_id. Apply Master never overwrites customized.';

COMMENT ON COLUMN public.campaign_script_assignments.campaign_line_id IS
  'Operational participation snapshot (the line used when first assigned). Additional lines for the same creator remain on campaign_influencers — do not duplicate assignment rows.';

COMMENT ON COLUMN public.campaign_script_assignments.override_revision_id IS
  'Current creator override revision. Pointer only — no FK.';

COMMENT ON COLUMN public.campaign_script_assignments.forked_from_master_revision_id IS
  'Master revision copied at Customize time. Used to detect master-updated vs still customized. Null when inherited.';

CREATE INDEX IF NOT EXISTS campaign_script_assignments_header_idx
  ON public.campaign_script_assignments (campaign_header_id);

CREATE INDEX IF NOT EXISTS campaign_script_assignments_line_idx
  ON public.campaign_script_assignments (campaign_line_id);

CREATE INDEX IF NOT EXISTS campaign_script_assignments_influencer_idx
  ON public.campaign_script_assignments (influencer_id);

ALTER TABLE public.campaign_script_revisions
  ADD COLUMN IF NOT EXISTS assignment_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'campaign_script_revisions_assignment_id_fkey'
  ) THEN
    ALTER TABLE public.campaign_script_revisions
      ADD CONSTRAINT campaign_script_revisions_assignment_id_fkey
      FOREIGN KEY (assignment_id)
      REFERENCES public.campaign_script_assignments (id)
      ON DELETE SET NULL;
  END IF;
END
$$;

COMMENT ON COLUMN public.campaign_script_revisions.assignment_id IS
  'NULL = master revision. Set = creator override revision for that assignment. Master current_revision_id must never point here.';

CREATE INDEX IF NOT EXISTS campaign_script_revisions_assignment_idx
  ON public.campaign_script_revisions (assignment_id)
  WHERE assignment_id IS NOT NULL;

ALTER TABLE public.campaign_script_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_script_assignments FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.campaign_script_assignments FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_script_assignments
  TO authenticated, service_role;

DROP POLICY IF EXISTS campaign_script_assignments_select ON public.campaign_script_assignments;
CREATE POLICY campaign_script_assignments_select
  ON public.campaign_script_assignments
  FOR SELECT TO authenticated
  USING (
    public.has_permission('campaigns.read')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS campaign_script_assignments_insert ON public.campaign_script_assignments;
CREATE POLICY campaign_script_assignments_insert
  ON public.campaign_script_assignments
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS campaign_script_assignments_update ON public.campaign_script_assignments;
CREATE POLICY campaign_script_assignments_update
  ON public.campaign_script_assignments
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  )
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS campaign_script_assignments_delete ON public.campaign_script_assignments;
CREATE POLICY campaign_script_assignments_delete
  ON public.campaign_script_assignments
  FOR DELETE TO authenticated
  USING (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  );

-- Override revisions reuse campaign_script_revisions RLS (campaigns.read/write).
-- Client Workspace must keep loading master via current_revision_id only and
-- must not query assignment_id IS NOT NULL. Client JWT does not have campaigns.read.