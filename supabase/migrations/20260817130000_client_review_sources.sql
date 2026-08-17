-- Client Review sources: studio | shortlist | quotation.
-- Same review table. Campaign object freeze remains for Studio.
-- Shortlist/quotation freeze a source_snapshot so later source edits cannot mutate the review.

ALTER TABLE public.campaign_client_reviews
  ALTER COLUMN campaign_object_id DROP NOT NULL;

ALTER TABLE public.campaign_client_reviews
  ALTER COLUMN frozen_version SET DEFAULT 0;

ALTER TABLE public.campaign_client_reviews
  DROP CONSTRAINT IF EXISTS campaign_client_reviews_campaign_object_id_review_number_key;

ALTER TABLE public.campaign_client_reviews
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'studio'
    CHECK (source IN ('studio', 'shortlist', 'quotation'));

ALTER TABLE public.campaign_client_reviews
  ADD COLUMN IF NOT EXISTS quotation_id uuid REFERENCES public.quotations (id) ON DELETE SET NULL;

ALTER TABLE public.campaign_client_reviews
  ADD COLUMN IF NOT EXISTS source_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.campaign_client_reviews.source IS
  'Entry point that created this Client Review: studio, shortlist, or quotation.';
COMMENT ON COLUMN public.campaign_client_reviews.source_snapshot IS
  'Frozen client-facing payload. Live Studio/Shortlist/Quotation edits must not mutate this.';

CREATE UNIQUE INDEX IF NOT EXISTS campaign_client_reviews_studio_version_idx
  ON public.campaign_client_reviews (campaign_object_id, review_number)
  WHERE source = 'studio' AND campaign_object_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS campaign_client_reviews_shortlist_version_idx
  ON public.campaign_client_reviews (shortlist_id, review_number)
  WHERE source = 'shortlist' AND shortlist_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS campaign_client_reviews_quotation_version_idx
  ON public.campaign_client_reviews (quotation_id, review_number)
  WHERE source = 'quotation' AND quotation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_client_reviews_quotation_idx
  ON public.campaign_client_reviews (quotation_id)
  WHERE quotation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_client_reviews_shortlist_idx
  ON public.campaign_client_reviews (shortlist_id)
  WHERE shortlist_id IS NOT NULL;

DROP POLICY IF EXISTS campaign_client_reviews_select ON public.campaign_client_reviews;
CREATE POLICY campaign_client_reviews_select ON public.campaign_client_reviews
  FOR SELECT TO authenticated
  USING (
    (
      conversation_id IS NOT NULL
      AND public.can_read_ai_conversations()
      AND public.user_owns_campaign_conversation(conversation_id)
    )
    OR (
      campaign_header_id IS NOT NULL
      AND public.can_access_campaign_header(campaign_header_id)
    )
    OR (
      source IN ('shortlist', 'quotation')
      AND public.has_permission('discovery.read')
    )
  );

DROP POLICY IF EXISTS campaign_client_reviews_insert ON public.campaign_client_reviews;
CREATE POLICY campaign_client_reviews_insert ON public.campaign_client_reviews
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      (
        source = 'studio'
        AND public.can_write_ai_conversations()
        AND (
          conversation_id IS NULL
          OR public.user_owns_campaign_conversation(conversation_id)
        )
      )
      OR (
        source IN ('shortlist', 'quotation')
        AND public.has_permission('discovery.write')
      )
    )
  );

DROP POLICY IF EXISTS campaign_client_reviews_update ON public.campaign_client_reviews;
CREATE POLICY campaign_client_reviews_update ON public.campaign_client_reviews
  FOR UPDATE TO authenticated
  USING (
    (
      conversation_id IS NOT NULL
      AND public.can_write_ai_conversations()
      AND public.user_owns_campaign_conversation(conversation_id)
    )
    OR (
      campaign_header_id IS NOT NULL
      AND public.can_write_ai_conversations()
      AND public.can_access_campaign_header(campaign_header_id)
    )
    OR (
      source IN ('shortlist', 'quotation')
      AND public.has_permission('discovery.write')
    )
  )
  WITH CHECK (
    (
      conversation_id IS NOT NULL
      AND public.can_write_ai_conversations()
      AND public.user_owns_campaign_conversation(conversation_id)
    )
    OR (
      campaign_header_id IS NOT NULL
      AND public.can_write_ai_conversations()
      AND public.can_access_campaign_header(campaign_header_id)
    )
    OR (
      source IN ('shortlist', 'quotation')
      AND public.has_permission('discovery.write')
    )
  );

DROP FUNCTION IF EXISTS public.resolve_client_review_by_token(text);

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
  quotation_id uuid,
  source text,
  source_snapshot jsonb,
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
      r.quotation_id,
      r.source,
      r.source_snapshot,
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

GRANT EXECUTE ON FUNCTION public.resolve_client_review_by_token(text) TO anon, authenticated, service_role;
