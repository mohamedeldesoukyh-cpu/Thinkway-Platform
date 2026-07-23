-- Discovery unfiltered browse: paginate influencer IDs in PostgreSQL.
-- Replaces Node full-catalog materialization in queryBrowsableInfluencerIdsByRecency.
--
-- Ordering mirrors the ID-stage JS sort (platforms not available yet, so
-- multi-platform pin tiers 0–1 cannot apply). Full Egypt/multi-platform pin
-- tiers still run after hydration in browseUnifiedCreators.

CREATE INDEX IF NOT EXISTS influencers_active_browse_recency_idx
  ON public.influencers (last_enriched_at DESC NULLS LAST, updated_at DESC NULLS LAST, id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS influencers_prospect_browse_recency_idx
  ON public.influencers (last_enriched_at DESC NULLS LAST, updated_at DESC NULLS LAST, id)
  WHERE status = 'prospect';

CREATE OR REPLACE FUNCTION public.browse_influencer_ids_by_recency(
  p_country text DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  total_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH params AS (
    SELECT
      nullif(upper(trim(p_country)), '') AS country_code,
      nullif(trim(p_language), '') AS language_code,
      greatest(coalesce(p_limit, 0), 0) AS page_limit,
      greatest(coalesce(p_offset, 0), 0) AS page_offset
  ),
  browse_pool AS (
    SELECT
      i.id,
      i.last_enriched_at,
      i.updated_at,
      i.thinkway_score,
      i.enrichment_status,
      coalesce(i.last_enriched_at, i.updated_at) AS browse_recency_at,
      CASE
        WHEN i.enrichment_status = 'enriched'
          AND coalesce(i.last_enriched_at, i.updated_at) IS NOT NULL THEN 2
        WHEN i.enrichment_status = 'enriched' THEN 3
        WHEN coalesce(i.last_enriched_at, i.updated_at) IS NOT NULL THEN 4
        ELSE 5
      END AS id_stage_pin_tier
    FROM public.influencers i
    CROSS JOIN params p
    WHERE (
        i.status = 'active'
        OR (
          i.status = 'prospect'
          AND EXISTS (
            SELECT 1
            FROM public.discovered_profiles dp
            WHERE dp.influencer_id = i.id
          )
        )
      )
      AND (
        p.country_code IS NULL
        OR i.country_code = p.country_code
        OR coalesce(i.country_codes, '{}'::text[]) @> ARRAY[p.country_code]
      )
      AND (
        p.language_code IS NULL
        OR i.languages @> ARRAY[p.language_code]
      )
  ),
  ranked AS (
    SELECT
      bp.id,
      count(*) OVER () AS total_count
    FROM browse_pool bp
    ORDER BY
      bp.id_stage_pin_tier ASC,
      bp.browse_recency_at DESC NULLS LAST,
      coalesce(bp.thinkway_score, 0) DESC,
      bp.id ASC
    LIMIT (SELECT page_limit FROM params)
    OFFSET (SELECT page_offset FROM params)
  )
  SELECT ranked.id, ranked.total_count
  FROM ranked;
$$;

REVOKE ALL ON FUNCTION public.browse_influencer_ids_by_recency(text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.browse_influencer_ids_by_recency(text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.browse_influencer_ids_by_recency(text, text, int, int) TO service_role;

COMMENT ON FUNCTION public.browse_influencer_ids_by_recency(text, text, int, int) IS
  'Paginated Discovery browse influencer IDs (active + discovery-linked prospects). ID-stage pin tiers only; full pin sort runs after hydration.';
