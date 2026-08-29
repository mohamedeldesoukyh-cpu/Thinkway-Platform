-- Campaign Script original documents: persist the uploaded client file on the
-- documentation-unit script revision. Bytes live in the existing deliverable-assets
-- bucket; metadata lives on append-only campaign_script_revisions.
-- Not a deliverable_assets row. Not Document Lifecycle. Do not fan out leftovers.
-- Development first. Do not apply to Production without approval.

ALTER TABLE public.campaign_script_revisions
  ADD COLUMN IF NOT EXISTS original_storage_bucket text,
  ADD COLUMN IF NOT EXISTS original_storage_path text,
  ADD COLUMN IF NOT EXISTS original_mime_type text,
  ADD COLUMN IF NOT EXISTS original_file_size integer;

ALTER TABLE public.campaign_script_revisions
  DROP CONSTRAINT IF EXISTS campaign_script_revisions_original_storage_check;

ALTER TABLE public.campaign_script_revisions
  ADD CONSTRAINT campaign_script_revisions_original_storage_check
  CHECK (
    (
      original_storage_bucket IS NULL
      AND original_storage_path IS NULL
      AND original_file_size IS NULL
    )
    OR (
      original_storage_bucket IS NOT NULL
      AND btrim(original_storage_bucket) <> ''
      AND original_storage_path IS NOT NULL
      AND btrim(original_storage_path) <> ''
      AND original_file_size IS NOT NULL
      AND original_file_size >= 0
    )
  );

COMMENT ON COLUMN public.campaign_script_revisions.original_storage_path IS
  'Immutable object path in deliverable-assets for this revision''s original upload. Path: {campaignHeaderId}/{assignmentDeliverableId}/{postId|deliverable}/{revisionId}/{fileName}. Never update; replacement inserts a new revision.';
