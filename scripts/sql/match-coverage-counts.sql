-- Warehouse counts and operational baseline
WITH wh AS (
  SELECT
    COUNT(*) AS total,
    COUNT(*) FILTER (WHERE match_confidence > 0) AS matched,
    COUNT(*) FILTER (WHERE username IS NOT NULL AND TRIM(username) <> '') AS has_username,
    COUNT(*) FILTER (WHERE country IS NOT NULL AND TRIM(country) <> '') AS has_country,
    COUNT(*) FILTER (WHERE tier IS NOT NULL AND TRIM(tier) <> '') AS has_tier,
    COUNT(*) FILTER (
      WHERE country IS NOT NULL AND TRIM(country) <> ''
         OR tier IS NOT NULL AND TRIM(tier) <> ''
         OR username IS NOT NULL AND TRIM(username) <> ''
    ) AS database_path,
    COUNT(*) FILTER (
      WHERE NOT (
        (country IS NOT NULL AND TRIM(country) <> '')
        OR (tier IS NOT NULL AND TRIM(tier) <> '')
        OR (username IS NOT NULL AND TRIM(username) <> '')
      )
    ) AS campaign_path_sparse
  FROM intelligence.int_influencers
),
campaign_linked AS (
  SELECT DISTINCT int_influencer_id AS id
  FROM intelligence.int_campaigns
  WHERE int_influencer_id IS NOT NULL
),
linked_stats AS (
  SELECT
    COUNT(*) AS linked_total,
    COUNT(*) FILTER (WHERE i.match_confidence > 0) AS linked_matched,
    COUNT(*) FILTER (WHERE i.username IS NOT NULL AND TRIM(i.username) <> '') AS linked_has_username,
    COUNT(*) FILTER (WHERE i.country IS NOT NULL AND TRIM(i.country) <> '') AS linked_has_country,
    COUNT(*) FILTER (WHERE i.tier IS NOT NULL AND TRIM(i.tier) <> '') AS linked_has_tier
  FROM campaign_linked cl
  JOIN intelligence.int_influencers i ON i.id = cl.id
),
ops AS (
  SELECT
    (SELECT COUNT(*) FROM public.influencers) AS influencers,
    (SELECT COUNT(*) FROM public.influencer_platform_accounts) AS handles,
    (SELECT COUNT(*) FROM intelligence.entity_resolution_overrides) AS overrides
)
SELECT 'warehouse' AS section, wh.*, NULL::bigint AS linked_total, NULL::bigint AS linked_matched,
       NULL::bigint AS linked_has_username, NULL::bigint AS linked_has_country, NULL::bigint AS linked_has_tier,
       NULL::bigint AS ops_influencers, NULL::bigint AS ops_handles, NULL::bigint AS ops_overrides
FROM wh
UNION ALL
SELECT 'campaign_linked', NULL, NULL, NULL, NULL, NULL, NULL, NULL,
       ls.linked_total, ls.linked_matched, ls.linked_has_username, ls.linked_has_country, ls.linked_has_tier,
       NULL, NULL, NULL
FROM linked_stats ls
UNION ALL
SELECT 'operational', NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL, NULL,
       ops.influencers, ops.handles, ops.overrides
FROM ops;
