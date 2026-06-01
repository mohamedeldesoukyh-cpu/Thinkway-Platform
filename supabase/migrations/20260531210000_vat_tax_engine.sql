-- VAT / Tax engine — operational KPIs exclude VAT; tax values tracked separately.
-- Apply after prior enterprise / billing migrations.

-- -----------------------------------------------------------------------------
-- Master VAT rates (date-effective)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.md_vat_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code char(2) NOT NULL REFERENCES public.md_countries (code) ON DELETE RESTRICT,
  vat_name text NOT NULL DEFAULT 'VAT',
  vat_rate numeric(6, 3) NOT NULL CHECK (vat_rate >= 0 AND vat_rate <= 100),
  is_default boolean NOT NULL DEFAULT false,
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT md_vat_rates_date_range CHECK (
    effective_to IS NULL OR effective_from <= effective_to
  )
);

CREATE INDEX IF NOT EXISTS md_vat_rates_country_code_idx
  ON public.md_vat_rates (country_code);

CREATE INDEX IF NOT EXISTS md_vat_rates_effective_idx
  ON public.md_vat_rates (country_code, effective_from DESC);

CREATE UNIQUE INDEX IF NOT EXISTS md_vat_rates_one_default_per_country
  ON public.md_vat_rates (country_code)
  WHERE is_default = true AND effective_to IS NULL;

INSERT INTO public.md_vat_rates (country_code, vat_name, vat_rate, is_default, effective_from)
SELECT v.country_code, v.vat_name, v.vat_rate, v.is_default, v.effective_from
FROM (VALUES
  ('EG'::char(2), 'VAT'::text, 14.000::numeric, true, '2020-01-01'::date),
  ('AE'::char(2), 'VAT'::text, 5.000::numeric, true, '2018-01-01'::date),
  ('SA'::char(2), 'VAT'::text, 15.000::numeric, true, '2020-07-01'::date)
) AS v(country_code, vat_name, vat_rate, is_default, effective_from)
WHERE NOT EXISTS (
  SELECT 1 FROM public.md_vat_rates r
  WHERE r.country_code = v.country_code AND r.is_default = true
);

-- -----------------------------------------------------------------------------
-- Vendor VAT registration
-- -----------------------------------------------------------------------------
ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS vat_registered boolean NOT NULL DEFAULT false;

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS default_vat_percent numeric(6, 3) NOT NULL DEFAULT 0;

ALTER TABLE public.influencers
  ADD COLUMN IF NOT EXISTS tax_registration_number text;

-- -----------------------------------------------------------------------------
-- Campaign line VAT (revenue = client / cost = vendor)
-- Operational revenue & cost columns remain ex-VAT.
-- -----------------------------------------------------------------------------
ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS revenue_before_vat numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS revenue_vat_percent numeric(6, 3) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS revenue_vat_amount numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS revenue_after_vat numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS revenue_vat_exempt boolean NOT NULL DEFAULT false;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS cost_before_vat numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS cost_vat_percent numeric(6, 3) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS cost_vat_amount numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS cost_after_vat numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS cost_vat_exempt boolean NOT NULL DEFAULT false;

ALTER TABLE public.campaign_lines
  ADD COLUMN IF NOT EXISTS vat_locked boolean NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- Campaign influencer (vendor) cost VAT mirror
-- -----------------------------------------------------------------------------
ALTER TABLE public.campaign_influencers
  ADD COLUMN IF NOT EXISTS cost_before_vat numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_influencers
  ADD COLUMN IF NOT EXISTS cost_vat_percent numeric(6, 3) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_influencers
  ADD COLUMN IF NOT EXISTS cost_vat_amount numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.campaign_influencers
  ADD COLUMN IF NOT EXISTS cost_after_vat numeric(14, 2) NOT NULL DEFAULT 0;

-- -----------------------------------------------------------------------------
-- Invoice line items — output VAT per line
-- unit_price remains ex-VAT; line_total is after VAT.
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS revenue_before_vat numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS revenue_vat_percent numeric(6, 3) NOT NULL DEFAULT 0;

ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS revenue_vat_amount numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.invoice_line_items
  ADD COLUMN IF NOT EXISTS revenue_vat_exempt boolean NOT NULL DEFAULT false;

-- -----------------------------------------------------------------------------
-- Invoice header VAT summary
-- subtotal = ex-VAT; tax_amount = output VAT; total = after VAT
-- -----------------------------------------------------------------------------
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS revenue_before_vat numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS revenue_vat_amount numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS revenue_after_vat numeric(14, 2) NOT NULL DEFAULT 0;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS revenue_vat_exempt boolean NOT NULL DEFAULT false;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS billing_country_code char(2);

-- Backfill campaign lines: existing revenue/cost are ex-VAT, VAT defaults to 0
UPDATE public.campaign_lines
SET
  revenue_before_vat = COALESCE(revenue, 0),
  revenue_vat_percent = 0,
  revenue_vat_amount = 0,
  revenue_after_vat = COALESCE(revenue, 0),
  cost_before_vat = COALESCE(cost, 0),
  cost_vat_percent = 0,
  cost_vat_amount = 0,
  cost_after_vat = COALESCE(cost, 0)
WHERE revenue_before_vat = 0 AND cost_before_vat = 0
  AND (COALESCE(revenue, 0) > 0 OR COALESCE(cost, 0) > 0);

UPDATE public.campaign_lines
SET
  revenue_before_vat = COALESCE(revenue, 0),
  cost_before_vat = COALESCE(cost, 0),
  revenue_after_vat = COALESCE(revenue, 0),
  cost_after_vat = COALESCE(cost, 0)
WHERE revenue_before_vat = 0 AND cost_before_vat = 0;

UPDATE public.campaign_influencers
SET
  cost_before_vat = COALESCE(agreed_fee, 0),
  cost_vat_percent = 0,
  cost_vat_amount = 0,
  cost_after_vat = COALESCE(agreed_fee, 0);

UPDATE public.invoice_line_items ili
SET
  revenue_before_vat = ROUND(COALESCE(ili.quantity, 1) * COALESCE(ili.unit_price, 0), 2),
  revenue_vat_percent = 0,
  revenue_vat_amount = 0
WHERE revenue_before_vat = 0;

UPDATE public.invoices
SET
  revenue_before_vat = COALESCE(subtotal, 0),
  revenue_vat_amount = COALESCE(tax_amount, 0),
  revenue_after_vat = COALESCE(total, 0);

-- Resolve default VAT rate for a country on a given date
CREATE OR REPLACE FUNCTION public.resolve_vat_rate(
  p_country_code char(2),
  p_as_of date DEFAULT CURRENT_DATE
)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    (
      SELECT vr.vat_rate
      FROM public.md_vat_rates vr
      WHERE vr.country_code = p_country_code
        AND vr.effective_from <= p_as_of
        AND (vr.effective_to IS NULL OR vr.effective_to >= p_as_of)
      ORDER BY vr.is_default DESC, vr.effective_from DESC
      LIMIT 1
    ),
    0
  );
$$;

-- Campaign line financials: GP/margin always ex-VAT
CREATE OR REPLACE FUNCTION public.compute_campaign_line_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.fx_rate IS NULL OR NEW.fx_rate <= 0 THEN
    NEW.fx_rate := 1;
  END IF;

  NEW.revenue_before_vat := ROUND(COALESCE(NEW.revenue_before_vat, NEW.revenue, 0), 2);
  NEW.cost_before_vat := ROUND(COALESCE(NEW.cost_before_vat, NEW.cost, 0), 2);

  IF COALESCE(NEW.revenue_vat_exempt, false) OR NEW.vat_locked THEN
    IF NOT NEW.vat_locked THEN
      NEW.revenue_vat_percent := 0;
    END IF;
    NEW.revenue_vat_amount := 0;
  ELSE
    NEW.revenue_vat_amount := ROUND(
      NEW.revenue_before_vat * COALESCE(NEW.revenue_vat_percent, 0) / 100,
      2
    );
  END IF;

  NEW.revenue_after_vat := ROUND(NEW.revenue_before_vat + NEW.revenue_vat_amount, 2);

  IF COALESCE(NEW.cost_vat_exempt, false) OR NEW.vat_locked THEN
    IF NOT NEW.vat_locked THEN
      NEW.cost_vat_percent := 0;
    END IF;
    NEW.cost_vat_amount := 0;
  ELSE
    NEW.cost_vat_amount := ROUND(
      NEW.cost_before_vat * COALESCE(NEW.cost_vat_percent, 0) / 100,
      2
    );
  END IF;

  NEW.cost_after_vat := ROUND(NEW.cost_before_vat + NEW.cost_vat_amount, 2);

  -- Operational columns (ex-VAT only)
  NEW.revenue := NEW.revenue_before_vat;
  NEW.cost := NEW.cost_before_vat;
  NEW.profit := ROUND(NEW.revenue - NEW.cost, 2);

  IF COALESCE(NEW.revenue, 0) > 0 THEN
    NEW.profit_margin := ROUND((NEW.profit / NEW.revenue) * 100, 4);
  ELSE
    NEW.profit_margin := 0;
  END IF;

  IF COALESCE(NEW.cost, 0) > 0 THEN
    NEW.markup_margin := ROUND((NEW.profit / NEW.cost) * 100, 4);
  ELSE
    NEW.markup_margin := 0;
  END IF;

  NEW.remaining_po := ROUND(COALESCE(NEW.po_amount, 0) - NEW.cost, 2);
  NEW.revenue_base := ROUND(NEW.revenue / NEW.fx_rate, 2);
  NEW.cost_base := ROUND(NEW.cost / NEW.fx_rate, 2);
  NEW.profit_base := ROUND(NEW.revenue_base - NEW.cost_base, 2);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS compute_campaign_lines_financials ON public.campaign_lines;
CREATE TRIGGER compute_campaign_lines_financials
  BEFORE INSERT OR UPDATE ON public.campaign_lines
  FOR EACH ROW EXECUTE FUNCTION public.compute_campaign_line_financials();

-- PO consumed tracks ex-VAT cost
CREATE OR REPLACE FUNCTION public.sync_campaign_line_po_consumed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.po_consumed := COALESCE(NEW.cost_before_vat, NEW.cost, 0);
  RETURN NEW;
END;
$$;

-- Sync vendor assignment cost VAT from line
CREATE OR REPLACE FUNCTION public.sync_campaign_influencer_cost_vat()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.campaign_line_id IS NOT NULL THEN
    SELECT
      cl.cost_before_vat,
      cl.cost_vat_percent,
      cl.cost_vat_amount,
      cl.cost_after_vat
    INTO
      NEW.cost_before_vat,
      NEW.cost_vat_percent,
      NEW.cost_vat_amount,
      NEW.cost_after_vat
    FROM public.campaign_lines cl
    WHERE cl.id = NEW.campaign_line_id;
  END IF;

  NEW.agreed_fee := COALESCE(NEW.cost_before_vat, NEW.agreed_fee, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_campaign_influencer_cost_vat ON public.campaign_influencers;
CREATE TRIGGER sync_campaign_influencer_cost_vat
  BEFORE INSERT OR UPDATE OF campaign_line_id, agreed_fee ON public.campaign_influencers
  FOR EACH ROW EXECUTE FUNCTION public.sync_campaign_influencer_cost_vat();

-- Invoice line totals: unit_price is ex-VAT
CREATE OR REPLACE FUNCTION public.refresh_invoice_line_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.revenue_before_vat := ROUND(
    COALESCE(NEW.quantity, 1) * COALESCE(NEW.unit_price, 0),
    2
  );

  IF COALESCE(NEW.revenue_vat_exempt, false) THEN
    NEW.revenue_vat_percent := 0;
    NEW.revenue_vat_amount := 0;
  ELSE
    NEW.revenue_vat_amount := ROUND(
      NEW.revenue_before_vat * COALESCE(NEW.revenue_vat_percent, 0) / 100,
      2
    );
  END IF;

  NEW.line_total := ROUND(NEW.revenue_before_vat + NEW.revenue_vat_amount, 2);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_invoice_line_total ON public.invoice_line_items;
CREATE TRIGGER refresh_invoice_line_total
  BEFORE INSERT OR UPDATE ON public.invoice_line_items
  FOR EACH ROW EXECUTE FUNCTION public.refresh_invoice_line_total();

CREATE OR REPLACE FUNCTION public.recalculate_invoice_totals(p_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subtotal numeric(14, 2);
  v_tax numeric(14, 2);
  v_total numeric(14, 2);
  v_exempt boolean;
BEGIN
  SELECT
    COALESCE(SUM(revenue_before_vat), 0),
    COALESCE(SUM(revenue_vat_amount), 0),
    BOOL_AND(COALESCE(revenue_vat_exempt, false))
  INTO v_subtotal, v_tax, v_exempt
  FROM public.invoice_line_items
  WHERE invoice_id = p_invoice_id;

  v_total := v_subtotal + v_tax;

  UPDATE public.invoices
  SET
    subtotal = v_subtotal,
    tax_amount = v_tax,
    total = v_total,
    revenue_before_vat = v_subtotal,
    revenue_vat_amount = v_tax,
    revenue_after_vat = v_total,
    revenue_vat_exempt = COALESCE(v_exempt, false),
    updated_at = timezone('utc', now())
  WHERE id = p_invoice_id;
END;
$$;

-- Lock VAT fields when line is invoiced
CREATE OR REPLACE FUNCTION public.enforce_campaign_line_billing_lock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_override_active boolean;
BEGIN
  v_override_active := NEW.finance_override_until IS NOT NULL
    AND NEW.finance_override_until > timezone('utc', now());

  IF OLD.revenue_locked AND NEW.revenue IS DISTINCT FROM OLD.revenue AND NOT v_override_active THEN
    RAISE EXCEPTION 'Revenue is locked on invoiced line %. Finance override required.', OLD.document_number
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.cost_locked AND NEW.cost IS DISTINCT FROM OLD.cost AND NOT v_override_active THEN
    RAISE EXCEPTION 'Cost is locked on line %. Finance override required.', OLD.document_number
      USING ERRCODE = 'check_violation';
  END IF;

  IF OLD.vat_locked AND NOT v_override_active THEN
    IF NEW.revenue_vat_percent IS DISTINCT FROM OLD.revenue_vat_percent
      OR NEW.revenue_vat_exempt IS DISTINCT FROM OLD.revenue_vat_exempt
      OR NEW.revenue_before_vat IS DISTINCT FROM OLD.revenue_before_vat
      OR NEW.cost_vat_percent IS DISTINCT FROM OLD.cost_vat_percent
      OR NEW.cost_vat_exempt IS DISTINCT FROM OLD.cost_vat_exempt
      OR NEW.cost_before_vat IS DISTINCT FROM OLD.cost_before_vat THEN
      RAISE EXCEPTION 'VAT is locked on invoiced line %. Finance override required.', OLD.document_number
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF NEW.invoice_id IS NOT NULL AND OLD.invoice_id IS NULL THEN
    NEW.vat_locked := true;
  END IF;

  IF NEW.invoice_id IS NULL AND OLD.invoice_id IS NOT NULL AND NOT v_override_active THEN
    NEW.vat_locked := false;
  END IF;

  RETURN NEW;
END;
$$;

DROP VIEW IF EXISTS public.invoice_lines;
CREATE VIEW public.invoice_lines AS
SELECT
  ili.id,
  ili.invoice_id,
  ili.campaign_line_id,
  ili.campaign_header_id,
  ili.campaign_id,
  ili.sort_order,
  ili.description,
  ili.quantity,
  ili.unit_price,
  ili.line_total,
  ili.revenue_before_vat,
  ili.revenue_vat_percent,
  ili.revenue_vat_amount,
  ili.revenue_vat_exempt,
  ili.deliverable_id,
  ili.metadata,
  ili.created_at,
  ili.updated_at
FROM public.invoice_line_items ili;

ALTER TABLE public.md_vat_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS md_vat_rates_select ON public.md_vat_rates;
CREATE POLICY md_vat_rates_select ON public.md_vat_rates
  FOR SELECT TO authenticated USING (true);
