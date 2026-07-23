-- Match category browse country filter against primary country_code OR country_codes array.
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
        OR coalesce(i.country_codes, '{}'::text[]) @> ARRAY[upper(trim(p_country))]
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
  ranked AS (
    SELECT f.id, count(*) OVER () AS total_count
    FROM filtered f
    ORDER BY f.updated_at DESC NULLS LAST, f.id
    LIMIT greatest(p_limit, 0)
    OFFSET greatest(p_offset, 0)
  )
  SELECT ranked.id, ranked.total_count
  FROM ranked;
$$;

REVOKE ALL ON FUNCTION public.browse_influencer_ids_for_categories(text[], text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.browse_influencer_ids_for_categories(text[], text, text, int, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.browse_influencer_ids_for_categories(text[], text, text, int, int) TO service_role;
