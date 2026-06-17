-- Intelligence workspace aggregates — fast KPI counts and financial totals under RLS.

CREATE OR REPLACE FUNCTION intelligence.get_workspace_counts()
RETURNS TABLE (
  campaigns bigint,
  influencers bigint,
  benchmarks bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = intelligence, public
AS $$
  SELECT c.campaigns, c.influencers, c.benchmarks
  FROM (
    SELECT
      (SELECT count(*)::bigint FROM intelligence.int_campaigns) AS campaigns,
      (SELECT count(*)::bigint FROM intelligence.int_influencers) AS influencers,
      (SELECT count(*)::bigint FROM intelligence.int_benchmarks) AS benchmarks
  ) c
  WHERE intelligence.can_read_intelligence();
$$;

CREATE OR REPLACE FUNCTION intelligence.get_campaign_financial_totals()
RETURNS TABLE (
  total_revenue_usd numeric,
  total_cost_usd numeric,
  total_gp_usd numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = intelligence, public
AS $$
  SELECT f.total_revenue_usd, f.total_cost_usd, f.total_gp_usd
  FROM (
    SELECT
      coalesce(sum(revenue_usd), 0) AS total_revenue_usd,
      coalesce(sum(cost_usd), 0) AS total_cost_usd,
      coalesce(sum(gp_usd), 0) AS total_gp_usd
    FROM intelligence.int_campaigns
  ) f
  WHERE intelligence.can_read_intelligence();
$$;

REVOKE ALL ON FUNCTION intelligence.get_workspace_counts() FROM PUBLIC;
REVOKE ALL ON FUNCTION intelligence.get_campaign_financial_totals() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION intelligence.get_workspace_counts() TO authenticated;
GRANT EXECUTE ON FUNCTION intelligence.get_campaign_financial_totals() TO authenticated;
GRANT EXECUTE ON FUNCTION intelligence.get_workspace_counts() TO service_role;
GRANT EXECUTE ON FUNCTION intelligence.get_campaign_financial_totals() TO service_role;
