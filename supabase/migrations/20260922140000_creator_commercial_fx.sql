-- Independent negotiated cost/revenue pairs, kept separate from system FX and
-- the assignment's cost-received -> local-currency conversion.
ALTER TABLE public.quotation_items ADD COLUMN IF NOT EXISTS cost_fx_override text;
ALTER TABLE public.quotation_items ADD COLUMN IF NOT EXISTS revenue_fx_override text;
ALTER TABLE public.campaign_lines ADD COLUMN IF NOT EXISTS cost_fx_override text;
ALTER TABLE public.campaign_lines ADD COLUMN IF NOT EXISTS revenue_fx_override text;

CREATE OR REPLACE FUNCTION public.valid_creator_fx(p_value text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF p_value IS NULL THEN RETURN true; END IF;
  v := p_value::jsonb;
  RETURN coalesce(jsonb_typeof(v)='object'
    AND (v->>'from') ~ '^[A-Z]{3}$' AND (v->>'to') ~ '^[A-Z]{3}$'
    AND v->>'from' <> v->>'to'
    AND jsonb_typeof(v->'rate')='number' AND (v->>'rate')::numeric > 0 AND (v->>'rate')::numeric <= 1000000000
    AND jsonb_typeof(v->'targetRateToEgp')='number' AND (v->>'targetRateToEgp')::numeric > 0
    AND (v->>'targetRateToEgp')::numeric <= 1000000000
    AND (v->>'to'<>'EGP' OR (v->>'targetRateToEgp')::numeric=1),false);
EXCEPTION WHEN OTHERS THEN RETURN false;
END $$;

ALTER TABLE public.quotation_items ADD CONSTRAINT quotation_creator_fx_valid
  CHECK (public.valid_creator_fx(cost_fx_override) AND public.valid_creator_fx(revenue_fx_override));
ALTER TABLE public.campaign_lines ADD CONSTRAINT campaign_creator_fx_valid
  CHECK (public.valid_creator_fx(cost_fx_override) AND public.valid_creator_fx(revenue_fx_override));

CREATE OR REPLACE FUNCTION public.creator_fx_rate(p_override text, p_from text, p_to text,
  p_source_rate numeric, p_target_rate numeric) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF p_from=p_to THEN RETURN 1; END IF;
  IF p_override IS NOT NULL AND public.valid_creator_fx(p_override) THEN
    v:=p_override::jsonb;
    IF v->>'from'=p_from THEN
      IF v->>'to'=p_to THEN RETURN (v->>'rate')::numeric; END IF;
      RETURN (v->>'rate')::numeric * (v->>'targetRateToEgp')::numeric /
        CASE WHEN p_to='EGP' THEN 1 ELSE p_target_rate END;
    END IF;
  END IF;
  RETURN (CASE WHEN p_from='EGP' THEN 1 ELSE p_source_rate END) /
    (CASE WHEN p_to='EGP' THEN 1 ELSE p_target_rate END);
END $$;

CREATE OR REPLACE FUNCTION public.apply_quotation_creator_fx() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE cost_rate numeric; revenue_rate numeric;
BEGIN
  IF NEW.cost_fx_override IS NOT NULL AND NEW.cost_fx_override::jsonb->>'from' <> NEW.cost_currency THEN
    NEW.cost_fx_override:=NULL;
  END IF;
  IF NEW.revenue_fx_override IS NOT NULL AND NEW.revenue_fx_override::jsonb->>'from' <> NEW.cost_currency THEN
    NEW.revenue_fx_override:=NULL;
  END IF;
  cost_rate:=public.creator_fx_rate(NEW.cost_fx_override,NEW.cost_currency,'EGP',NEW.fx_rate_to_egp,1);
  revenue_rate:=public.creator_fx_rate(NEW.revenue_fx_override,NEW.cost_currency,'EGP',NEW.fx_rate_to_egp,1);
  NEW.cost_egp:=round(NEW.cost*cost_rate,2);
  NEW.revenue_egp:=round(NEW.revenue*revenue_rate,2);
  NEW.gp_value_egp:=NEW.revenue_egp-NEW.cost_egp;
  NEW.af_value_egp:=round(NEW.af_value*revenue_rate,2);
  RETURN NEW;
END $$;
CREATE TRIGGER quotation_creator_fx BEFORE INSERT OR UPDATE ON public.quotation_items
  FOR EACH ROW EXECUTE FUNCTION public.apply_quotation_creator_fx();

CREATE OR REPLACE FUNCTION public.seed_campaign_creator_fx() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.source_quotation_item_id IS NOT NULL THEN
    SELECT q.cost_fx_override,q.revenue_fx_override INTO NEW.cost_fx_override,NEW.revenue_fx_override
    FROM public.quotation_items q WHERE q.id=NEW.source_quotation_item_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER campaign_creator_fx_seed BEFORE INSERT ON public.campaign_lines
  FOR EACH ROW EXECUTE FUNCTION public.seed_campaign_creator_fx();

COMMENT ON COLUMN public.quotation_items.cost_fx_override IS 'Negotiated cost pair {from,to,rate,targetRateToEgp}; null uses system rate. Commercial revision applies after finance lock.';
COMMENT ON COLUMN public.quotation_items.revenue_fx_override IS 'Negotiated revenue pair; independent of cost. Never overwritten by exchange-rate-file refresh.';

-- New invoice allocations use the negotiated revenue rate.
CREATE OR REPLACE FUNCTION public.convert_operational_invoice_line()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_override text; v_source text; v_target text; v_rate numeric; v_amount numeric; v_prior jsonb; v_segments jsonb; v_delta numeric;
BEGIN
  IF NOT (coalesce(NEW.metadata,'{}'::jsonb) ? 'operational_source_amount') THEN RETURN NEW; END IF;
  SELECT currency_code,revenue_fx_override INTO STRICT v_source,v_override FROM public.campaign_lines WHERE id=NEW.campaign_line_id;
  SELECT currency INTO STRICT v_target FROM public.invoices WHERE id=NEW.invoice_id;
  v_amount := (NEW.metadata->>'operational_source_amount')::numeric;
  IF v_amount IS NULL OR v_amount < 0 THEN RAISE EXCEPTION 'Invalid source invoice amount'; END IF;
  IF TG_OP='UPDATE' THEN v_prior := OLD.metadata->'billing_fx'; END IF;
  v_rate := public.creator_fx_rate(v_override,v_source,v_target,public.resolve_effective_exchange_rate(v_source,'EGP',current_date),public.resolve_effective_exchange_rate(v_target,'EGP',current_date));
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
