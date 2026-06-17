-- Intelligence margin alerts — indexed join under RLS (replaces Q8 PostgREST join fetch).

CREATE OR REPLACE FUNCTION intelligence.get_low_margin_line_count()
RETURNS TABLE (low_margin_line_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = intelligence, public
AS $$
  SELECT c.low_margin_line_count
  FROM (
    SELECT count(*)::bigint AS low_margin_line_count
    FROM intelligence.int_margin_history
    WHERE below_threshold_15pct = true
  ) c
  WHERE intelligence.can_read_intelligence();
$$;

CREATE OR REPLACE FUNCTION intelligence.get_margin_alerts(row_limit int DEFAULT 40)
RETURNS TABLE (
  id uuid,
  source_line_id text,
  margin_pct numeric,
  revenue_usd numeric,
  cost_usd numeric,
  market_entity text,
  channel text,
  period_year int,
  campaign_name text,
  brand_name_raw text,
  influencer_name_raw text,
  client_type_report text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = intelligence, public
AS $$
  SELECT
    alerts.id,
    alerts.source_line_id,
    alerts.margin_pct,
    alerts.revenue_usd,
    alerts.cost_usd,
    alerts.market_entity,
    alerts.channel,
    alerts.period_year,
    alerts.campaign_name,
    alerts.brand_name_raw,
    alerts.influencer_name_raw,
    alerts.client_type_report
  FROM (
    SELECT
      m.id,
      m.source_line_id,
      m.margin_pct,
      m.revenue_usd,
      m.cost_usd,
      m.market_entity,
      m.channel,
      m.period_year,
      c.campaign_name,
      c.brand_name_raw,
      c.influencer_name_raw,
      c.client_type_report
    FROM intelligence.int_margin_history m
    JOIN intelligence.int_campaigns c ON c.id = m.int_campaign_id
    WHERE m.below_threshold_15pct = true
    ORDER BY m.margin_pct ASC
    LIMIT greatest(coalesce(row_limit, 40), 1)
  ) alerts
  WHERE intelligence.can_read_intelligence();
$$;

REVOKE ALL ON FUNCTION intelligence.get_low_margin_line_count() FROM PUBLIC;
REVOKE ALL ON FUNCTION intelligence.get_margin_alerts(int) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION intelligence.get_low_margin_line_count() TO authenticated;
GRANT EXECUTE ON FUNCTION intelligence.get_margin_alerts(int) TO authenticated;
GRANT EXECUTE ON FUNCTION intelligence.get_low_margin_line_count() TO service_role;
GRANT EXECUTE ON FUNCTION intelligence.get_margin_alerts(int) TO service_role;
