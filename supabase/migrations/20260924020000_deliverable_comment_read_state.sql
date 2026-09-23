ALTER TABLE public.deliverable_comments
  ADD COLUMN IF NOT EXISTS client_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS internal_seen_at timestamptz;

CREATE INDEX IF NOT EXISTS deliverable_comments_client_seen_idx
  ON public.deliverable_comments (campaign_header_id, client_seen_at)
  WHERE deleted_at IS NULL;
