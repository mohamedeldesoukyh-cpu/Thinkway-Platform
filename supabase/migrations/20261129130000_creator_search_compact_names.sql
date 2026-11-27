-- Shared Discovery / picker search: match names with or without spaces.
-- Preserve permission checks, topic search and exact handle priority.
BEGIN;
CREATE OR REPLACE FUNCTION public.creator_search_compact_name(value text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public
AS $$ SELECT replace(public.creator_search_normalize(coalesce(value, '')), ' ', ''); $$;

CREATE INDEX IF NOT EXISTS influencers_display_name_compact_idx
  ON public.influencers USING gin (public.creator_search_compact_name(display_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS influencers_legal_name_compact_idx
  ON public.influencers USING gin (public.creator_search_compact_name(legal_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS influencer_platform_accounts_profile_display_name_compact_idx
  ON public.influencer_platform_accounts USING gin (public.creator_search_compact_name(profile_display_name) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS discovered_profiles_display_name_compact_idx
  ON public.discovered_profiles USING gin (public.creator_search_compact_name(display_name) gin_trgm_ops);

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

  -- Compact names rank below exact names and handles, above topic matches.
  IF length(public.creator_search_compact_name(p_query_clean)) >= 2 THEN
    IF EXISTS (
      SELECT 1 FROM unnest(coalesce(p_full_names, ARRAY[]::text[])) AS n(full_name)
      WHERE public.creator_search_compact_name(full_name) = public.creator_search_compact_name(p_query_clean)
    ) THEN
      RETURN 850.0;
    END IF;
    IF EXISTS (
      SELECT 1 FROM unnest(coalesce(p_full_names, ARRAY[]::text[])) AS n(full_name)
      WHERE public.creator_search_compact_name(full_name) LIKE public.creator_search_compact_name(p_query_clean) || '%'
    ) THEN
      v_rank := 790.0;
    END IF;
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

  IF v_rank IS NOT NULL THEN RETURN v_rank; END IF;

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

CREATE OR REPLACE FUNCTION public.creator_search_candidate_keys(p_query text)
RETURNS TABLE (
  source_type text,
  creator_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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

-- Candidate IDs remain internal; clients use permission-checked search_creators.
REVOKE ALL ON FUNCTION public.creator_search_candidate_keys(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.creator_search_candidate_keys(text) TO service_role;
COMMIT;
