-- Restore the pre-optimization helper only; public RPC and permissions remain unchanged.
BEGIN;
-- Private ID-only prequalification. Conservative predicates preserve inference/family semantics;
-- the existing server evaluator remains authoritative. No full profile/DNA hydration here.
CREATE OR REPLACE FUNCTION public.discovery_normal_filter_candidates(
  p_filters jsonb, p_limit integer, p_offset integer
) RETURNS TABLE(source_type text, creator_id uuid, rank real, has_more boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = pg_catalog, public, pg_temp AS $$
  WITH f AS (
    SELECT ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'countries','[]'))) AS countries,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'countryValues','[]'))) AS country_values,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'categories','[]'))) AS categories,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'platforms','[]'))) AS platforms,
      ARRAY(SELECT jsonb_array_elements_text(coalesce(p_filters->'languages','[]'))) AS languages,
      coalesce(p_filters->'ranges','[]') AS ranges,
      (p_filters->>'minEngagement')::numeric AS min_er,
      (p_filters->>'minViews')::numeric AS min_views,
      (p_filters->>'minThinkway')::numeric AS min_thinkway
  ), qualified_accounts AS NOT MATERIALIZED (
    SELECT a.influencer_id FROM public.influencer_platform_accounts a CROSS JOIN f
    WHERE (cardinality(f.platforms)=0 OR lower(btrim(a.platform))=ANY(f.platforms)
      OR lower(btrim(a.platform)) NOT IN ('instagram','tiktok','youtube','facebook','twitter','snapchat','linkedin'))
      AND (jsonb_array_length(f.ranges)=0 OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(f.ranges) r
        WHERE a.follower_count >= (r->>'min')::numeric AND ((r->>'max') IS NULL OR a.follower_count <= (r->>'max')::numeric)))
      AND (f.min_er IS NULL OR a.engagement_rate >= f.min_er)
      AND (f.min_views IS NULL OR a.avg_views >= f.min_views)
  ), eligible_ids AS (
    SELECT 'influencer'::text AS source_type,i.id AS creator_id
    FROM public.influencers i CROSS JOIN f
    WHERE i.status='active'
      AND (cardinality(f.platforms)=0 AND jsonb_array_length(f.ranges)=0 AND f.min_er IS NULL AND f.min_views IS NULL
        OR EXISTS(SELECT 1 FROM qualified_accounts a WHERE a.influencer_id=i.id))
      AND (f.min_thinkway IS NULL OR i.thinkway_score >= f.min_thinkway)
      AND (cardinality(f.languages)=0 OR EXISTS(SELECT 1 FROM unnest(i.languages) l WHERE lower(btrim(l))=ANY(f.languages)))
      AND (cardinality(f.categories)=0 OR '__uncategorized__'=ANY(f.categories) OR EXISTS (
        SELECT 1 FROM unnest(i.categories) c WHERE lower(btrim(c))=ANY(f.categories)
        OR (btrim(c) ~* '^(beauty([[:space:]]*&[[:space:]]*cosmetics)?|skincare|makeup|make-up|cosmetics?)$'
          AND EXISTS(SELECT 1 FROM unnest(f.categories) wanted WHERE wanted ~* '^(beauty([[:space:]]*&[[:space:]]*cosmetics)?|skincare|makeup|make-up|cosmetics?)$'))))
      AND (cardinality(f.countries)=0 OR lower(btrim(i.country_code))=ANY(f.country_values) OR i.country_codes && f.countries
        OR EXISTS(SELECT 1 FROM unnest(i.country_codes) c WHERE lower(btrim(c))=ANY(f.country_values) OR c !~ '^[A-Z]{2}$')
        OR EXISTS(SELECT 1 FROM public.influencer_platform_accounts a WHERE a.influencer_id=i.id
          AND (lower(btrim(a.audience_country))=ANY(f.country_values) OR nullif(a.audience_country,'') !~ '^[A-Z]{2}$'))
        OR EXISTS(SELECT 1 FROM public.creator_dna d WHERE d.influencer_id=i.id
          AND lower(btrim(d.document#>>'{audience,country,value}'))=ANY(f.country_values))
        -- Preserve unknown/noncanonical location for the existing profile-country inference.
        OR (coalesce(i.country_code,'') !~ '^[A-Z]{2}$' AND cardinality(coalesce(i.country_codes,'{}'))=0))
    UNION ALL
    SELECT 'discovered'::text,dp.id
    FROM public.discovered_profiles dp CROSS JOIN f
    LEFT JOIN LATERAL (SELECT followers,engagement_rate,avg_views FROM public.profile_metrics
      WHERE profile_id=dp.id ORDER BY captured_at DESC,id LIMIT 1) m ON true
    WHERE dp.influencer_id IS NULL AND NOT public.creator_search_is_synthetic_username(dp.username::text)
      AND (cardinality(f.platforms)=0 OR lower(btrim(dp.platform::text))=ANY(f.platforms)
        OR lower(btrim(dp.platform::text)) NOT IN ('instagram','tiktok','youtube','facebook','twitter','snapchat','linkedin'))
      AND (jsonb_array_length(f.ranges)=0 OR EXISTS(SELECT 1 FROM jsonb_array_elements(f.ranges) r
        WHERE m.followers >= (r->>'min')::numeric AND ((r->>'max') IS NULL OR m.followers <= (r->>'max')::numeric)))
      AND (f.min_er IS NULL OR m.engagement_rate >= f.min_er)
      AND (f.min_views IS NULL OR m.avg_views >= f.min_views)
      AND (f.min_thinkway IS NULL OR dp.thinkway_score >= f.min_thinkway)
      AND (cardinality(f.languages)=0 OR EXISTS(SELECT 1 FROM unnest(dp.language_codes) l WHERE lower(btrim(l))=ANY(f.languages)))
      AND (cardinality(f.categories)=0 OR '__uncategorized__'=ANY(f.categories) OR EXISTS (
        SELECT 1 FROM unnest(dp.category_tags) c WHERE lower(btrim(c))=ANY(f.categories)
        OR (btrim(c) ~* '^(beauty([[:space:]]*&[[:space:]]*cosmetics)?|skincare|makeup|make-up|cosmetics?)$'
          AND EXISTS(SELECT 1 FROM unnest(f.categories) wanted WHERE wanted ~* '^(beauty([[:space:]]*&[[:space:]]*cosmetics)?|skincare|makeup|make-up|cosmetics?)$'))))
      AND (cardinality(f.countries)=0 OR lower(btrim(dp.country_code))=ANY(f.country_values) OR coalesce(dp.country_code,'') !~ '^[A-Z]{2}$')
  ), page AS MATERIALIZED (
    SELECT * FROM eligible_ids ORDER BY source_type,creator_id LIMIT p_limit+1 OFFSET p_offset
  )
  SELECT source_type,creator_id,0::real,(SELECT count(*)>p_limit FROM page) FROM page
  ORDER BY source_type,creator_id LIMIT p_limit;
$$;
REVOKE ALL ON FUNCTION public.discovery_normal_filter_candidates(jsonb,integer,integer) FROM PUBLIC,anon,authenticated;

COMMIT;
