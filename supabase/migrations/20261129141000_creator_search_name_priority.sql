-- Direct name/handle matches stay ahead of bio-only matches.
-- Prior use breaks ties within the direct-name and broad-text groups.
BEGIN;
CREATE OR REPLACE FUNCTION public.search_creators_impl(p_query text, p_limit integer DEFAULT 50, p_offset integer DEFAULT 0)
 RETURNS TABLE(source_type text, creator_id uuid, rank real, has_more boolean, total_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH params AS (
    SELECT
      btrim(coalesce(p_query, '')) AS query_raw,
      public.creator_search_clean_query(p_query) AS query_clean,
      public.creator_search_tokens(p_query) AS query_tokens
  ),
  candidate_keys AS (
    SELECT ck.source_type, ck.creator_id
    FROM params p
    CROSS JOIN public.creator_search_candidate_keys(p_query) ck
    WHERE p.query_raw <> ''
  ),
  total_matches AS (
    SELECT CASE
      WHEN (SELECT query_raw FROM params) = '' THEN (
        (SELECT count(*)::bigint FROM public.influencers i WHERE i.status = 'active')
        + (
          SELECT count(*)::bigint
          FROM public.discovered_profiles dp
          WHERE dp.influencer_id IS NULL
            AND NOT public.creator_search_is_synthetic_username(dp.username::text)
        )
      )
      ELSE (SELECT count(*)::bigint FROM candidate_keys)
    END AS cnt
  ),
  browse_rows AS (
    SELECT
      row.source_type,
      row.creator_id,
      row.rank
    FROM params p
    CROSS JOIN LATERAL (
      SELECT *
      FROM (
        SELECT
          'influencer'::text AS source_type,
          i.id AS creator_id,
          extract(epoch from coalesce(i.last_enriched_at, i.updated_at))::real AS rank,
          coalesce(i.last_enriched_at, i.updated_at) AS browse_recency
        FROM public.influencers i
        WHERE i.status = 'active'
          AND p.query_raw = ''

        UNION ALL

        SELECT
          'discovered'::text AS source_type,
          dp.id AS creator_id,
          extract(epoch from coalesce(dp.last_enriched_at, dp.updated_at))::real AS rank,
          coalesce(dp.last_enriched_at, dp.updated_at) AS browse_recency
        FROM public.discovered_profiles dp
        WHERE dp.influencer_id IS NULL
          AND NOT public.creator_search_is_synthetic_username(dp.username::text)
          AND p.query_raw = ''
      ) AS combined
      ORDER BY browse_recency DESC NULLS LAST, creator_id
      LIMIT GREATEST(p_limit, 0) + 1
      OFFSET GREATEST(p_offset, 0)
    ) AS row
    WHERE p.query_raw = ''
  ),
  influencer_candidates AS (
    SELECT ck.creator_id
    FROM candidate_keys ck
    WHERE ck.source_type = 'influencer'
  ),
  discovery_candidates AS (
    SELECT ck.creator_id
    FROM candidate_keys ck
    WHERE ck.source_type = 'discovered'
  ),
  influencer_rows AS (
    SELECT
      'influencer'::text AS source_type,
      i.id AS creator_id,
      i.search_vector,
      coalesce(
        array_agg(
          DISTINCT public.creator_search_normalize(
            coalesce(acc.normalized_username::text, acc.username::text, acc.handle::text, '')
          )
        ) FILTER (
          WHERE coalesce(acc.normalized_username, acc.username, acc.handle) IS NOT NULL
        ),
        ARRAY[]::text[]
      ) AS usernames,
      array_remove(
        ARRAY[
          public.creator_search_normalize(i.display_name),
          public.creator_search_normalize(i.legal_name),
          public.creator_search_normalize(i.email::text)
        ] || coalesce(
          array_agg(
            DISTINCT public.creator_search_normalize(acc.profile_display_name)
          ) FILTER (
            WHERE acc.profile_display_name IS NOT NULL
              AND btrim(acc.profile_display_name) <> ''
          ),
          ARRAY[]::text[]
        ),
        ''
      ) AS full_names,
      public.creator_search_normalize(
        concat_ws(
          ' ',
          i.display_name,
          i.legal_name,
          i.email::text,
          array_to_string(i.categories, ' '),
          string_agg(
            coalesce(acc.profile_display_name, ''),
            ' '
          ) FILTER (WHERE acc.profile_display_name IS NOT NULL),
          string_agg(
            coalesce(acc.normalized_username::text, acc.username::text, acc.handle::text, ''),
            ' '
          ) FILTER (
            WHERE coalesce(acc.normalized_username, acc.username, acc.handle) IS NOT NULL
          ),
          string_agg(
            coalesce(acc.profile_bio, ''),
            ' '
          ) FILTER (
            WHERE acc.profile_bio IS NOT NULL AND btrim(acc.profile_bio) <> ''
          ),
          string_agg(
            coalesce(array_to_string(acc.hashtags, ' '), ''),
            ' '
          ) FILTER (
            WHERE acc.hashtags IS NOT NULL AND cardinality(acc.hashtags) > 0
          ),
          string_agg(
            coalesce(array_to_string(acc.interest_categories, ' '), ''),
            ' '
          ) FILTER (
            WHERE acc.interest_categories IS NOT NULL AND cardinality(acc.interest_categories) > 0
          )
        )
      ) AS search_blob
    FROM influencer_candidates ic
    INNER JOIN public.influencers i ON i.id = ic.creator_id AND i.status = 'active'
    LEFT JOIN public.influencer_platform_accounts acc ON acc.influencer_id = i.id
    GROUP BY
      i.id,
      i.search_vector,
      i.display_name,
      i.legal_name,
      i.email,
      i.categories
  ),
  discovery_rows AS (
    SELECT
      'discovered'::text AS source_type,
      dp.id AS creator_id,
      dp.search_vector,
      ARRAY[public.creator_search_normalize(dp.username::text)] AS usernames,
      array_remove(
        ARRAY[
          public.creator_search_normalize(coalesce(dp.display_name, '')),
          public.creator_search_normalize(coalesce(dp.username::text, ''))
        ],
        ''
      ) AS full_names,
      public.creator_search_normalize(
        concat_ws(
          ' ',
          dp.display_name,
          dp.username::text,
          dp.bio,
          array_to_string(dp.category_tags, ' ')
        )
      ) AS search_blob
    FROM discovery_candidates dc
    INNER JOIN public.discovered_profiles dp ON dp.id = dc.creator_id
    WHERE dp.influencer_id IS NULL
      AND NOT public.creator_search_is_synthetic_username(dp.username::text)
  ),
  catalog AS (
    SELECT * FROM influencer_rows
    UNION ALL
    SELECT * FROM discovery_rows
  ),
  scored AS MATERIALIZED (
    SELECT
      c.source_type,
      c.creator_id,
      public.creator_search_compute_rank(
        p.query_raw,
        p.query_clean,
        p.query_tokens,
        c.usernames,
        c.full_names,
        c.search_blob,
        c.search_vector
      ) AS rank
    FROM catalog c
    CROSS JOIN params p
    WHERE p.query_raw <> ''
  ),
  prioritized AS MATERIALIZED (
    SELECT s.source_type, s.creator_id,
      s.rank + CASE WHEN s.rank >= 850 THEN 20000 WHEN s.rank >= 790 THEN 9000 ELSE 0 END
        + CASE WHEN s.rank < 850 AND ( (s.source_type='influencer' AND (
          EXISTS(SELECT 1 FROM public.discovery_shortlist_items u WHERE u.influencer_id=s.creator_id OR u.unified_id='inf:'||s.creator_id::text)
          OR EXISTS(SELECT 1 FROM public.quotation_items u WHERE u.influencer_id=s.creator_id)
          OR EXISTS(SELECT 1 FROM public.campaign_influencers u WHERE u.influencer_id=s.creator_id AND (u.shortlist_assignment_status IS NULL OR u.shortlist_assignment_status <> 'removed'))
        )) OR (s.source_type='discovered' AND (
          EXISTS(SELECT 1 FROM public.discovery_shortlist_items u WHERE u.profile_id=s.creator_id OR u.unified_id='dis:'||s.creator_id::text)
          OR EXISTS(SELECT 1 FROM public.quotation_items u WHERE u.profile_id=s.creator_id)
        ))) THEN 1000 ELSE 0 END AS rank
    FROM scored s WHERE s.rank IS NOT NULL
  ),
  search_rows AS (
    SELECT
      s.source_type,
      s.creator_id,
      s.rank
    FROM prioritized s
    WHERE s.rank IS NOT NULL
    ORDER BY s.rank DESC, s.creator_id
    LIMIT GREATEST(p_limit, 0) + 1
    OFFSET GREATEST(p_offset, 0)
  ),
  combined AS (
    SELECT source_type, creator_id, rank FROM browse_rows
    UNION ALL
    SELECT source_type, creator_id, rank FROM search_rows
  ),
  page AS (
    SELECT *
    FROM combined
    LIMIT GREATEST(p_limit, 0) + 1
  )
  SELECT
    page.source_type,
    page.creator_id,
    page.rank,
    (SELECT count(*) FROM page) > GREATEST(p_limit, 0) AS has_more,
    CASE
      WHEN GREATEST(p_offset, 0) = 0 THEN (SELECT cnt FROM total_matches)
      ELSE NULL::bigint
    END AS total_count
  FROM page
  LIMIT GREATEST(p_limit, 0);
$function$;


COMMIT;
