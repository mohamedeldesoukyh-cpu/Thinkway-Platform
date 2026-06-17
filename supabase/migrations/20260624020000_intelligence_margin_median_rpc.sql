-- Intelligence median margin KPI — percentile aggregate under RLS (replaces Q4 row fetch).

CREATE OR REPLACE FUNCTION intelligence.get_margin_median()
RETURNS TABLE (median_margin_pct numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = intelligence, public
AS $$
  SELECT m.median_margin_pct
  FROM (
    SELECT round(
      percentile_disc(0.5) WITHIN GROUP (ORDER BY margin_pct)::numeric,
      2
    ) AS median_margin_pct
    FROM intelligence.int_margin_history
    WHERE margin_pct IS NOT NULL
  ) m
  WHERE intelligence.can_read_intelligence();
$$;

REVOKE ALL ON FUNCTION intelligence.get_margin_median() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION intelligence.get_margin_median() TO authenticated;
GRANT EXECUTE ON FUNCTION intelligence.get_margin_median() TO service_role;
