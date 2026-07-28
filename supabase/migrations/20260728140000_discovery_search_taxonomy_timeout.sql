-- Creator Search SSR calls get_discovery_search_taxonomy() on every cold load.
-- Under authenticated RLS the DISTINCT/unnest scan can exceed the default ~8s
-- statement_timeout, which previously crashed /discovery/search (throw in
-- lib/discovery/search-taxonomy.ts). Raise the function-local timeout so the
-- RPC can finish; the app still soft-fails on cancel as a safety net.

CREATE OR REPLACE FUNCTION public.get_discovery_search_taxonomy()
RETURNS TABLE (term text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
SET statement_timeout = '30s'
AS $$
  SELECT DISTINCT lower(trim(value)) AS term
  FROM (
    SELECT unnest(coalesce(i.categories, '{}'::text[])) AS value
    FROM public.influencers i
    WHERE i.status IS DISTINCT FROM 'archived'

    UNION ALL

    SELECT unnest(coalesce(ipa.interest_categories, '{}'::text[])) AS value
    FROM public.influencer_platform_accounts ipa
    JOIN public.influencers i ON i.id = ipa.influencer_id
    WHERE i.status IS DISTINCT FROM 'archived'

    UNION ALL

    SELECT unnest(coalesce(ipa.hashtags, '{}'::text[])) AS value
    FROM public.influencer_platform_accounts ipa
    JOIN public.influencers i ON i.id = ipa.influencer_id
    WHERE i.status IS DISTINCT FROM 'archived'

    UNION ALL

    SELECT h.tag::text AS value
    FROM public.hashtags h
    WHERE h.is_active = true

    UNION ALL

    SELECT unnest(coalesce(dp.category_tags, '{}'::text[])) AS value
    FROM public.discovered_profiles dp

    UNION ALL

    SELECT jsonb_array_elements_text(dp.metadata->'audience_interests') AS value
    FROM public.discovered_profiles dp
    WHERE jsonb_typeof(dp.metadata->'audience_interests') = 'array'

    UNION ALL

    SELECT jsonb_array_elements_text(dp.metadata->'categories') AS value
    FROM public.discovered_profiles dp
    WHERE jsonb_typeof(dp.metadata->'categories') = 'array'
  ) raw
  WHERE nullif(trim(value), '') IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.get_discovery_search_taxonomy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_discovery_search_taxonomy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discovery_search_taxonomy() TO service_role;
