-- Discovery search performance: candidate prefilter, single rank pass, has_more pagination.
-- Replaces full-catalog materialization in search_creators().

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- -----------------------------------------------------------------------------
-- Candidate key union (index-backed prefilter; no full catalog scan)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.creator_search_candidate_keys(p_query text)
RETURNS TABLE (
  source_type text,
  creator_id uuid
)
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
  WITH params AS (
    SELECT
      btrim(coalesce(p_query, '')) AS query_raw,
      public.creator_search_clean_query(p_query) AS query_clean,
      public.creator_search_tokens(p_query) AS query_tokens
  )
  SELECT DISTINCT ck.source_type, ck.creator_id
  FROM params p
  CROSS JOIN LATERAL (
    SELECT 'influencer'::text AS source_type, i.id AS creator_id
    FROM public.influencer_platform_accounts acc
    INNER JOIN public.influencers i ON i.id = acc.influencer_id AND i.status = 'active'
    WHERE p.query_clean <> ''
      AND public.creator_search_normalize(
        coalesce(acc.normalized_username::text, acc.username::text, acc.handle::text, '')
      ) = p.query_clean

    UNION

    SELECT 'influencer'::text, i.id
    FROM public.influencer_platform_accounts acc
    INNER JOIN public.influencers i ON i.id = acc.influencer_id AND i.status = 'active'
    WHERE p.query_clean <> ''
      AND public.creator_search_normalize(
        coalesce(acc.normalized_username::text, acc.username::text, acc.handle::text, '')
      ) LIKE p.query_clean || '%'

    UNION

    SELECT 'influencer'::text, i.id
    FROM public.influencers i
    WHERE i.status = 'active'
      AND p.query_clean <> ''
      AND (
        public.creator_search_normalize(i.display_name) = p.query_clean
        OR (
          i.legal_name IS NOT NULL
          AND btrim(i.legal_name) <> ''
          AND public.creator_search_normalize(i.legal_name) = p.query_clean
        )
      )

    UNION

    SELECT 'influencer'::text, i.id
    FROM public.influencers i
    WHERE i.status = 'active'
      AND p.query_clean <> ''
      AND (
        public.creator_search_normalize(i.display_name) LIKE p.query_clean || '%'
        OR (
          i.legal_name IS NOT NULL
          AND btrim(i.legal_name) <> ''
          AND public.creator_search_normalize(i.legal_name) LIKE p.query_clean || '%'
        )
      )

    UNION

    SELECT 'influencer'::text, i.id
    FROM public.influencers i
    WHERE i.status = 'active'
      AND p.query_clean <> ''
      AND (
        public.creator_search_normalize(i.display_name) LIKE '%' || p.query_clean || '%'
        OR (
          i.legal_name IS NOT NULL
          AND btrim(i.legal_name) <> ''
          AND public.creator_search_normalize(i.legal_name) LIKE '%' || p.query_clean || '%'
        )
        OR (
          i.email IS NOT NULL
          AND public.creator_search_normalize(i.email::text) LIKE '%' || p.query_clean || '%'
        )
      )

    UNION

    SELECT 'influencer'::text, acc.influencer_id
    FROM public.influencer_platform_accounts acc
    INNER JOIN public.influencers i ON i.id = acc.influencer_id AND i.status = 'active'
    WHERE p.query_clean <> ''
      AND (
        public.creator_search_normalize(
          coalesce(acc.normalized_username::text, acc.username::text, acc.handle::text, '')
        ) LIKE '%' || p.query_clean || '%'
        OR (
          acc.profile_display_name IS NOT NULL
          AND btrim(acc.profile_display_name) <> ''
          AND public.creator_search_normalize(acc.profile_display_name) LIKE '%' || p.query_clean || '%'
        )
      )

    UNION

    SELECT 'influencer'::text, i.id
    FROM public.influencers i
    WHERE i.status = 'active'
      AND p.query_raw <> ''
      AND i.search_vector IS NOT NULL
      AND i.search_vector @@ plainto_tsquery('simple', p.query_raw)

    UNION

    SELECT 'influencer'::text, i.id
    FROM public.influencers i
    WHERE i.status = 'active'
      AND p.query_clean <> ''
      AND (
        public.creator_search_normalize(i.display_name) % p.query_clean
        OR (
          i.legal_name IS NOT NULL
          AND btrim(i.legal_name) <> ''
          AND public.creator_search_normalize(i.legal_name) % p.query_clean
        )
        OR (
          i.email IS NOT NULL
          AND public.creator_search_normalize(i.email::text) % p.query_clean
        )
      )

    UNION

    SELECT 'influencer'::text, acc.influencer_id
    FROM public.influencer_platform_accounts acc
    INNER JOIN public.influencers i ON i.id = acc.influencer_id AND i.status = 'active'
    WHERE p.query_clean <> ''
      AND (
        public.creator_search_normalize(
          coalesce(acc.normalized_username::text, acc.username::text, acc.handle::text, '')
        ) % p.query_clean
        OR (
          acc.profile_display_name IS NOT NULL
          AND btrim(acc.profile_display_name) <> ''
          AND public.creator_search_normalize(acc.profile_display_name) % p.query_clean
        )
      )

    UNION

    SELECT 'influencer'::text, i.id
    FROM public.influencers i
    CROSS JOIN params p
    CROSS JOIN unnest(p.query_tokens) AS tok(token)
    WHERE i.status = 'active'
      AND cardinality(p.query_tokens) > 0
      AND (
        public.creator_search_normalize(i.display_name) LIKE tok.token || '%'
        OR public.creator_search_normalize(i.display_name) LIKE '% ' || tok.token || '%'
      )

    UNION

    SELECT 'influencer'::text, acc.influencer_id
    FROM public.influencer_platform_accounts acc
    INNER JOIN public.influencers i ON i.id = acc.influencer_id AND i.status = 'active'
    CROSS JOIN params p
    CROSS JOIN unnest(p.query_tokens) AS tok(token)
    WHERE cardinality(p.query_tokens) > 0
      AND public.creator_search_normalize(
        coalesce(acc.normalized_username::text, acc.username::text, acc.handle::text, '')
      ) LIKE tok.token || '%'

    UNION

    SELECT 'discovered'::text, dp.id
    FROM public.discovered_profiles dp
    WHERE dp.influencer_id IS NULL
      AND NOT public.creator_search_is_synthetic_username(dp.username::text)
      AND p.query_clean <> ''
      AND public.creator_search_normalize(coalesce(dp.username::text, '')) = p.query_clean

    UNION

    SELECT 'discovered'::text, dp.id
    FROM public.discovered_profiles dp
    WHERE dp.influencer_id IS NULL
      AND NOT public.creator_search_is_synthetic_username(dp.username::text)
      AND p.query_clean <> ''
      AND public.creator_search_normalize(coalesce(dp.username::text, '')) LIKE p.query_clean || '%'

    UNION

    SELECT 'discovered'::text, dp.id
    FROM public.discovered_profiles dp
    WHERE dp.influencer_id IS NULL
      AND NOT public.creator_search_is_synthetic_username(dp.username::text)
      AND p.query_clean <> ''
      AND (
        public.creator_search_normalize(coalesce(dp.display_name, '')) = p.query_clean
        OR public.creator_search_normalize(coalesce(dp.username::text, '')) = p.query_clean
      )

    UNION

    SELECT 'discovered'::text, dp.id
    FROM public.discovered_profiles dp
    WHERE dp.influencer_id IS NULL
      AND NOT public.creator_search_is_synthetic_username(dp.username::text)
      AND p.query_clean <> ''
      AND (
        public.creator_search_normalize(coalesce(dp.display_name, '')) LIKE p.query_clean || '%'
        OR public.creator_search_normalize(coalesce(dp.username::text, '')) LIKE p.query_clean || '%'
      )

    UNION

    SELECT 'discovered'::text, dp.id
    FROM public.discovered_profiles dp
    WHERE dp.influencer_id IS NULL
      AND NOT public.creator_search_is_synthetic_username(dp.username::text)
      AND p.query_clean <> ''
      AND (
        public.creator_search_normalize(coalesce(dp.display_name, '')) LIKE '%' || p.query_clean || '%'
        OR public.creator_search_normalize(coalesce(dp.username::text, '')) LIKE '%' || p.query_clean || '%'
        OR public.creator_search_normalize(coalesce(dp.bio, '')) LIKE '%' || p.query_clean || '%'
      )

    UNION

    SELECT 'discovered'::text, dp.id
    FROM public.discovered_profiles dp
    WHERE dp.influencer_id IS NULL
      AND NOT public.creator_search_is_synthetic_username(dp.username::text)
      AND p.query_raw <> ''
      AND dp.search_vector IS NOT NULL
      AND dp.search_vector @@ plainto_tsquery('simple', p.query_raw)

    UNION

    SELECT 'discovered'::text, dp.id
    FROM public.discovered_profiles dp
    WHERE dp.influencer_id IS NULL
      AND NOT public.creator_search_is_synthetic_username(dp.username::text)
      AND p.query_clean <> ''
      AND (
        public.creator_search_normalize(coalesce(dp.display_name, '')) % p.query_clean
        OR public.creator_search_normalize(coalesce(dp.username::text, '')) % p.query_clean
      )
  ) AS ck(source_type, creator_id)
  WHERE p.query_raw <> '';
$$;

-- -----------------------------------------------------------------------------
-- Lightweight count (page-1 totals only; avoids COUNT(*) OVER() in search RPC)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_creators_count(p_query text)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  WITH params AS (
    SELECT btrim(coalesce(p_query, '')) AS query_raw
  )
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
    ELSE (
      SELECT count(*)::bigint
      FROM public.creator_search_candidate_keys(p_query)
    )
  END;
$$;

GRANT EXECUTE ON FUNCTION public.creator_search_candidate_keys(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_creators_count(text) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Unified creator search / browse RPC (candidate prefilter + single rank pass)
-- Return type changed from total_count to has_more � must drop before replace.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.search_creators(text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_creators(
  p_query text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  source_type text,
  creator_id uuid,
  rank real,
  has_more boolean
)
LANGUAGE sql
STABLE
AS $$
  WITH params AS (
    SELECT
      btrim(coalesce(p_query, '')) AS query_raw,
      public.creator_search_clean_query(p_query) AS query_clean,
      public.creator_search_tokens(p_query) AS query_tokens
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
          coalesce(i.thinkway_score, 0)::real / 1000.0 + 0.001 AS rank,
          i.updated_at
        FROM public.influencers i
        WHERE i.status = 'active'
          AND p.query_raw = ''

        UNION ALL

        SELECT
          'discovered'::text AS source_type,
          dp.id AS creator_id,
          coalesce(dp.thinkway_score, 0)::real / 1000.0 + 0.001 AS rank,
          dp.updated_at
        FROM public.discovered_profiles dp
        WHERE dp.influencer_id IS NULL
          AND NOT public.creator_search_is_synthetic_username(dp.username::text)
          AND p.query_raw = ''
      ) AS combined
      ORDER BY rank DESC, creator_id
      LIMIT GREATEST(p_limit, 0) + 1
      OFFSET GREATEST(p_offset, 0)
    ) AS row
    WHERE p.query_raw = ''
  ),
  influencer_candidates AS (
    SELECT ck.creator_id
    FROM public.creator_search_candidate_keys(p_query) ck
    WHERE ck.source_type = 'influencer'
  ),
  discovery_candidates AS (
    SELECT ck.creator_id
    FROM public.creator_search_candidate_keys(p_query) ck
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
          string_agg(
            coalesce(acc.profile_display_name, ''),
            ' '
          ) FILTER (WHERE acc.profile_display_name IS NOT NULL),
          string_agg(
            coalesce(acc.normalized_username::text, acc.username::text, acc.handle::text, ''),
            ' '
          ) FILTER (
            WHERE coalesce(acc.normalized_username, acc.username, acc.handle) IS NOT NULL
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
      i.email
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
        concat_ws(' ', dp.display_name, dp.username::text, dp.bio)
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
  scored AS (
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
  search_rows AS (
    SELECT
      s.source_type,
      s.creator_id,
      s.rank
    FROM scored s
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
    (SELECT count(*) FROM page) > GREATEST(p_limit, 0) AS has_more
  FROM page
  LIMIT GREATEST(p_limit, 0);
$$;

GRANT EXECUTE ON FUNCTION public.search_creators(text, integer, integer) TO authenticated, service_role;
