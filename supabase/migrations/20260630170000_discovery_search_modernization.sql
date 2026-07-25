-- Discovery search modernization: trigram + unaccent prefix/contains/fuzzy matching
-- and unified search_creators RPC (replaces FTS-only short-circuit paths).

CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- Supabase provides this schema; create it for plain-Postgres / empty bootstraps.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

-- Supabase installs extensions in the `extensions` schema; qualify unaccent explicitly.
CREATE OR REPLACE FUNCTION public.creator_search_normalize(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT lower(extensions.unaccent(btrim(coalesce(p_text, ''))));
$$;

CREATE OR REPLACE FUNCTION public.creator_search_clean_query(p_query text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT public.creator_search_normalize(
    regexp_replace(btrim(coalesce(p_query, '')), '^@+', '')
  );
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

CREATE OR REPLACE FUNCTION public.creator_search_is_synthetic_username(p_username text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(p_username, '') ~* '^(tw|demo|mock|seed|fake)_'
    OR coalesce(p_username, '') ~* '^tw_[a-z0-9]+_[a-z]{2}_[0-9]{2}$';
$$;

-- -----------------------------------------------------------------------------
-- Trigram GIN indexes on searchable columns
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS influencers_display_name_trgm_idx
  ON public.influencers USING gin (public.creator_search_normalize(display_name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS influencers_legal_name_trgm_idx
  ON public.influencers USING gin (public.creator_search_normalize(legal_name) gin_trgm_ops)
  WHERE legal_name IS NOT NULL AND btrim(legal_name) <> '';

CREATE INDEX IF NOT EXISTS influencers_email_trgm_idx
  ON public.influencers USING gin (public.creator_search_normalize(email::text) gin_trgm_ops)
  WHERE email IS NOT NULL;

CREATE INDEX IF NOT EXISTS influencer_platform_accounts_username_trgm_idx
  ON public.influencer_platform_accounts USING gin (
    public.creator_search_normalize(
      coalesce(normalized_username::text, username::text, handle::text, '')
    ) gin_trgm_ops
  );

CREATE INDEX IF NOT EXISTS influencer_platform_accounts_profile_display_name_trgm_idx
  ON public.influencer_platform_accounts USING gin (
    public.creator_search_normalize(profile_display_name) gin_trgm_ops
  )
  WHERE profile_display_name IS NOT NULL AND btrim(profile_display_name) <> '';

CREATE INDEX IF NOT EXISTS discovered_profiles_display_name_trgm_idx
  ON public.discovered_profiles USING gin (
    public.creator_search_normalize(display_name) gin_trgm_ops
  )
  WHERE display_name IS NOT NULL AND btrim(display_name) <> '';

CREATE INDEX IF NOT EXISTS discovered_profiles_username_trgm_idx
  ON public.discovered_profiles USING gin (
    public.creator_search_normalize(username::text) gin_trgm_ops
  )
  WHERE username IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Rank computation (tier priority: exact username > exact name > prefix > token prefix > contains > FTS > trigram)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.creator_search_compute_rank(
  p_query_raw text,
  p_query_clean text,
  p_tokens text[],
  p_usernames text[],
  p_full_names text[],
  p_search_blob text,
  p_search_vector tsvector
)
RETURNS real
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
DECLARE
  v_rank real := NULL;
  v_fts_query tsquery;
  v_fts_rank real;
  v_trigram real;
  v_token text;
  v_all_tokens_match boolean := true;
BEGIN
  IF p_query_clean = '' THEN
    RETURN NULL;
  END IF;

  IF p_query_clean = ANY (coalesce(p_usernames, ARRAY[]::text[])) THEN
    RETURN 1000.0;
  END IF;

  IF p_query_clean = ANY (
    array_remove(coalesce(p_full_names, ARRAY[]::text[]), '')
  ) THEN
    RETURN 900.0;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(coalesce(p_usernames, ARRAY[]::text[])) AS u(username)
    WHERE username LIKE p_query_clean || '%'
  ) THEN
    RETURN 800.0 + length(p_query_clean)::real / 100.0;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(array_remove(coalesce(p_full_names, ARRAY[]::text[]), '')) AS n(full_name)
    WHERE full_name LIKE p_query_clean || '%'
  ) THEN
    RETURN 800.0 + length(p_query_clean)::real / 100.0;
  END IF;

  IF cardinality(p_tokens) > 0 THEN
    v_all_tokens_match := true;
    FOREACH v_token IN ARRAY p_tokens LOOP
      IF NOT (
        p_search_blob LIKE v_token || '%'
        OR p_search_blob LIKE '% ' || v_token || '%'
      ) THEN
        v_all_tokens_match := false;
        EXIT;
      END IF;
    END LOOP;
    IF v_all_tokens_match THEN
      RETURN 700.0 + cardinality(p_tokens)::real / 10.0;
    END IF;
  END IF;

  IF p_search_blob LIKE '%' || p_query_clean || '%' THEN
    RETURN 600.0 + length(p_query_clean)::real / 100.0;
  END IF;

  IF cardinality(p_tokens) > 1 THEN
    v_all_tokens_match := true;
    FOREACH v_token IN ARRAY p_tokens LOOP
      IF p_search_blob NOT LIKE '%' || v_token || '%' THEN
        v_all_tokens_match := false;
        EXIT;
      END IF;
    END LOOP;
    IF v_all_tokens_match THEN
      RETURN 600.0 + cardinality(p_tokens)::real / 10.0;
    END IF;
  END IF;

  IF p_search_vector IS NOT NULL AND btrim(p_query_raw) <> '' THEN
    v_fts_query := websearch_to_tsquery('simple', p_query_raw);
    IF p_search_vector @@ v_fts_query THEN
      v_fts_rank := ts_rank_cd(p_search_vector, v_fts_query);
      RETURN 500.0 + coalesce(v_fts_rank, 0) * 100.0;
    END IF;

    v_fts_query := plainto_tsquery('simple', p_query_raw);
    IF p_search_vector @@ v_fts_query THEN
      v_fts_rank := ts_rank_cd(p_search_vector, v_fts_query);
      RETURN 500.0 + coalesce(v_fts_rank, 0) * 100.0;
    END IF;
  END IF;

  v_trigram := similarity(p_search_blob, p_query_clean);
  IF v_trigram >= 0.2 THEN
    RETURN 400.0 + v_trigram * 100.0;
  END IF;

  RETURN NULL;
END;
$$;

-- Ensure search_vector exists before search_creators references it (full rebuild in 20260707010000).
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- -----------------------------------------------------------------------------
-- Unified creator search / browse RPC
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_creators(
  p_query text,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  source_type text,
  creator_id uuid,
  rank real,
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
  influencer_rows AS (
    SELECT
      'influencer'::text AS source_type,
      i.id AS creator_id,
      i.search_vector,
      coalesce(i.thinkway_score, 0)::real AS thinkway_score,
      i.updated_at,
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
    FROM public.influencers i
    LEFT JOIN public.influencer_platform_accounts acc ON acc.influencer_id = i.id
    WHERE i.status = 'active'
    GROUP BY
      i.id,
      i.search_vector,
      i.thinkway_score,
      i.updated_at,
      i.display_name,
      i.legal_name,
      i.email
  ),
  discovery_rows AS (
    SELECT
      'discovered'::text AS source_type,
      dp.id AS creator_id,
      dp.search_vector,
      coalesce(dp.thinkway_score, 0)::real AS thinkway_score,
      dp.updated_at,
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
    FROM public.discovered_profiles dp
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
      c.thinkway_score,
      c.updated_at,
      CASE
        WHEN (SELECT query_raw FROM params) = '' THEN
          c.thinkway_score / 1000.0 + 0.001
        ELSE public.creator_search_compute_rank(
          (SELECT query_raw FROM params),
          (SELECT query_clean FROM params),
          (SELECT query_tokens FROM params),
          c.usernames,
          c.full_names,
          c.search_blob,
          c.search_vector
        )
      END AS rank
    FROM catalog c
    CROSS JOIN params p
    WHERE
      p.query_raw = ''
      OR public.creator_search_compute_rank(
        p.query_raw,
        p.query_clean,
        p.query_tokens,
        c.usernames,
        c.full_names,
        c.search_blob,
        c.search_vector
      ) IS NOT NULL
      OR c.search_blob LIKE '%' || p.query_clean || '%'
      OR (
        cardinality(p.query_tokens) > 0
        AND NOT EXISTS (
          SELECT 1
          FROM unnest(p.query_tokens) AS tok(token)
          WHERE c.search_blob NOT LIKE '%' || token || '%'
        )
      )
      OR (
        c.search_vector IS NOT NULL
        AND c.search_vector @@ plainto_tsquery('simple', p.query_raw)
      )
      OR similarity(c.search_blob, p.query_clean) >= 0.2
  ),
  ranked AS (
    SELECT
      s.source_type,
      s.creator_id,
      s.rank,
      count(*) OVER () AS total_count
    FROM scored s
    WHERE s.rank IS NOT NULL
  )
  SELECT
    r.source_type,
    r.creator_id,
    r.rank,
    r.total_count
  FROM ranked r
  ORDER BY r.rank DESC, r.creator_id
  LIMIT GREATEST(p_limit, 0)
  OFFSET GREATEST(p_offset, 0);
$$;

GRANT EXECUTE ON FUNCTION public.search_creators(text, integer, integer) TO authenticated, service_role;
