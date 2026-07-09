-- Discovery search: bio, hashtags, and categories contribute to candidate matching and rank.
-- Extends search_blob (substring/trigram tiers) and candidate prefilter for influencers.

-- Strip @ and # prefixes from each query token (e.g. "#beauty travel" → "beauty travel").
CREATE OR REPLACE FUNCTION public.creator_search_clean_query(p_query text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(
    nullif(
      trim(both ' ' FROM string_agg(
        public.creator_search_normalize(regexp_replace(tok, '^[@#]+', '')),
        ' '
        ORDER BY ord
      )),
      ''
    ),
    ''
  )
  FROM unnest(regexp_split_to_array(btrim(coalesce(p_query, '')), '\s+'))
    WITH ORDINALITY AS t(tok, ord)
  WHERE btrim(tok) <> '';
$$;

CREATE OR REPLACE FUNCTION public.creator_search_tokens(p_query text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(
    array_remove(
      regexp_split_to_array(public.creator_search_clean_query(p_query), '\s+'),
      ''
    ),
    ARRAY[]::text[]
  );
$$;

-- Boost hashtag weight in FTS vector (was D; bio/categories remain B).
CREATE OR REPLACE FUNCTION public.build_influencer_search_vector(p_influencer_id uuid)
RETURNS tsvector
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  inf record;
  acc record;
  vec tsvector := ''::tsvector;
  pub_text text;
  meta_text text;
  acc_meta_text text;
  verified_text text;
BEGIN
  SELECT *
  INTO inf
  FROM public.influencers
  WHERE id = p_influencer_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  meta_text := public.creator_metadata_search_text(inf.metadata);

  vec :=
    setweight(to_tsvector('simple', coalesce(inf.display_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(inf.legal_name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(inf.document_number, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(inf.categories, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(inf.notes, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(inf.city, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(inf.country_code::text, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(inf.nationality, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(array_to_string(inf.languages, ' '), '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(inf.email::text, '')), 'D') ||
    setweight(to_tsvector('simple', coalesce(inf.influencer_url, '')), 'D') ||
    setweight(to_tsvector('simple', meta_text), 'D');

  FOR acc IN
    SELECT *
    FROM public.influencer_platform_accounts
    WHERE influencer_id = p_influencer_id
  LOOP
    pub_text := public.creator_recent_publications_text(acc.recent_publications);
    acc_meta_text := public.creator_metadata_search_text(acc.metadata);
    verified_text := CASE WHEN coalesce(acc.is_verified, false) THEN 'verified' ELSE '' END;

    vec := vec ||
      setweight(to_tsvector('simple', coalesce(acc.handle::text, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(acc.username::text, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(acc.profile_display_name, '')), 'A') ||
      setweight(to_tsvector('simple', coalesce(acc.profile_bio, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(acc.platform, '')), 'D') ||
      setweight(to_tsvector('simple', verified_text), 'D') ||
      setweight(to_tsvector('simple', coalesce(acc.audience_country, '')), 'B') ||
      setweight(to_tsvector('simple', coalesce(array_to_string(acc.interest_categories, ' '), '')), 'B') ||
      setweight(to_tsvector('simple', acc_meta_text), 'B') ||
      setweight(to_tsvector('simple', pub_text), 'C') ||
      setweight(to_tsvector('simple', coalesce(array_to_string(acc.hashtags, ' '), '')), 'C') ||
      setweight(to_tsvector('simple', coalesce(array_to_string(acc.mentions, ' '), '')), 'D') ||
      setweight(to_tsvector('simple', coalesce(acc.contact_email::text, '')), 'D') ||
      setweight(to_tsvector('simple', public.creator_contact_links_text(acc.contact_links)), 'D');
  END LOOP;

  RETURN vec;
END;
$$;

-- Rebuild influencer FTS after weight change.
UPDATE public.influencers i
SET search_vector = public.build_influencer_search_vector(i.id)
WHERE i.status IS DISTINCT FROM 'archived';

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
$$;

-- search_creators: enrich search_blob used by substring/trigram rank tiers.
CREATE OR REPLACE FUNCTION public.search_creators(
  p_query text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  source_type text,
  creator_id uuid,
  rank real,
  has_more boolean,
  total_count bigint
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
    (SELECT count(*) FROM page) > GREATEST(p_limit, 0) AS has_more,
    CASE
      WHEN GREATEST(p_offset, 0) = 0 THEN (SELECT cnt FROM total_matches)
      ELSE NULL::bigint
    END AS total_count
  FROM page
  LIMIT GREATEST(p_limit, 0);
$$;

GRANT EXECUTE ON FUNCTION public.search_creators(text, integer, integer) TO authenticated, service_role;

-- Category browse: also match platform interest_categories (case-insensitive).
CREATE OR REPLACE FUNCTION public.browse_influencer_ids_for_categories(
  p_categories text[] DEFAULT '{}',
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
  WITH normalized_filters AS (
    SELECT DISTINCT lower(trim(value)) AS category_key
    FROM unnest(coalesce(p_categories, '{}'::text[])) AS value
    WHERE nullif(trim(value), '') IS NOT NULL
      AND trim(value) <> '__uncategorized__'
  ),
  include_uncategorized AS (
    SELECT EXISTS (
      SELECT 1
      FROM unnest(coalesce(p_categories, '{}'::text[])) AS value
      WHERE trim(value) = '__uncategorized__'
    ) AS enabled
  ),
  filtered AS (
    SELECT i.id, i.updated_at
    FROM public.influencers i
    CROSS JOIN include_uncategorized u
    WHERE i.status = 'active'
      AND (
        p_country IS NULL
        OR nullif(trim(p_country), '') IS NULL
        OR i.country_code = upper(trim(p_country))
      )
      AND (
        p_language IS NULL
        OR nullif(trim(p_language), '') IS NULL
        OR i.languages @> ARRAY[trim(p_language)]
      )
      AND (
        cardinality(coalesce(p_categories, '{}'::text[])) = 0
        OR (
          EXISTS (
            SELECT 1
            FROM unnest(coalesce(i.categories, '{}'::text[])) AS stored(category_value)
            JOIN normalized_filters nf
              ON lower(trim(stored.category_value)) = nf.category_key
          )
        )
        OR (
          EXISTS (
            SELECT 1
            FROM public.influencer_platform_accounts ipa
            CROSS JOIN unnest(coalesce(ipa.interest_categories, '{}'::text[])) AS interest(value)
            JOIN normalized_filters nf
              ON lower(trim(interest.value)) = nf.category_key
            WHERE ipa.influencer_id = i.id
          )
        )
        OR (
          u.enabled
          AND (
            i.categories IS NULL
            OR cardinality(i.categories) = 0
            OR NOT EXISTS (
              SELECT 1
              FROM unnest(i.categories) AS stored(category_value)
              WHERE nullif(trim(stored.category_value), '') IS NOT NULL
            )
          )
        )
      )
  ),
  totals AS (
    SELECT count(*)::bigint AS total_count
    FROM filtered
  )
  SELECT f.id, t.total_count
  FROM filtered f
  CROSS JOIN totals t
  ORDER BY f.updated_at DESC NULLS LAST, f.id
  LIMIT greatest(coalesce(p_limit, 50), 1)
  OFFSET greatest(coalesce(p_offset, 0), 0);
$$;

REVOKE ALL ON FUNCTION public.browse_influencer_ids_for_categories(text[], text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.browse_influencer_ids_for_categories(text[], text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.browse_influencer_ids_for_categories(text[], text, text, int, int) TO service_role;
