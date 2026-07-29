-- Deliverables Documentation & Asset Repository (Phase 1)
-- Spec: docs/architecture/DELIVERABLES_DOCUMENTATION_REPOSITORY.md
-- Additive only. Does not alter Assignment workflow / Publication / Performance ownership.

CREATE TABLE IF NOT EXISTS public.deliverable_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  assignment_deliverable_id uuid NOT NULL REFERENCES public.assignment_deliverables (id) ON DELETE CASCADE,
  assignment_post_schedule_id uuid REFERENCES public.assignment_post_schedule (id) ON DELETE CASCADE,
  asset_type text NOT NULL
    CHECK (asset_type IN (
      'draft_video',
      'final_video',
      'story_screenshot',
      'feed_image',
      'caption',
      'thumbnail',
      'brief',
      'contract',
      'invoice_support',
      'other'
    )),
  medium text NOT NULL DEFAULT 'file'
    CHECK (medium IN ('file', 'external_link', 'text')),
  label text,
  sort_order integer NOT NULL DEFAULT 0,
  current_version_id uuid,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  archived_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS deliverable_assets_campaign_idx
  ON public.deliverable_assets (campaign_header_id, archived_at);
CREATE INDEX IF NOT EXISTS deliverable_assets_deliverable_idx
  ON public.deliverable_assets (assignment_deliverable_id, archived_at);
CREATE INDEX IF NOT EXISTS deliverable_assets_post_idx
  ON public.deliverable_assets (assignment_post_schedule_id, archived_at)
  WHERE assignment_post_schedule_id IS NOT NULL;

COMMENT ON TABLE public.deliverable_assets IS
  'Documentation repository: typed asset slots on Assignment Deliverables / posts. Not Publication/Performance.';

CREATE TABLE IF NOT EXISTS public.deliverable_asset_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.deliverable_assets (id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  storage_bucket text,
  storage_path text,
  external_url text,
  mime_type text,
  file_name text,
  file_size bigint,
  text_body text,
  change_summary text,
  uploaded_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (asset_id, version_number),
  CHECK (
    (storage_path IS NOT NULL AND storage_bucket IS NOT NULL)
    OR external_url IS NOT NULL
    OR text_body IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS deliverable_asset_versions_asset_idx
  ON public.deliverable_asset_versions (asset_id, version_number DESC);

COMMENT ON TABLE public.deliverable_asset_versions IS
  'Append-only asset versions. Never overwrite prior rows.';

ALTER TABLE public.deliverable_assets
  DROP CONSTRAINT IF EXISTS deliverable_assets_current_version_id_fkey;
ALTER TABLE public.deliverable_assets
  ADD CONSTRAINT deliverable_assets_current_version_id_fkey
  FOREIGN KEY (current_version_id)
  REFERENCES public.deliverable_asset_versions (id)
  ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.deliverable_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  assignment_deliverable_id uuid NOT NULL REFERENCES public.assignment_deliverables (id) ON DELETE CASCADE,
  assignment_post_schedule_id uuid REFERENCES public.assignment_post_schedule (id) ON DELETE CASCADE,
  asset_id uuid REFERENCES public.deliverable_assets (id) ON DELETE SET NULL,
  audience text NOT NULL DEFAULT 'internal'
    CHECK (audience IN ('internal', 'creator', 'client')),
  body text NOT NULL,
  author_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  author_display_name text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS deliverable_comments_deliverable_idx
  ON public.deliverable_comments (assignment_deliverable_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.deliverable_documentation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  assignment_deliverable_id uuid NOT NULL REFERENCES public.assignment_deliverables (id) ON DELETE CASCADE,
  assignment_post_schedule_id uuid REFERENCES public.assignment_post_schedule (id) ON DELETE SET NULL,
  asset_id uuid REFERENCES public.deliverable_assets (id) ON DELETE SET NULL,
  version_id uuid REFERENCES public.deliverable_asset_versions (id) ON DELETE SET NULL,
  comment_id uuid REFERENCES public.deliverable_comments (id) ON DELETE SET NULL,
  event_type text NOT NULL
    CHECK (event_type IN (
      'upload',
      'delete',
      'replace',
      'comment',
      'download',
      'link_add',
      'archive',
      'publication_link'
    )),
  actor_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  actor_label text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS deliverable_documentation_events_campaign_idx
  ON public.deliverable_documentation_events (campaign_header_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS deliverable_documentation_events_deliverable_idx
  ON public.deliverable_documentation_events (assignment_deliverable_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS public.deliverable_publication_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_header_id uuid NOT NULL REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  assignment_deliverable_id uuid NOT NULL REFERENCES public.assignment_deliverables (id) ON DELETE CASCADE,
  assignment_post_schedule_id uuid REFERENCES public.assignment_post_schedule (id) ON DELETE CASCADE,
  publication_id uuid NOT NULL REFERENCES public.campaign_publications (id) ON DELETE CASCADE,
  published_url text,
  platform text,
  created_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (assignment_deliverable_id, assignment_post_schedule_id, publication_id)
);

CREATE INDEX IF NOT EXISTS deliverable_publication_links_publication_idx
  ON public.deliverable_publication_links (publication_id);

COMMENT ON TABLE public.deliverable_publication_links IS
  'Optional reference from documentation unit to live Publication. No metrics ownership.';

-- RLS
ALTER TABLE public.deliverable_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_asset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_documentation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverable_publication_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deliverable_assets_select ON public.deliverable_assets;
CREATE POLICY deliverable_assets_select ON public.deliverable_assets
  FOR SELECT TO authenticated
  USING (
    public.has_permission('campaigns.read')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS deliverable_assets_write ON public.deliverable_assets;
CREATE POLICY deliverable_assets_write ON public.deliverable_assets
  FOR ALL TO authenticated
  USING (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  )
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS deliverable_asset_versions_select ON public.deliverable_asset_versions;
CREATE POLICY deliverable_asset_versions_select ON public.deliverable_asset_versions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverable_assets a
      WHERE a.id = asset_id
        AND public.has_permission('campaigns.read')
        AND public.can_access_campaign_header(a.campaign_header_id)
    )
  );

DROP POLICY IF EXISTS deliverable_asset_versions_write ON public.deliverable_asset_versions;
CREATE POLICY deliverable_asset_versions_write ON public.deliverable_asset_versions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.deliverable_assets a
      WHERE a.id = asset_id
        AND public.has_permission('campaigns.write')
        AND public.can_access_campaign_header(a.campaign_header_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.deliverable_assets a
      WHERE a.id = asset_id
        AND public.has_permission('campaigns.write')
        AND public.can_access_campaign_header(a.campaign_header_id)
    )
  );

DROP POLICY IF EXISTS deliverable_comments_select ON public.deliverable_comments;
CREATE POLICY deliverable_comments_select ON public.deliverable_comments
  FOR SELECT TO authenticated
  USING (
    public.has_permission('campaigns.read')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS deliverable_comments_write ON public.deliverable_comments;
CREATE POLICY deliverable_comments_write ON public.deliverable_comments
  FOR ALL TO authenticated
  USING (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  )
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS deliverable_documentation_events_select ON public.deliverable_documentation_events;
CREATE POLICY deliverable_documentation_events_select ON public.deliverable_documentation_events
  FOR SELECT TO authenticated
  USING (
    public.has_permission('campaigns.read')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS deliverable_documentation_events_insert ON public.deliverable_documentation_events;
CREATE POLICY deliverable_documentation_events_insert ON public.deliverable_documentation_events
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS deliverable_publication_links_select ON public.deliverable_publication_links;
CREATE POLICY deliverable_publication_links_select ON public.deliverable_publication_links
  FOR SELECT TO authenticated
  USING (
    public.has_permission('campaigns.read')
    AND public.can_access_campaign_header(campaign_header_id)
  );

DROP POLICY IF EXISTS deliverable_publication_links_write ON public.deliverable_publication_links;
CREATE POLICY deliverable_publication_links_write ON public.deliverable_publication_links
  FOR ALL TO authenticated
  USING (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  )
  WITH CHECK (
    public.has_permission('campaigns.write')
    AND public.can_access_campaign_header(campaign_header_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliverable_assets TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliverable_asset_versions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliverable_comments TO authenticated, service_role;
GRANT SELECT, INSERT ON public.deliverable_documentation_events TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deliverable_publication_links TO authenticated, service_role;

-- Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'deliverable-assets',
  'deliverable-assets',
  false,
  104857600,
  ARRAY[
    'application/pdf',
    'application/zip',
    'application/x-zip-compressed',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS deliverable_assets_storage_select ON storage.objects;
CREATE POLICY deliverable_assets_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'deliverable-assets');

DROP POLICY IF EXISTS deliverable_assets_storage_insert ON storage.objects;
CREATE POLICY deliverable_assets_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'deliverable-assets');

DROP POLICY IF EXISTS deliverable_assets_storage_update ON storage.objects;
CREATE POLICY deliverable_assets_storage_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'deliverable-assets');

DROP POLICY IF EXISTS deliverable_assets_storage_delete ON storage.objects;
CREATE POLICY deliverable_assets_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'deliverable-assets');
