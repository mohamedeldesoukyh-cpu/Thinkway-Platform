-- Client Workspace journeys: one stable client link for Shortlist → Quotation.
-- Versioned campaign_client_reviews remain children. Development first.

CREATE TABLE IF NOT EXISTS public.campaign_client_journeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  share_token text,
  landing_review_id uuid,
  shortlist_id uuid REFERENCES public.discovery_shortlists (id) ON DELETE SET NULL,
  quotation_id uuid REFERENCES public.quotations (id) ON DELETE SET NULL,
  campaign_header_id uuid REFERENCES public.campaign_headers (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.campaign_client_journeys IS
  'Stable Client Workspace identity. Token lives here so shortlist and quotation reviews share one client link.';

ALTER TABLE public.campaign_client_reviews
  ADD COLUMN IF NOT EXISTS journey_id uuid REFERENCES public.campaign_client_journeys (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_viewed_at timestamptz;

CREATE INDEX IF NOT EXISTS campaign_client_reviews_journey_idx
  ON public.campaign_client_reviews (journey_id, source, review_number DESC)
  WHERE journey_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_client_journeys_shortlist_idx
  ON public.campaign_client_journeys (shortlist_id)
  WHERE shortlist_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS campaign_client_journeys_quotation_idx
  ON public.campaign_client_journeys (quotation_id)
  WHERE quotation_id IS NOT NULL;

ALTER TABLE public.campaign_client_journeys
  DROP CONSTRAINT IF EXISTS campaign_client_journeys_landing_review_id_fkey;
ALTER TABLE public.campaign_client_journeys
  ADD CONSTRAINT campaign_client_journeys_landing_review_id_fkey
  FOREIGN KEY (landing_review_id) REFERENCES public.campaign_client_reviews (id) ON DELETE SET NULL;

-- One journey per existing review, then merge shortlist + quotation that share a shortlist.
INSERT INTO public.campaign_client_journeys (
  token_hash,
  share_token,
  landing_review_id,
  shortlist_id,
  quotation_id,
  campaign_header_id,
  created_at,
  updated_at
)
SELECT
  r.token_hash,
  r.share_token,
  r.id,
  r.shortlist_id,
  r.quotation_id,
  r.campaign_header_id,
  r.created_at,
  r.updated_at
FROM public.campaign_client_reviews r
WHERE r.token_hash IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.campaign_client_journeys j WHERE j.token_hash = r.token_hash
  );

UPDATE public.campaign_client_reviews r
SET journey_id = j.id
FROM public.campaign_client_journeys j
WHERE j.landing_review_id = r.id
  AND r.journey_id IS NULL;

UPDATE public.campaign_client_reviews q
SET journey_id = s.journey_id
FROM public.campaign_client_reviews s
WHERE q.source = 'quotation'
  AND s.source = 'shortlist'
  AND q.shortlist_id IS NOT NULL
  AND q.shortlist_id = s.shortlist_id
  AND s.journey_id IS NOT NULL
  AND q.journey_id IS DISTINCT FROM s.journey_id;

UPDATE public.campaign_client_journeys j
SET
  quotation_id = COALESCE(j.quotation_id, r.quotation_id),
  shortlist_id = COALESCE(j.shortlist_id, r.shortlist_id),
  campaign_header_id = COALESCE(j.campaign_header_id, r.campaign_header_id),
  updated_at = now()
FROM public.campaign_client_reviews r
WHERE r.journey_id = j.id;

DELETE FROM public.campaign_client_journeys j
WHERE NOT EXISTS (
  SELECT 1 FROM public.campaign_client_reviews r WHERE r.journey_id = j.id
);

ALTER TABLE public.campaign_client_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_client_journeys FORCE ROW LEVEL SECURITY;

CREATE POLICY campaign_client_journeys_select ON public.campaign_client_journeys
  FOR SELECT TO authenticated
  USING (
    public.has_permission('discovery.read')
    OR (
      campaign_header_id IS NOT NULL
      AND public.can_access_campaign_header(campaign_header_id)
    )
  );

REVOKE ALL ON public.campaign_client_journeys FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.campaign_client_journeys TO authenticated, service_role;

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
  updated_at timestamptz,
  journey_id uuid,
  first_viewed_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_count integer;
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
      r.updated_at,
      r.journey_id,
      r.first_viewed_at
    FROM public.campaign_client_reviews r
    WHERE r.token_hash = v_hash
      AND r.revoked_at IS NULL
      AND r.status <> 'revoked'
    LIMIT 1;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count > 0 THEN
    RETURN;
  END IF;

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
      r.updated_at,
      r.journey_id,
      r.first_viewed_at
    FROM public.campaign_client_journeys j
    JOIN public.campaign_client_reviews r
      ON r.id = COALESCE(
        j.landing_review_id,
        (
          SELECT r2.id
          FROM public.campaign_client_reviews r2
          WHERE r2.journey_id = j.id
            AND r2.revoked_at IS NULL
            AND r2.status <> 'revoked'
          ORDER BY r2.created_at ASC
          LIMIT 1
        )
      )
    WHERE j.token_hash = v_hash
      AND r.revoked_at IS NULL
      AND r.status <> 'revoked'
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_client_review_by_token(text) TO anon, authenticated, service_role;
