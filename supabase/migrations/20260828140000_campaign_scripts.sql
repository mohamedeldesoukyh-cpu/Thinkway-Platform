-- Campaign Script Phase 1: one shared master script per campaign (Internal ↔ Client).
-- Append-only revisions. Text is SSOT. Development first. Do not apply to Production
-- without approval. Not a Deliverables asset. Not Document Lifecycle.

CREATE TABLE IF NOT EXISTS public.campaign_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL UNIQUE
    REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  current_revision_id uuid,
  source_language text NOT NULL
    CHECK (source_language IN ('en', 'ar')),
  status text NOT NULL DEFAULT 'current'
    CHECK (status IN ('empty', 'current')),
  origin text NOT NULL
    CHECK (origin IN ('client', 'internal')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.campaign_scripts IS
  'Campaign Script master pointer. One current script per campaign. Shared by Campaign Workspace and Client Workspace. Not a deliverable_assets row.';

CREATE TABLE IF NOT EXISTS public.campaign_script_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL
    REFERENCES public.campaign_scripts (id) ON DELETE CASCADE,
  campaign_header_id uuid NOT NULL
    REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  revision_number integer NOT NULL CHECK (revision_number > 0),
  business_version text NOT NULL,
  body_en text NOT NULL DEFAULT '',
  body_ar text NOT NULL DEFAULT '',
  source_language text NOT NULL
    CHECK (source_language IN ('en', 'ar')),
  en_origin text NOT NULL
    CHECK (en_origin IN ('source', 'generated', 'human_edited')),
  ar_origin text NOT NULL
    CHECK (ar_origin IN ('source', 'generated', 'human_edited')),
  actor_kind text NOT NULL
    CHECK (actor_kind IN ('internal', 'client')),
  actor_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_label text,
  parent_revision_id uuid
    REFERENCES public.campaign_script_revisions (id) ON DELETE SET NULL,
  review_id uuid
    REFERENCES public.campaign_client_reviews (id) ON DELETE SET NULL,
  original_file_name text,
  change_summary text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (script_id, revision_number),
  CHECK (btrim(body_en) <> '' OR btrim(body_ar) <> '')
);

COMMENT ON TABLE public.campaign_script_revisions IS
  'Append-only Campaign Script revisions. Never update a row. Current tip is campaign_scripts.current_revision_id.';

CREATE UNIQUE INDEX IF NOT EXISTS campaign_scripts_header_idx
  ON public.campaign_scripts (campaign_header_id);

CREATE INDEX IF NOT EXISTS campaign_script_revisions_script_idx
  ON public.campaign_script_revisions (script_id, revision_number DESC);

CREATE INDEX IF NOT EXISTS campaign_script_revisions_header_idx
  ON public.campaign_script_revisions (campaign_header_id, created_at DESC);

-- current_revision_id is a pointer, not a circular FK. Load joins in application code.
-- A FK to campaign_script_revisions would cycle with script_id ON DELETE CASCADE.

ALTER TABLE public.campaign_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_scripts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_script_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_script_revisions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.campaign_scripts FROM PUBLIC, anon;
REVOKE ALL ON public.campaign_script_revisions FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE ON public.campaign_scripts TO authenticated, service_role;
GRANT SELECT, INSERT ON public.campaign_script_revisions TO authenticated, service_role;

DROP POLICY IF EXISTS campaign_scripts_select ON public.campaign_scripts;
CREATE POLICY campaign_scripts_select
  ON public.campaign_scripts
  FOR SELECT TO authenticated
  USING (
    public.has_permission('campaigns.read')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS campaign_scripts_insert ON public.campaign_scripts;
CREATE POLICY campaign_scripts_insert
  ON public.campaign_scripts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS campaign_scripts_update ON public.campaign_scripts;
CREATE POLICY campaign_scripts_update
  ON public.campaign_scripts
  FOR UPDATE TO authenticated
  USING (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  )
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS campaign_script_revisions_select ON public.campaign_script_revisions;
CREATE POLICY campaign_script_revisions_select
  ON public.campaign_script_revisions
  FOR SELECT TO authenticated
  USING (
    public.has_permission('campaigns.read')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS campaign_script_revisions_insert ON public.campaign_script_revisions;
CREATE POLICY campaign_script_revisions_insert
  ON public.campaign_script_revisions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  );
