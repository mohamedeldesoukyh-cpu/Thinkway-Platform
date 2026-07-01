-- Discovery database creator stats — RLS-respecting aggregates for Discovery UI.

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
  primary_categories AS (
    SELECT
      coalesce(
        (
          SELECT initcap(trim(c))
          FROM unnest(a.categories) AS c
          WHERE nullif(trim(c), '') IS NOT NULL
          ORDER BY trim(c)
          LIMIT 1
        ),
        'Uncategorized'
      ) AS category_label
    FROM accessible a
  ),
  category_counts AS (
    SELECT
      pc.category_label,
      count(*)::bigint AS category_count
    FROM primary_categories pc
    GROUP BY pc.category_label
    ORDER BY category_count DESC, pc.category_label
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
