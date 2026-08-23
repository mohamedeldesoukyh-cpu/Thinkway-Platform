-- Client Workspace content decisions + campaign-scoped deliverable-assets Storage RLS.
-- Development first. Do not apply to Production without approval.
-- File SSOT remains deliverable_assets / deliverable_asset_versions / deliverable-assets.
-- Decisions are append-only and version-specific. Not a Deliverables workflow engine.

CREATE TABLE IF NOT EXISTS public.campaign_client_content_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  campaign_header_id uuid NOT NULL
    REFERENCES public.campaign_headers (id) ON DELETE CASCADE,
  assignment_deliverable_id uuid NOT NULL
    REFERENCES public.assignment_deliverables (id) ON DELETE CASCADE,
  assignment_post_schedule_id uuid
    REFERENCES public.assignment_post_schedule (id) ON DELETE CASCADE,

  asset_id uuid NOT NULL
    REFERENCES public.deliverable_assets (id) ON DELETE CASCADE,
  version_id uuid NOT NULL
    REFERENCES public.deliverable_asset_versions (id) ON DELETE CASCADE,

  review_id uuid
    REFERENCES public.campaign_client_reviews (id) ON DELETE SET NULL,
  journey_id uuid
    REFERENCES public.campaign_client_journeys (id) ON DELETE SET NULL,

  decision text NOT NULL
    CHECK (decision IN ('approved', 'changes_requested')),
  comment text,

  actor_kind text NOT NULL DEFAULT 'client'
    CHECK (actor_kind IN ('client', 'internal')),
  actor_label text,
  actor_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,

  decided_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CHECK (comment IS NULL OR btrim(comment) <> '')
);

COMMENT ON TABLE public.campaign_client_content_decisions IS
  'Append-only Client Workspace decisions on a specific deliverable_asset_versions row. Not a Deliverables workflow engine. Current status = latest row per version_id.';

CREATE INDEX IF NOT EXISTS campaign_client_content_decisions_version_idx
  ON public.campaign_client_content_decisions (version_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS campaign_client_content_decisions_campaign_idx
  ON public.campaign_client_content_decisions (campaign_header_id, decided_at DESC);

CREATE INDEX IF NOT EXISTS campaign_client_content_decisions_unit_idx
  ON public.campaign_client_content_decisions (
    assignment_deliverable_id,
    assignment_post_schedule_id,
    decided_at DESC
  );

CREATE INDEX IF NOT EXISTS campaign_client_content_decisions_review_idx
  ON public.campaign_client_content_decisions (review_id, decided_at DESC)
  WHERE review_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_client_content_decision_version()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_asset public.deliverable_assets%ROWTYPE;
  v_version public.deliverable_asset_versions%ROWTYPE;
BEGIN
  SELECT * INTO v_version
  FROM public.deliverable_asset_versions
  WHERE id = NEW.version_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Content decision version does not exist';
  END IF;

  IF v_version.asset_id <> NEW.asset_id THEN
    RAISE EXCEPTION 'Content decision version does not belong to this asset';
  END IF;

  SELECT * INTO v_asset
  FROM public.deliverable_assets
  WHERE id = NEW.asset_id;

  IF NOT FOUND OR v_asset.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'Content decision asset is missing or archived';
  END IF;

  IF v_asset.campaign_header_id <> NEW.campaign_header_id
     OR v_asset.assignment_deliverable_id <> NEW.assignment_deliverable_id
     OR (v_asset.assignment_post_schedule_id IS DISTINCT FROM NEW.assignment_post_schedule_id) THEN
    RAISE EXCEPTION 'Content decision does not match the documentation unit';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS campaign_client_content_decisions_version_trg
  ON public.campaign_client_content_decisions;
CREATE TRIGGER campaign_client_content_decisions_version_trg
  BEFORE INSERT ON public.campaign_client_content_decisions
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_client_content_decision_version();

ALTER TABLE public.campaign_client_content_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_client_content_decisions FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.campaign_client_content_decisions FROM PUBLIC, anon;
GRANT SELECT ON public.campaign_client_content_decisions TO authenticated;
GRANT SELECT, INSERT ON public.campaign_client_content_decisions TO service_role;

DROP POLICY IF EXISTS campaign_client_content_decisions_select
  ON public.campaign_client_content_decisions;
CREATE POLICY campaign_client_content_decisions_select
  ON public.campaign_client_content_decisions
  FOR SELECT TO authenticated
  USING (
    public.has_permission('campaigns.read')
    AND public.can_access_campaign_header(campaign_header_id)
  );

-- Storage: keep bucket private. Scope objects to the campaign header in the first path folder.
-- Path: {campaignHeaderId}/{assignmentDeliverableId}/{assetId}/{versionId}-{fileName}
DROP POLICY IF EXISTS deliverable_assets_storage_select ON storage.objects;
DROP POLICY IF EXISTS deliverable_assets_storage_insert ON storage.objects;
DROP POLICY IF EXISTS deliverable_assets_storage_update ON storage.objects;
DROP POLICY IF EXISTS deliverable_assets_storage_delete ON storage.objects;

CREATE POLICY deliverable_assets_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'deliverable-assets'
    AND public.has_permission('campaigns.read')
    AND public.can_access_campaign_header((storage.foldername(name))[1]::uuid)
  );

CREATE POLICY deliverable_assets_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'deliverable-assets'
    AND public.has_permission('campaigns.write')
    AND public.can_access_campaign_header((storage.foldername(name))[1]::uuid)
  );

-- No authenticated UPDATE or DELETE: original object bytes stay immutable.
