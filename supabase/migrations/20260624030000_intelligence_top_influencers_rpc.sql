-- Intelligence top influencers — aggregated under RLS (replaces Q6 join fetch + JS median).

CREATE OR REPLACE FUNCTION intelligence.get_top_influencers(row_limit int DEFAULT 25)
RETURNS TABLE (
  id uuid,
  display_name_raw text,
  username text,
  platform text,
  country text,
  tier text,
  line_count bigint,
  total_cost_usd numeric,
  median_cost_usd numeric,
  median_margin_pct numeric,
  match_confidence numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = intelligence, public
AS $$
  SELECT
    ranked.id,
    ranked.display_name_raw,
    ranked.username,
    ranked.platform,
    ranked.country,
    ranked.tier,
    ranked.line_count,
    ranked.total_cost_usd,
    ranked.median_cost_usd,
    ranked.median_margin_pct,
    ranked.match_confidence
  FROM (
    SELECT
      a.int_influencer_id AS id,
      i.display_name_raw,
      i.username,
      i.platform,
      i.country,
      i.tier,
      a.line_count,
      round(a.total_cost_usd::numeric, 2) AS total_cost_usd,
      round(coalesce(a.median_cost_raw, 0)::numeric, 2) AS median_cost_usd,
      round(a.median_margin_raw::numeric, 2) AS median_margin_pct,
      coalesce(i.match_confidence, 0) AS match_confidence
    FROM (
      SELECT
        c.int_influencer_id,
        count(*)::bigint AS line_count,
        coalesce(sum(c.cost_usd) FILTER (WHERE c.cost_usd > 0), 0) AS total_cost_usd,
        percentile_disc(0.5) WITHIN GROUP (ORDER BY c.cost_usd)
          FILTER (WHERE c.cost_usd > 0) AS median_cost_raw,
        percentile_disc(0.5) WITHIN GROUP (ORDER BY c.margin_pct)
          FILTER (WHERE c.margin_pct IS NOT NULL) AS median_margin_raw
      FROM intelligence.int_campaigns c
      WHERE c.int_influencer_id IS NOT NULL
      GROUP BY c.int_influencer_id
      ORDER BY count(*) DESC
      LIMIT greatest(coalesce(row_limit, 25), 1)
    ) a
    JOIN intelligence.int_influencers i ON i.id = a.int_influencer_id
  ) ranked
  WHERE intelligence.can_read_intelligence();
$$;

REVOKE ALL ON FUNCTION intelligence.get_top_influencers(int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION intelligence.get_top_influencers(int) TO authenticated;
GRANT EXECUTE ON FUNCTION intelligence.get_top_influencers(int) TO service_role;
