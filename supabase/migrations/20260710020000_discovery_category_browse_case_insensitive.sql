-- Case-insensitive influencer category browse + stats labels aligned with stored values.

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

CREATE OR REPLACE FUNCTION public.get_discovery_database_stats(
  category_limit int DEFAULT 8
)
RETURNS TABLE (
  total_creators bigint,
  categorized_creators bigint,
  category_label text,
  category_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH accessible AS (
    SELECT id, categories
    FROM public.influencers
    WHERE status IS DISTINCT FROM 'archived'
  ),
  totals AS (
    SELECT
      count(*)::bigint AS total_creators,
      count(*) FILTER (
        WHERE coalesce(array_length(categories, 1), 0) > 0
          AND EXISTS (
            SELECT 1
            FROM unnest(categories) AS c
            WHERE nullif(trim(c), '') IS NOT NULL
          )
      )::bigint AS categorized_creators
    FROM accessible
  ),
  category_tags AS (
    SELECT
      a.id,
      trim(c) AS category_label,
      lower(trim(c)) AS category_key
    FROM accessible a
    CROSS JOIN LATERAL unnest(a.categories) AS c
    WHERE nullif(trim(c), '') IS NOT NULL
  ),
  canonical_labels AS (
    SELECT
      category_key,
      mode() WITHIN GROUP (ORDER BY category_label) AS category_label
    FROM category_tags
    GROUP BY category_key
  ),
  category_counts AS (
    SELECT
      cl.category_label,
      count(DISTINCT ct.id)::bigint AS category_count
    FROM category_tags ct
    JOIN canonical_labels cl ON cl.category_key = ct.category_key
    GROUP BY cl.category_label, cl.category_key
    ORDER BY category_count DESC, cl.category_label
    LIMIT greatest(category_limit, 1)
  )
  SELECT
    t.total_creators,
    t.categorized_creators,
    cc.category_label,
    cc.category_count
  FROM totals t
  CROSS JOIN category_counts cc;
$$;

REVOKE ALL ON FUNCTION public.browse_influencer_ids_for_categories(text[], text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.browse_influencer_ids_for_categories(text[], text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.browse_influencer_ids_for_categories(text[], text, text, int, int) TO service_role;

REVOKE ALL ON FUNCTION public.get_discovery_database_stats(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_discovery_database_stats(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discovery_database_stats(int) TO service_role;
