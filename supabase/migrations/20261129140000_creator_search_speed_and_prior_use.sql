-- Index existing substring predicates without changing candidate eligibility.
-- Keep the original per-element EXISTS as the final filter after the index guard.
BEGIN;
CREATE OR REPLACE FUNCTION public.creator_search_terms_blob(values_in text[])
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path=public
AS $$ SELECT coalesce(string_agg(public.creator_search_normalize(value) || ' ' || public.creator_search_normalize(regexp_replace(value, '^#+', '')), ' '), '') FROM unnest(values_in) t(value); $$;
CREATE INDEX IF NOT EXISTS creator_accounts_bio_search_idx ON public.influencer_platform_accounts USING gin(public.creator_search_normalize(profile_bio) gin_trgm_ops) WHERE profile_bio IS NOT NULL AND btrim(profile_bio) <> '';
CREATE INDEX IF NOT EXISTS creator_accounts_hashtags_search_idx ON public.influencer_platform_accounts USING gin(public.creator_search_terms_blob(hashtags) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS creator_accounts_interests_search_idx ON public.influencer_platform_accounts USING gin(public.creator_search_terms_blob(interest_categories) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS creator_categories_search_idx ON public.influencers USING gin(public.creator_search_terms_blob(categories) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS discovery_categories_search_idx ON public.discovered_profiles USING gin(public.creator_search_terms_blob(category_tags) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS discovery_bio_search_idx ON public.discovered_profiles USING gin(public.creator_search_normalize(coalesce(bio,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS shortlist_items_unified_search_idx ON public.discovery_shortlist_items(unified_id);
CREATE OR REPLACE FUNCTION public.creator_search_candidate_keys(p_query text)
 RETURNS TABLE(source_type text, creator_id uuid)
 LANGUAGE sql
 STABLE PARALLEL SAFE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    FROM public.influencers i
    WHERE i.status = 'active'
      AND length(public.creator_search_compact_name(p.query_clean)) >= 2
      AND public.creator_search_compact_name(i.display_name) LIKE public.creator_search_compact_name(p.query_clean) || '%'

    UNION

    SELECT 'influencer'::text AS source_type, i.id AS creator_id
    FROM public.influencers i
    WHERE i.status = 'active'
      AND length(public.creator_search_compact_name(p.query_clean)) >= 2
      AND public.creator_search_compact_name(i.legal_name) LIKE public.creator_search_compact_name(p.query_clean) || '%'

    UNION

    SELECT 'influencer'::text AS source_type, acc.influencer_id AS creator_id
    FROM public.influencer_platform_accounts acc
    WHERE EXISTS (SELECT 1 FROM public.influencers i WHERE i.id = acc.influencer_id AND i.status = 'active')
      AND length(public.creator_search_compact_name(p.query_clean)) >= 2
      AND public.creator_search_compact_name(acc.profile_display_name) LIKE public.creator_search_compact_name(p.query_clean) || '%'

    UNION

    SELECT 'discovered'::text AS source_type, dp.id AS creator_id
    FROM public.discovered_profiles dp
    WHERE dp.influencer_id IS NULL AND NOT public.creator_search_is_synthetic_username(dp.username::text)
      AND length(public.creator_search_compact_name(p.query_clean)) >= 2
      AND public.creator_search_compact_name(dp.display_name) LIKE public.creator_search_compact_name(p.query_clean) || '%'

    UNION

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

    SELECT 'influencer'::text, acc.influencer_id
    FROM public.influencer_platform_accounts acc
    INNER JOIN public.influencers i ON i.id = acc.influencer_id AND i.status = 'active'
    WHERE p.query_clean <> ''
      AND acc.profile_bio IS NOT NULL
      AND btrim(acc.profile_bio) <> ''
      AND public.creator_search_normalize(acc.profile_bio) LIKE '%' || p.query_clean || '%'

    UNION

    SELECT 'influencer'::text, acc.influencer_id
    FROM public.influencer_platform_accounts acc
    INNER JOIN public.influencers i ON i.id = acc.influencer_id AND i.status = 'active'
    WHERE p.query_clean <> ''
      AND public.creator_search_terms_blob(acc.hashtags) LIKE '%' || p.query_clean || '%'
      AND EXISTS (
        SELECT 1
        FROM unnest(coalesce(acc.hashtags, '{}'::text[])) AS ht(tag)
        WHERE public.creator_search_normalize(regexp_replace(tag, '^#+', '')) LIKE '%' || p.query_clean || '%'
      )

    UNION

    SELECT 'influencer'::text, i.id
    FROM public.influencers i
    WHERE i.status = 'active'
      AND p.query_clean <> ''
      AND public.creator_search_terms_blob(i.categories) LIKE '%' || p.query_clean || '%'
      AND EXISTS (
        SELECT 1
        FROM unnest(coalesce(i.categories, '{}'::text[])) AS cat(value)
        WHERE public.creator_search_normalize(cat.value) LIKE '%' || p.query_clean || '%'
      )

    UNION

    SELECT 'influencer'::text, acc.influencer_id
    FROM public.influencer_platform_accounts acc
    INNER JOIN public.influencers i ON i.id = acc.influencer_id AND i.status = 'active'
    WHERE p.query_clean <> ''
      AND public.creator_search_terms_blob(acc.interest_categories) LIKE '%' || p.query_clean || '%'
      AND EXISTS (
        SELECT 1
        FROM unnest(coalesce(acc.interest_categories, '{}'::text[])) AS ic(value)
        WHERE public.creator_search_normalize(ic.value) LIKE '%' || p.query_clean || '%'
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
      AND p.query_raw <> ''
      AND i.search_vector IS NOT NULL
      AND i.search_vector @@ websearch_to_tsquery('simple', p.query_raw)

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
        OR (
          acc.profile_bio IS NOT NULL
          AND btrim(acc.profile_bio) <> ''
          AND public.creator_search_normalize(acc.profile_bio) % p.query_clean
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

    SELECT 'influencer'::text, acc.influencer_id
    FROM public.influencer_platform_accounts acc
    INNER JOIN public.influencers i ON i.id = acc.influencer_id AND i.status = 'active'
    CROSS JOIN params p
    CROSS JOIN unnest(p.query_tokens) AS tok(token)
    WHERE cardinality(p.query_tokens) > 0
      AND acc.profile_bio IS NOT NULL
      AND btrim(acc.profile_bio) <> ''
      AND (
        public.creator_search_normalize(acc.profile_bio) LIKE tok.token || '%'
        OR public.creator_search_normalize(acc.profile_bio) LIKE '% ' || tok.token || '%'
      )

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
      AND p.query_clean <> ''
      AND public.creator_search_terms_blob(dp.category_tags) LIKE '%' || p.query_clean || '%'
      AND EXISTS (
        SELECT 1
        FROM unnest(coalesce(dp.category_tags, '{}'::text[])) AS tag(value)
        WHERE public.creator_search_normalize(tag.value) LIKE '%' || p.query_clean || '%'
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
      AND p.query_raw <> ''
      AND dp.search_vector IS NOT NULL
      AND dp.search_vector @@ websearch_to_tsquery('simple', p.query_raw)

    UNION

    SELECT 'discovered'::text, dp.id
    FROM public.discovered_profiles dp
    WHERE dp.influencer_id IS NULL
      AND NOT public.creator_search_is_synthetic_username(dp.username::text)
      AND p.query_clean <> ''
      AND (
        public.creator_search_normalize(coalesce(dp.display_name, '')) % p.query_clean
        OR public.creator_search_normalize(coalesce(dp.username::text, '')) % p.query_clean
        OR public.creator_search_normalize(coalesce(dp.bio, '')) % p.query_clean
      )
  ) AS ck(source_type, creator_id)
  WHERE p.query_raw <> '';
$function$;

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
      s.rank + CASE WHEN s.rank >= 850 THEN 20000
        WHEN (s.source_type='influencer' AND (
          EXISTS(SELECT 1 FROM public.discovery_shortlist_items u WHERE u.influencer_id=s.creator_id OR u.unified_id='inf:'||s.creator_id::text)
          OR EXISTS(SELECT 1 FROM public.quotation_items u WHERE u.influencer_id=s.creator_id)
          OR EXISTS(SELECT 1 FROM public.campaign_influencers u WHERE u.influencer_id=s.creator_id AND (u.shortlist_assignment_status IS NULL OR u.shortlist_assignment_status <> 'removed'))
        )) OR (s.source_type='discovered' AND (
          EXISTS(SELECT 1 FROM public.discovery_shortlist_items u WHERE u.profile_id=s.creator_id OR u.unified_id='dis:'||s.creator_id::text)
          OR EXISTS(SELECT 1 FROM public.quotation_items u WHERE u.profile_id=s.creator_id)
        )) THEN 10000 ELSE 0 END AS rank
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

CREATE OR REPLACE FUNCTION public.discovery_normal_candidate_window(p_query text DEFAULT ''::text, p_offset integer DEFAULT 0, p_limit integer DEFAULT 200, p_content boolean DEFAULT false, p_dates boolean DEFAULT false, p_filters jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE answer jsonb;
BEGIN
  IF NOT coalesce((public.has_permission('discovery.read') OR public.has_permission('influencers.read')),false) THEN
    RAISE EXCEPTION 'Insufficient permissions for Discovery' USING ERRCODE='42501';
  END IF;
  IF p_offset IS NULL OR p_limit IS NULL OR p_offset < 0 OR p_offset > 10000 OR p_limit < 1 OR p_limit > 200 THEN
    RAISE EXCEPTION 'Invalid Discovery window';
  END IF;
  IF p_filters IS NULL OR jsonb_typeof(p_filters)<>'object' OR octet_length(p_filters::text)>20000 THEN
    RAISE EXCEPTION 'Invalid Discovery filters';
  END IF;
  WITH indexed_hits AS MATERIALIZED (
    SELECT source_type,creator_id,rank,has_more FROM public.search_creators_impl(p_query, p_limit, p_offset) WHERE btrim(coalesce(p_query,''))<>''
    UNION ALL
    SELECT * FROM public.discovery_normal_filter_candidates(p_filters,p_limit,p_offset) WHERE btrim(coalesce(p_query,''))=''
  ), fallback_pool AS (
    -- Preserve stale-index fallback, and only activate it when the first lexical
    -- window is empty (never fill later pages with unrelated fallback matches).
    SELECT i.id AS creator_id, 'influencer'::text AS source_type,
      CASE WHEN EXISTS(SELECT 1 FROM public.influencer_platform_accounts a WHERE a.influencer_id=i.id AND lower(ltrim(coalesce(a.normalized_username,a.username,a.handle),'@'))=lower(ltrim(p_query,'@'))) THEN 1000::real ELSE 100::real END AS rank
    FROM public.influencers i
    WHERE i.status='active' AND btrim(p_query)<>''
      AND NOT EXISTS(SELECT 1 FROM indexed_hits)
      AND (p_offset=0 OR NOT EXISTS(SELECT 1 FROM public.search_creators_impl(p_query,1,0)))
      AND (EXISTS(SELECT 1 FROM public.influencer_platform_accounts a WHERE a.influencer_id=i.id AND
        CASE WHEN left(p_query,1)='@' THEN starts_with(lower(ltrim(coalesce(a.normalized_username,a.username,a.handle),'@')),lower(ltrim(p_query,'@')))
        ELSE strpos(lower(coalesce(a.normalized_username,a.username,a.handle)),lower(p_query))>0 END)
        OR (left(p_query,1)<>'@' AND strpos(lower(i.display_name),lower(p_query))>0))
  ), fallback_page AS MATERIALIZED (
    SELECT * FROM fallback_pool ORDER BY rank DESC,creator_id LIMIT p_limit+1 OFFSET p_offset
  ), hits AS MATERIALIZED (
    SELECT source_type,creator_id,rank,has_more FROM indexed_hits
    UNION ALL
    SELECT source_type,creator_id,rank,(SELECT count(*)>p_limit FROM fallback_page) FROM fallback_page
    WHERE NOT EXISTS(SELECT 1 FROM indexed_hits)
    ORDER BY rank DESC,creator_id LIMIT p_limit
  ), internal_rows AS (
    SELECT h.creator_id, h.source_type, h.rank, h.has_more,
      jsonb_build_object(
        'unified_id','inf:'||i.id, 'influencer_id',i.id, 'discovered_profile_id',NULL,
        'source_type',CASE WHEN EXISTS(SELECT 1 FROM public.discovered_profiles dp WHERE dp.influencer_id=i.id) OR EXISTS(SELECT 1 FROM public.creator_sources cs WHERE cs.influencer_id=i.id) THEN 'imported' WHEN a.oauth_verified THEN 'oauth_verified' ELSE 'internal' END,'document_number',i.document_number,'display_name',i.display_name,
        'status',i.status,'country_code',coalesce(i.country_code,d.document#>>'{audience,country,value}'),'country_codes',i.country_codes,
        'estimated_country',i.country_code,'city',i.city,'categories',i.categories,
        'language_codes',i.languages,'profile_image_url',coalesce(i.primary_avatar_url,a.avatar),
        'bio',coalesce(a.bio,i.notes),'hashtags',a.hashtags,'platforms',coalesce(a.accounts,'[]'::jsonb),
        'default_metrics_platform_account_id',i.default_metrics_platform_account_id,
        'ai_niche',d.document#>>'{scores,aiNiche,value}',
        'thinkway_score',i.thinkway_score,'stored_thinkway_score',i.thinkway_score,
        'source_confidence',i.source_confidence,'last_enriched_at',i.last_enriched_at,'updated_at',i.updated_at,
        'content_text',a.content_text,'last_post_at',a.last_post_at,'search_rank',h.rank,
        'audience_demographics',jsonb_build_object('source',coalesce(i.demographic_source,'unavailable'),
          'topCountries',i.audience_top_countries,'topCities',NULL,
          'gender',jsonb_build_object('male',i.audience_gender_male,'female',i.audience_gender_female,'unknown',i.audience_gender_unknown),
          'age',jsonb_build_object('13_17',i.audience_age_13_17,'18_24',i.audience_age_18_24,'25_34',i.audience_age_25_34,'35_44',i.audience_age_35_44,'45_54',i.audience_age_45_54,'55_plus',i.audience_age_55_plus))
      ) AS item
    FROM hits h JOIN public.influencers i ON h.source_type='influencer' AND i.id=h.creator_id
    LEFT JOIN public.creator_dna d ON d.influencer_id=i.id
    LEFT JOIN LATERAL (
      SELECT jsonb_agg(jsonb_build_object('id',acc.id,'platform',acc.platform,'handle',acc.handle,
        'profile_url',acc.profile_url,'follower_count',acc.follower_count,'engagement_rate',acc.engagement_rate,
        'avg_likes',acc.avg_likes,'avg_comments',acc.avg_comments,'avg_views',acc.avg_views,
        'audience_country',acc.audience_country,'is_verified',acc.is_verified,
        'profile_picture_url',acc.profile_picture_url,'recent_publications',feed.items) ORDER BY acc.is_primary DESC NULLS LAST,acc.id) AS accounts,
        (array_agg(acc.metrics_source='synced' AND acc.sync_status='synced' ORDER BY (acc.id=i.default_metrics_platform_account_id) DESC NULLS LAST,acc.is_primary DESC NULLS LAST,acc.id))[1] AS oauth_verified,
        (array_agg(acc.profile_picture_url ORDER BY acc.is_primary DESC NULLS LAST,acc.id) FILTER (WHERE acc.profile_picture_url IS NOT NULL))[1] AS avatar,
        string_agg(acc.profile_bio,' ') AS bio,
        string_to_array(string_agg(array_to_string(acc.hashtags,' '),' '),' ') AS hashtags,
        CASE WHEN p_content THEN left(string_agg(pub.content_text,' '),12000) END AS content_text,
        max(pub.last_post_at) AS last_post_at
      FROM public.influencer_platform_accounts acc
      LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object('url',post->>'url','thumbnail',post->>'thumbnail','displayUrl',post->>'displayUrl','isVideo',post->'isVideo','posted_at',post->>'posted_at') ORDER BY n) AS items
        FROM (VALUES (acc.recent_publications->0,0),(acc.recent_publications->1,1),(acc.recent_publications->2,2)) AS f(post,n)
        WHERE post IS NOT NULL
      ) feed ON true
      LEFT JOIN LATERAL (
        SELECT CASE WHEN p_content THEN string_agg(left(post->>'caption',1000),' ') FILTER (WHERE n<=30) END AS content_text,
          CASE WHEN p_dates THEN max(post->>'posted_at') END AS last_post_at
        FROM jsonb_array_elements(CASE WHEN (p_content OR p_dates) AND jsonb_typeof(acc.recent_publications)='array' THEN acc.recent_publications ELSE '[]'::jsonb END) WITH ORDINALITY AS p(post,n)
        WHERE p_dates OR n<=30
      ) pub ON true
      WHERE acc.influencer_id=i.id
    ) a ON true
  ), discovered_rows AS (
    SELECT h.creator_id,h.source_type,h.rank,h.has_more,
      jsonb_build_object('unified_id','dis:'||dp.id,'influencer_id',NULL,'discovered_profile_id',dp.id,
        'source_type','public_discovery','display_name',coalesce(dp.display_name,dp.username),'status',dp.stage,
        'country_code',dp.country_code,'estimated_country',dp.country_code,'city',dp.city,
        'categories',dp.category_tags,'language_codes',dp.language_codes,'profile_image_url',dp.profile_image_url,
        'bio',dp.bio,'ai_niche',ai.niche,'thinkway_score',dp.thinkway_score,'stored_thinkway_score',dp.thinkway_score,
        'source_confidence',dp.source_confidence,'last_enriched_at',dp.last_enriched_at,'updated_at',dp.updated_at,'search_rank',h.rank,
        'platforms',jsonb_build_array(jsonb_build_object('id',dp.id,'platform',dp.platform,'handle',dp.username,
          'profile_url',dp.profile_url,'follower_count',m.followers,'engagement_rate',m.engagement_rate,
          'avg_likes',m.avg_likes,'avg_comments',m.avg_comments,'avg_views',m.avg_views,'audience_country',NULL))) AS item
    FROM hits h JOIN public.discovered_profiles dp ON h.source_type='discovered' AND dp.id=h.creator_id
    LEFT JOIN LATERAL (SELECT followers,engagement_rate,avg_likes,avg_comments,avg_views FROM public.profile_metrics WHERE profile_id=dp.id ORDER BY captured_at DESC,id LIMIT 1) m ON true
    LEFT JOIN LATERAL (SELECT niche FROM public.profile_ai_scores WHERE profile_id=dp.id ORDER BY scored_at DESC,id LIMIT 1) ai ON true
    WHERE NOT EXISTS (
      SELECT 1 FROM public.influencer_platform_accounts owned
      JOIN public.influencers owner ON owner.id=owned.influencer_id AND owner.status='active'
      WHERE lower(owned.platform)=lower(dp.platform::text)
        AND lower(ltrim(coalesce(owned.normalized_username,owned.username,owned.handle),'@'))=lower(ltrim(dp.username,'@'))
    )
  ), combined AS (SELECT * FROM internal_rows UNION ALL SELECT * FROM discovered_rows)
  SELECT jsonb_build_object('items',coalesce(jsonb_agg(item ORDER BY rank DESC,creator_id),'[]'::jsonb),
    'scannedCount',(SELECT count(*) FROM hits),'exhausted',NOT coalesce((SELECT bool_or(has_more) FROM hits),false)) INTO answer FROM combined;
  RETURN answer;
END $function$;

COMMIT;

