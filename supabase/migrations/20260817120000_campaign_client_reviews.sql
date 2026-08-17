-- Client Workspace: version-frozen, token-gated campaign review.
-- Presentation/decision layer only. Does not duplicate Campaign Facts,
-- Commercial, Shortlist, Quotation, or Campaign Object versions.
-- Development first. Do not apply to Production without approval.

CREATE TABLE IF NOT EXISTS public.campaign_client_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_object_id uuid NOT NULL REFERENCES public.campaign_objects (id) ON DELETE CASCADE,
  frozen_version integer NOT NULL,
  review_number integer NOT NULL,
  token_hash text NOT NULL,
  status text NOT NULL DEFAULT 'awaiting_review'
    CHECK (status IN (
      'awaiting_review',
      'changes_requested',
      'approved',
      'rejected',
      'superseded',
      'revoked'
    )),
  client_label text,
  brand_name text,
  campaign_name text,
  conversation_id uuid,
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE SET NULL,
  shortlist_id uuid REFERENCES public.discovery_shortlists (id) ON DELETE SET NULL,
  package_fingerprint jsonb NOT NULL DEFAULT '{}'::jsonb,
  selection_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  approved_creator_ids text[],
  approved_commercial jsonb,
  approved_at timestamptz,
  approved_by_label text,
  change_request_summary text,
  change_request_areas text[] NOT NULL DEFAULT ARRAY[]::text[],
  superseded_by uuid REFERENCES public.campaign_client_reviews (id) ON DELETE SET NULL,
  revoked_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_object_id, review_number),
  UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS campaign_client_reviews_object_idx
  ON public.campaign_client_reviews (campaign_object_id, review_number DESC);
CREATE INDEX IF NOT EXISTS campaign_client_reviews_status_idx
  ON public.campaign_client_reviews (status, created_at DESC);
CREATE INDEX IF NOT EXISTS campaign_client_reviews_header_idx
  ON public.campaign_client_reviews (campaign_header_id)
  WHERE campaign_header_id IS NOT NULL;

COMMENT ON TABLE public.campaign_client_reviews IS
  'Client Workspace reviewable package. Points at a frozen campaign_object_versions row. Token hash only — never store plaintext.';

CREATE TABLE IF NOT EXISTS public.campaign_client_review_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.campaign_client_reviews (id) ON DELETE CASCADE,
  target_type text NOT NULL
    CHECK (target_type IN ('campaign', 'creator', 'content', 'commercial')),
  target_id text,
  author_kind text NOT NULL CHECK (author_kind IN ('client', 'internal')),
  author_label text NOT NULL,
  author_user_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS campaign_client_review_comments_review_idx
  ON public.campaign_client_review_comments (review_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.campaign_client_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.campaign_client_reviews (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  actor_kind text NOT NULL CHECK (actor_kind IN ('client', 'internal', 'system')),
  actor_label text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaign_client_review_events_review_idx
  ON public.campaign_client_review_events (review_id, created_at DESC);

ALTER TABLE public.campaign_client_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_client_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_client_review_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_client_review_comments FORCE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_client_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_client_review_events FORCE ROW LEVEL SECURITY;

CREATE POLICY campaign_client_reviews_select ON public.campaign_client_reviews
  FOR SELECT TO authenticated
  USING (
    public.can_read_ai_conversations()
    AND (
      (
        conversation_id IS NOT NULL
        AND public.user_owns_campaign_conversation(conversation_id)
      )
      OR (
        campaign_header_id IS NOT NULL
        AND public.can_access_campaign_header(campaign_header_id)
      )
    )
  );

CREATE POLICY campaign_client_reviews_insert ON public.campaign_client_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_write_ai_conversations()
    AND created_by = auth.uid()
    AND (
      conversation_id IS NULL
      OR public.user_owns_campaign_conversation(conversation_id)
    )
  );

CREATE POLICY campaign_client_reviews_update ON public.campaign_client_reviews
  FOR UPDATE TO authenticated
  USING (
    public.can_write_ai_conversations()
    AND (
      (
        conversation_id IS NOT NULL
        AND public.user_owns_campaign_conversation(conversation_id)
      )
      OR (
        campaign_header_id IS NOT NULL
        AND public.can_access_campaign_header(campaign_header_id)
      )
    )
  )
  WITH CHECK (
    public.can_write_ai_conversations()
    AND (
      (
        conversation_id IS NOT NULL
        AND public.user_owns_campaign_conversation(conversation_id)
      )
      OR (
        campaign_header_id IS NOT NULL
        AND public.can_access_campaign_header(campaign_header_id)
      )
    )
  );

CREATE POLICY campaign_client_review_comments_select ON public.campaign_client_review_comments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_client_reviews r
      WHERE r.id = review_id
    )
  );

CREATE POLICY campaign_client_review_comments_write ON public.campaign_client_review_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_client_reviews r
      WHERE r.id = review_id
    )
  );

CREATE POLICY campaign_client_review_comments_update ON public.campaign_client_review_comments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_client_reviews r
      WHERE r.id = review_id
    )
  );

CREATE POLICY campaign_client_review_events_select ON public.campaign_client_review_events
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.campaign_client_reviews r
      WHERE r.id = review_id
    )
  );

CREATE POLICY campaign_client_review_events_insert ON public.campaign_client_review_events
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.campaign_client_reviews r
      WHERE r.id = review_id
    )
  );

REVOKE ALL ON public.campaign_client_reviews FROM anon;
REVOKE ALL ON public.campaign_client_review_comments FROM anon;
REVOKE ALL ON public.campaign_client_review_events FROM anon;

GRANT SELECT, INSERT, UPDATE ON public.campaign_client_reviews TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.campaign_client_review_comments TO authenticated, service_role;
GRANT SELECT, INSERT ON public.campaign_client_review_events TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_client_review_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  campaign_object_id uuid,
  frozen_version integer,
  review_number integer,
  status text,
  client_label text,
  brand_name text,
  campaign_name text,
  conversation_id uuid,
  campaign_header_id uuid,
  shortlist_id uuid,
  package_fingerprint jsonb,
  selection_state jsonb,
  approved_creator_ids text[],
  approved_commercial jsonb,
  approved_at timestamptz,
  approved_by_label text,
  change_request_summary text,
  change_request_areas text[],
  superseded_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
BEGIN
  IF p_token IS NULL OR length(trim(p_token)) < 16 THEN
    RETURN;
  END IF;
  v_hash := public.hash_io_approval_token(trim(p_token));
  RETURN QUERY
    SELECT
      r.id,
      r.campaign_object_id,
      r.frozen_version,
      r.review_number,
      r.status,
      r.client_label,
      r.brand_name,
      r.campaign_name,
      r.conversation_id,
      r.campaign_header_id,
      r.shortlist_id,
      r.package_fingerprint,
      r.selection_state,
      r.approved_creator_ids,
      r.approved_commercial,
      r.approved_at,
      r.approved_by_label,
      r.change_request_summary,
      r.change_request_areas,
      r.superseded_by,
      r.created_at,
      r.updated_at
    FROM public.campaign_client_reviews r
    WHERE r.token_hash = v_hash
      AND r.revoked_at IS NULL
      AND r.status <> 'revoked';
END;
$$;

COMMENT ON FUNCTION public.resolve_client_review_by_token(text) IS
  'Anon-safe Client Workspace token resolver. Never returns token_hash. Revoked rows are invisible.';

GRANT EXECUTE ON FUNCTION public.resolve_client_review_by_token(text) TO anon, authenticated, service_role;
