-- Resolve FX via USD triangulation when a direct/inverse pair is missing.
-- Seeded rates historically had USD→EGP and USD→AED but not AED→EGP, so
-- resolve_effective_exchange_rate fell back to 1 (identity) for AED lines.

CREATE OR REPLACE FUNCTION public.resolve_effective_exchange_rate(
  p_from_currency char(3),
  p_to_currency char(3),
  p_as_of date DEFAULT CURRENT_DATE
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_rate numeric;
  v_from_to_usd numeric;
  v_usd_to_to numeric;
BEGIN
  IF p_from_currency = p_to_currency THEN
    RETURN 1;
  END IF;

  -- Direct pair
  SELECT r.exchange_rate
  INTO v_rate
  FROM public.md_exchange_rates r
  WHERE r.from_currency = p_from_currency
    AND r.to_currency = p_to_currency
    AND r.is_active = true
    AND r.effective_start_date <= p_as_of
    AND (r.effective_end_date IS NULL OR r.effective_end_date >= p_as_of)
  ORDER BY r.effective_start_date DESC
  LIMIT 1;

  IF v_rate IS NOT NULL THEN
    RETURN v_rate;
  END IF;

  -- Inverse pair
  SELECT ROUND(1 / r.exchange_rate, 8)
  INTO v_rate
  FROM public.md_exchange_rates r
  WHERE r.from_currency = p_to_currency
    AND r.to_currency = p_from_currency
    AND r.is_active = true
    AND r.effective_start_date <= p_as_of
    AND (r.effective_end_date IS NULL OR r.effective_end_date >= p_as_of)
  ORDER BY r.effective_start_date DESC
  LIMIT 1;

  IF v_rate IS NOT NULL THEN
    RETURN v_rate;
  END IF;

  -- Triangulate via USD when neither direct nor inverse exists.
  IF p_from_currency = 'USD' THEN
    v_from_to_usd := 1;
  ELSE
    SELECT r.exchange_rate
    INTO v_from_to_usd
    FROM public.md_exchange_rates r
    WHERE r.from_currency = p_from_currency
      AND r.to_currency = 'USD'
      AND r.is_active = true
      AND r.effective_start_date <= p_as_of
      AND (r.effective_end_date IS NULL OR r.effective_end_date >= p_as_of)
    ORDER BY r.effective_start_date DESC
    LIMIT 1;

    IF v_from_to_usd IS NULL THEN
      SELECT ROUND(1 / r.exchange_rate, 8)
      INTO v_from_to_usd
      FROM public.md_exchange_rates r
      WHERE r.from_currency = 'USD'
        AND r.to_currency = p_from_currency
        AND r.is_active = true
        AND r.effective_start_date <= p_as_of
        AND (r.effective_end_date IS NULL OR r.effective_end_date >= p_as_of)
      ORDER BY r.effective_start_date DESC
      LIMIT 1;
    END IF;
  END IF;

  IF p_to_currency = 'USD' THEN
    v_usd_to_to := 1;
  ELSE
    SELECT r.exchange_rate
    INTO v_usd_to_to
    FROM public.md_exchange_rates r
    WHERE r.from_currency = 'USD'
      AND r.to_currency = p_to_currency
      AND r.is_active = true
      AND r.effective_start_date <= p_as_of
      AND (r.effective_end_date IS NULL OR r.effective_end_date >= p_as_of)
    ORDER BY r.effective_start_date DESC
    LIMIT 1;

    IF v_usd_to_to IS NULL THEN
      SELECT ROUND(1 / r.exchange_rate, 8)
      INTO v_usd_to_to
      FROM public.md_exchange_rates r
      WHERE r.from_currency = p_to_currency
        AND r.to_currency = 'USD'
        AND r.is_active = true
        AND r.effective_start_date <= p_as_of
        AND (r.effective_end_date IS NULL OR r.effective_end_date >= p_as_of)
      ORDER BY r.effective_start_date DESC
      LIMIT 1;
    END IF;
  END IF;

  IF v_from_to_usd IS NOT NULL AND v_usd_to_to IS NOT NULL AND v_from_to_usd > 0 AND v_usd_to_to > 0 THEN
    RETURN ROUND(v_from_to_usd * v_usd_to_to, 8);
  END IF;

  RETURN 1;
END;
$$;

COMMENT ON FUNCTION public.resolve_effective_exchange_rate(char, char, date) IS
  'Effective FX rate as-of date: direct pair, inverse pair, then USD triangulation; identity (1) when unresolved.';

-- Materialize AED/SAR/EUR/GBP → EGP from seeded USD legs.
INSERT INTO public.md_exchange_rates (
  from_currency, to_currency, exchange_rate, effective_start_date, source, notes
)
SELECT v.from_currency, v.to_currency, v.exchange_rate, v.effective_start_date, v.source, v.notes
FROM (
  VALUES
    ('AED'::char(3), 'EGP'::char(3), ROUND(50.00000000 / 3.67250000, 8), '2026-01-01'::date, 'seed', 'Derived AED→EGP from USD→EGP / USD→AED'),
    ('AED'::char(3), 'EGP'::char(3), ROUND(52.00000000 / 3.67250000, 8), '2026-03-01'::date, 'seed', 'Derived AED→EGP from USD→EGP / USD→AED'),
    ('SAR'::char(3), 'EGP'::char(3), ROUND(50.00000000 / 3.75000000, 8), '2026-01-01'::date, 'seed', 'Derived SAR→EGP from USD→EGP / USD→SAR'),
    ('SAR'::char(3), 'EGP'::char(3), ROUND(52.00000000 / 3.75000000, 8), '2026-03-01'::date, 'seed', 'Derived SAR→EGP from USD→EGP / USD→SAR'),
    ('EUR'::char(3), 'EGP'::char(3), ROUND(50.00000000 / 0.92000000, 8), '2026-01-01'::date, 'seed', 'Derived EUR→EGP from USD→EGP / USD→EUR'),
    ('EUR'::char(3), 'EGP'::char(3), ROUND(52.00000000 / 0.92000000, 8), '2026-03-01'::date, 'seed', 'Derived EUR→EGP from USD→EGP / USD→EUR'),
    ('GBP'::char(3), 'EGP'::char(3), ROUND(50.00000000 / 0.79000000, 8), '2026-01-01'::date, 'seed', 'Derived GBP→EGP from USD→EGP / USD→GBP'),
    ('GBP'::char(3), 'EGP'::char(3), ROUND(52.00000000 / 0.79000000, 8), '2026-03-01'::date, 'seed', 'Derived GBP→EGP from USD→EGP / USD→GBP')
) AS v(from_currency, to_currency, exchange_rate, effective_start_date, source, notes)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.md_exchange_rates r
  WHERE r.from_currency = v.from_currency
    AND r.to_currency = v.to_currency
    AND r.effective_start_date = v.effective_start_date
);
