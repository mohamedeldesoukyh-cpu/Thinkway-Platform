-- Client Workspace: staff-only plaintext token so Show link always returns
-- the same signed URL. Never returned by resolve_client_review_by_token.
-- Development first. Do not apply to Production without approval.

ALTER TABLE public.campaign_client_reviews
  ADD COLUMN IF NOT EXISTS share_token text;

COMMENT ON COLUMN public.campaign_client_reviews.share_token IS
  'Staff-only last issued Client Workspace token. Used to reconstruct the stable signed URL. Never returned by resolve_client_review_by_token.';
