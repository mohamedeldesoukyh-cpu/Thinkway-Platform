-- PO consumption uses client billable base (Revenue + UR Rev + AF), VAT excluded.

CREATE OR REPLACE FUNCTION public.resolve_line_po_billable_base(
  p_revenue_before_vat numeric,
  p_revenue numeric,
  p_usage_rights_amount numeric,
  p_agency_fee_amount numeric,
  p_agency_fee_percent numeric
)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ROUND(
    GREATEST(COALESCE(NULLIF(p_revenue_before_vat, 0), p_revenue, 0), 0)
    + GREATEST(COALESCE(p_usage_rights_amount, 0), 0)
    + GREATEST(
        CASE
          WHEN COALESCE(p_agency_fee_amount, 0) > 0 THEN p_agency_fee_amount
          ELSE ROUND(
            (
              GREATEST(COALESCE(NULLIF(p_revenue_before_vat, 0), p_revenue, 0), 0)
              + GREATEST(COALESCE(p_usage_rights_amount, 0), 0)
            ) * COALESCE(p_agency_fee_percent, 0) / 100,
            2
          )
        END,
        0
      ),
    2
  );
$$;

COMMENT ON FUNCTION public.resolve_line_po_billable_base IS
  'Client PO billable base per line: revenue_before_vat + usage_rights_amount + agency_fee_amount (or computed AF%).';

-- Line PO consumed tracks billable base (not vendor cost).
CREATE OR REPLACE FUNCTION public.sync_campaign_line_po_consumed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.po_consumed := public.resolve_line_po_billable_base(
    NEW.revenue_before_vat,
    NEW.revenue,
    NEW.usage_rights_amount,
    NEW.agency_fee_amount,
    NEW.agency_fee_percent
  );
  RETURN NEW;
END;
$$;

-- Remaining PO on lines uses billable consumption.
CREATE OR REPLACE FUNCTION public.compute_campaign_line_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_billable_base numeric;
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

  v_billable_base := public.resolve_line_po_billable_base(
    NEW.revenue_before_vat,
    NEW.revenue,
    NEW.usage_rights_amount,
    NEW.agency_fee_amount,
    NEW.agency_fee_percent
  );

  NEW.remaining_po := ROUND(COALESCE(NEW.po_amount, 0) - v_billable_base, 2);
  NEW.revenue_base := ROUND(NEW.revenue / NEW.fx_rate, 2);
  NEW.cost_base := ROUND(NEW.cost / NEW.fx_rate, 2);
  NEW.profit_base := ROUND(NEW.revenue_base - NEW.cost_base, 2);

  RETURN NEW;
END;
$$;

-- Header PO consumption sums line billable bases.
CREATE OR REPLACE FUNCTION public.sync_campaign_header_po_consumption(p_header_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_consumed numeric;
  v_po_amount numeric;
  v_remaining numeric;
  v_remaining_pct numeric;
  v_expiry date;
  v_status public.po_status;
  v_current_status public.po_status;
BEGIN
  SELECT COALESCE(
    SUM(
      public.resolve_line_po_billable_base(
        revenue_before_vat,
        revenue,
        usage_rights_amount,
        agency_fee_amount,
        agency_fee_percent
      )
    ),
    0
  )
  INTO v_consumed
  FROM public.campaign_lines
  WHERE campaign_header_id = p_header_id;

  SELECT
    po_amount_campaign_currency,
    po_expiry_date,
    po_status
  INTO v_po_amount, v_expiry, v_current_status
  FROM public.campaign_headers
  WHERE id = p_header_id;

  v_remaining := ROUND(COALESCE(v_po_amount, 0) - COALESCE(v_consumed, 0), 2);

  IF COALESCE(v_po_amount, 0) > 0 THEN
    v_remaining_pct := ROUND((v_remaining / v_po_amount) * 100, 4);
  ELSE
    v_remaining_pct := NULL;
  END IF;

  v_status := public.compute_po_status(
    v_po_amount,
    v_consumed,
    v_remaining_pct,
    v_expiry,
    v_current_status
  );

  UPDATE public.campaign_headers
  SET
    po_consumed_amount = ROUND(v_consumed, 2),
    po_remaining_amount = v_remaining,
    po_remaining_percent = v_remaining_pct,
    po_status = v_status
  WHERE id = p_header_id;
END;
$$;

DROP TRIGGER IF EXISTS sync_header_po_on_line_change ON public.campaign_lines;
CREATE TRIGGER sync_header_po_on_line_change
  AFTER INSERT OR UPDATE OF
    revenue_before_vat,
    revenue,
    usage_rights_amount,
    agency_fee_amount,
    agency_fee_percent,
    campaign_header_id
  OR DELETE
  ON public.campaign_lines
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_sync_campaign_header_po_consumption();

-- Backfill line and header PO consumption from billable base.
UPDATE public.campaign_lines cl
SET
  po_consumed = public.resolve_line_po_billable_base(
    cl.revenue_before_vat,
    cl.revenue,
    cl.usage_rights_amount,
    cl.agency_fee_amount,
    cl.agency_fee_percent
  ),
  remaining_po = ROUND(
    COALESCE(cl.po_amount, 0)
    - public.resolve_line_po_billable_base(
      cl.revenue_before_vat,
      cl.revenue,
      cl.usage_rights_amount,
      cl.agency_fee_amount,
      cl.agency_fee_percent
    ),
    2
  );

DO $$
DECLARE
  v_header_id uuid;
BEGIN
  FOR v_header_id IN SELECT id FROM public.campaign_headers
  LOOP
    PERFORM public.sync_campaign_header_po_consumption(v_header_id);
  END LOOP;
END;
$$;
