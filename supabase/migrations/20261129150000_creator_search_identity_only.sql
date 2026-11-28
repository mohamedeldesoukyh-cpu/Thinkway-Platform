-- Search text qualifies creators only by names and handles. Category/content filters remain separate.
-- Preserve indexed identity matching, fuzzy names, security settings and prior-use ranking.
BEGIN;
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
      AND p.query_clean <> ''
      AND (
        public.creator_search_normalize(i.display_name) % p.query_clean
        OR (
          i.legal_name IS NOT NULL
          AND btrim(i.legal_name) <> ''
          AND public.creator_search_normalize(i.legal_name) % p.query_clean
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
      )

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
$function$;


COMMIT;
