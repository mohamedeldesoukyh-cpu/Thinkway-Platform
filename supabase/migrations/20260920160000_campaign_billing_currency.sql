BEGIN;
-- Invoice documents store invoice-currency amounts. Operational coverage stores
-- source assignment amounts separately, so partial billing never changes units.
CREATE OR REPLACE FUNCTION public.convert_operational_invoice_line()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_source text; v_target text; v_rate numeric; v_amount numeric; v_prior jsonb; v_segments jsonb; v_delta numeric;
BEGIN
  IF NOT (coalesce(NEW.metadata,'{}'::jsonb) ? 'operational_source_amount') THEN RETURN NEW; END IF;
  SELECT currency_code INTO STRICT v_source FROM public.campaign_lines WHERE id=NEW.campaign_line_id;
  SELECT currency INTO STRICT v_target FROM public.invoices WHERE id=NEW.invoice_id;
  v_amount := (NEW.metadata->>'operational_source_amount')::numeric;
  IF v_amount IS NULL OR v_amount < 0 THEN RAISE EXCEPTION 'Invalid source invoice amount'; END IF;
  IF TG_OP='UPDATE' THEN v_prior := OLD.metadata->'billing_fx'; END IF;
  v_rate := public.resolve_effective_exchange_rate(v_source,v_target,current_date);
  IF v_rate IS NULL OR v_rate<=0 THEN RAISE EXCEPTION 'Missing FX rate: % to %',v_source,v_target; END IF;
  IF v_prior IS NOT NULL AND NOT coalesce((NEW.metadata->>'operational_fx_refresh')::boolean,false)
    AND v_prior->>'source_currency'=v_source AND v_prior->>'invoice_currency'=v_target THEN
    -- Keep the existing billed slice frozen; convert only the new allocation.
    v_delta := v_amount-(v_prior->>'source_amount')::numeric;
    NEW.revenue_before_vat := OLD.revenue_before_vat+round(v_delta*v_rate,2);
    v_segments := coalesce(v_prior->'segments',jsonb_build_array(jsonb_build_object(
      'source_amount',v_prior->'source_amount','rate',v_prior->'rate')))
      || jsonb_build_array(jsonb_build_object('source_amount',v_delta,'rate',CASE WHEN v_amount>0 THEN NEW.revenue_before_vat/v_amount ELSE v_rate END,'segments',v_segments,'recorded_at',now()));
  ELSE
    NEW.revenue_before_vat := round(v_amount*v_rate,2);
    v_segments := jsonb_build_array(jsonb_build_object('source_amount',v_amount,'rate',v_rate,'recorded_at',now()));
  END IF;
  NEW.unit_price := NEW.revenue_before_vat / coalesce(nullif(NEW.quantity,0),1);
  NEW.metadata := (CASE WHEN TG_OP='UPDATE' THEN coalesce(OLD.metadata,'{}'::jsonb) ELSE '{}'::jsonb END
    || NEW.metadata - 'operational_source_amount' - 'operational_fx_refresh') || jsonb_build_object('billing_fx',
      jsonb_build_object('source_currency',v_source,'source_amount',v_amount,'invoice_currency',v_target,
        'rate',v_rate,'recorded_at',coalesce(v_prior->>'recorded_at',now()::text)));
  RETURN NEW;
END; $$;
-- Runs before refresh_invoice_line_total so existing VAT/total rules see converted money.
DROP TRIGGER IF EXISTS a_convert_operational_invoice_line ON public.invoice_line_items;
CREATE TRIGGER a_convert_operational_invoice_line BEFORE INSERT OR UPDATE ON public.invoice_line_items
FOR EACH ROW EXECUTE FUNCTION public.convert_operational_invoice_line();

CREATE OR REPLACE VIEW public.invoice_line_items_operational WITH (security_invoker=true) AS
SELECT id,invoice_id,sort_order,description,quantity,
  CASE WHEN metadata ? 'billing_fx' THEN (metadata->'billing_fx'->>'source_amount')::numeric / coalesce(nullif(quantity,0),1) ELSE unit_price END AS unit_price,
  line_total,campaign_id,deliverable_id,metadata,created_at,updated_at,campaign_line_id,campaign_header_id,
  coalesce((metadata->'billing_fx'->>'source_amount')::numeric,revenue_before_vat) AS revenue_before_vat,
  revenue_vat_percent,revenue_vat_amount,revenue_vat_exempt,assignment_deliverable_id,assignment_post_schedule_id
FROM public.invoice_line_items;
GRANT SELECT ON public.invoice_line_items_operational TO authenticated,service_role;

-- RLS remains authoritative. Validate the rate, persist the selector and refresh
-- PO guardrail amounts in one transaction; failed conversion changes nothing.
CREATE OR REPLACE FUNCTION public.set_campaign_display_currency(p_campaign_id uuid,p_currency text)
RETURNS numeric LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_rate numeric;
BEGIN
  p_currency := upper(trim(p_currency));
  IF NOT EXISTS (SELECT 1 FROM public.md_currencies WHERE code=p_currency AND is_active) THEN
    RAISE EXCEPTION 'Unsupported currency: %',p_currency;
  END IF;
  v_rate := public.resolve_effective_exchange_rate(p_currency,'EGP',current_date);
  IF v_rate IS NULL OR v_rate<=0 THEN RAISE EXCEPTION 'Missing FX rate: % to EGP',p_currency; END IF;
  UPDATE public.campaign_headers SET currency_code=p_currency WHERE id=p_campaign_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campaign not found or currency change not permitted'; END IF;
  PERFORM public.sync_campaign_header_po_consumption(p_campaign_id);
  RETURN v_rate;
END; $$;
REVOKE ALL ON FUNCTION public.set_campaign_display_currency(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_campaign_display_currency(uuid,text) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
