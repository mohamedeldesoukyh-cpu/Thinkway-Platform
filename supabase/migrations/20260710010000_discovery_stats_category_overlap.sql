-- Count creators per category tag (overlap), aligned with browse category filters.

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

REVOKE ALL ON FUNCTION public.get_discovery_database_stats(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_discovery_database_stats(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_discovery_database_stats(int) TO service_role;
