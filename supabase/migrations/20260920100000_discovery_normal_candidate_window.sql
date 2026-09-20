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
      AND (cardinality(f.platforms)=0 OR lower(btrim(dp.platform))=ANY(f.platforms)
        OR lower(btrim(dp.platform)) NOT IN ('instagram','tiktok','youtube','facebook','twitter','snapchat','linkedin'))
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

-- Discovery Phase 1. Read-only compact candidate windows; NOT applied to Production.
-- Reuses the existing lexical retrieval and permission gate. No materialized catalog,
-- no DNA schema changes, no acquisition/coverage calls. Final ranking is streaming server-side.
CREATE OR REPLACE FUNCTION public.discovery_normal_candidate_window(
  p_query text DEFAULT '', p_offset integer DEFAULT 0, p_limit integer DEFAULT 200,
  p_content boolean DEFAULT false, p_dates boolean DEFAULT false, p_filters jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
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
      AND NOT EXISTS(SELECT 1 FROM public.search_creators_impl(p_query,1,0))
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
      WHERE lower(owned.platform)=lower(dp.platform)
        AND lower(ltrim(coalesce(owned.normalized_username,owned.username,owned.handle),'@'))=lower(ltrim(dp.username,'@'))
    )
  ), combined AS (SELECT * FROM internal_rows UNION ALL SELECT * FROM discovered_rows)
  SELECT jsonb_build_object('items',coalesce(jsonb_agg(item ORDER BY rank DESC,creator_id),'[]'::jsonb),
    'scannedCount',(SELECT count(*) FROM hits),'exhausted',NOT coalesce((SELECT bool_or(has_more) FROM hits),false)) INTO answer FROM combined;
  RETURN answer;
END $$;
REVOKE ALL ON FUNCTION public.discovery_normal_candidate_window(text,integer,integer,boolean,boolean,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.discovery_normal_candidate_window(text,integer,integer,boolean,boolean,jsonb) TO authenticated;
