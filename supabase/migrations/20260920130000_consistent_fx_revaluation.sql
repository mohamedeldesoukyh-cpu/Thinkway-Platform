-- FX reporting uses effective rates; issued document amounts remain immutable.
-- A rate save, historical replacement, draft revaluation and audit are atomic.
BEGIN;

CREATE OR REPLACE FUNCTION public.can_write_exchange_rates()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_admin() OR (public.is_internal_user() AND public.has_permission('finance.override'));
$$;

CREATE OR REPLACE FUNCTION public.resolve_effective_exchange_rate(
  p_from_currency char(3), p_to_currency char(3), p_as_of date DEFAULT CURRENT_DATE
) RETURNS numeric LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE v_rate numeric;
BEGIN
  IF p_from_currency = p_to_currency THEN RETURN 1; END IF;
  -- Seeded derived pairs are formulas, not independent market quotes. Resolve
  -- their underlying legs instead of letting stale materializations win.
  WITH RECURSIVE latest AS (
    SELECT DISTINCT ON (from_currency, to_currency)
      from_currency::text AS src, to_currency::text AS dst, exchange_rate AS rate,
      effective_start_date, updated_at, id
    FROM public.md_exchange_rates
    WHERE is_active AND effective_start_date <= p_as_of
      AND (effective_end_date IS NULL OR effective_end_date >= p_as_of)
      AND NOT (coalesce(source,'') = 'seed' AND coalesce(notes,'') LIKE 'Derived %')
    ORDER BY from_currency, to_currency, effective_start_date DESC, updated_at DESC, id DESC
  ), candidates AS (
    SELECT src, dst, rate, effective_start_date, updated_at, id, 0 AS inverse FROM latest
    UNION ALL
    SELECT dst, src, 1 / rate, effective_start_date, updated_at, id, 1 FROM latest
  ), edges AS (
    SELECT DISTINCT ON (src, dst) src, dst, rate FROM candidates
    ORDER BY src, dst, effective_start_date DESC, updated_at DESC, inverse, id DESC
  ), paths AS (
    SELECT p_from_currency::text AS node, 1::numeric AS rate,
      ARRAY[p_from_currency::text] AS visited
    UNION ALL
    SELECT e.dst, p.rate * e.rate, p.visited || e.dst
    FROM paths p JOIN edges e ON e.src = p.node
    WHERE NOT e.dst = ANY(p.visited) AND cardinality(p.visited) < 6
  )
  SELECT rate INTO v_rate FROM paths WHERE node = p_to_currency::text
  ORDER BY cardinality(visited), (('USD' = ANY(visited))::int) DESC, visited LIMIT 1;
  IF v_rate IS NULL OR v_rate <= 0 THEN
    RAISE EXCEPTION 'Missing FX rate: % to % on %', p_from_currency, p_to_currency, p_as_of;
  END IF;
  RETURN round(v_rate, 8);
END;
$$;

-- Read-only, RLS-respecting projection shared by campaign and PO reporting.
CREATE OR REPLACE VIEW public.campaign_fx_po_totals WITH (security_invoker = true) AS
SELECT h.id AS campaign_header_id,
  CASE WHEN h.po_amount_original > 0 THEN
    round(h.po_amount_original * public.resolve_effective_exchange_rate(
      coalesce(h.po_currency,h.currency_code),h.currency_code),2)
    WHEN h.po_amount_campaign_currency > 0 THEN h.po_amount_campaign_currency
    ELSE coalesce(l.budget,0) END AS po_amount,
  coalesce(l.consumed,0) AS po_consumed,
  CASE WHEN h.po_amount_original > 0 THEN public.resolve_effective_exchange_rate(
    coalesce(h.po_currency,h.currency_code),h.currency_code) ELSE NULL END AS po_rate
FROM public.campaign_headers h
LEFT JOIN LATERAL (
  SELECT round(sum(round(coalesce(cl.po_amount,0) *
      public.resolve_effective_exchange_rate(coalesce(cl.currency_code,h.currency_code),'EGP'),2)) /
      public.resolve_effective_exchange_rate(h.currency_code,'EGP'),2) AS budget,
    round(sum(round(public.resolve_line_po_billable_base(cl.revenue_before_vat,cl.revenue,
      cl.usage_rights_amount,cl.agency_fee_amount,cl.agency_fee_percent) *
      public.resolve_effective_exchange_rate(coalesce(cl.currency_code,h.currency_code),'EGP'),2)) /
      public.resolve_effective_exchange_rate(h.currency_code,'EGP'),2) AS consumed
  FROM public.campaign_lines cl WHERE cl.campaign_header_id=h.id
) l ON true;
GRANT SELECT ON public.campaign_fx_po_totals TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.sync_campaign_header_po_consumption(p_header_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v record; v_remaining numeric; v_pct numeric;
BEGIN
  SELECT p.*,h.po_expiry_date,h.po_status INTO v FROM public.campaign_fx_po_totals p
    JOIN public.campaign_headers h ON h.id=p.campaign_header_id WHERE h.id=p_header_id;
  IF NOT FOUND THEN RETURN; END IF;
  v_remaining := round(v.po_amount-v.po_consumed,2);
  v_pct := CASE WHEN v.po_amount>0 THEN round(v_remaining/v.po_amount*100,4) END;
  UPDATE public.campaign_headers SET po_consumed_amount=v.po_consumed,
    po_remaining_amount=v_remaining,po_remaining_percent=v_pct,
    po_status=public.compute_po_status(v.po_amount,v.po_consumed,v_pct,v.po_expiry_date,v.po_status)
    WHERE id=p_header_id AND (po_consumed_amount,po_remaining_amount,po_remaining_percent,po_status)
      IS DISTINCT FROM (v.po_consumed,v_remaining,v_pct,
        public.compute_po_status(v.po_amount,v.po_consumed,v_pct,v.po_expiry_date,v.po_status));
END;
$$;

DROP TRIGGER IF EXISTS sync_header_po_on_line_change ON public.campaign_lines;
CREATE TRIGGER sync_header_po_on_line_change
AFTER INSERT OR UPDATE OF revenue_before_vat,revenue,usage_rights_amount,agency_fee_amount,
  agency_fee_percent,campaign_header_id,currency_code,po_amount OR DELETE
ON public.campaign_lines FOR EACH ROW EXECUTE FUNCTION public.trg_sync_campaign_header_po_consumption();

CREATE OR REPLACE FUNCTION public.save_exchange_rate(p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid; v_old jsonb; v_rate numeric := (p_input->>'exchange_rate')::numeric;
  v_from char(3) := upper(p_input->>'from_currency'); v_to char(3) := upper(p_input->>'to_currency');
  v_start date := (p_input->>'effective_start_date')::date;
  v_end date := nullif(p_input->>'effective_end_date','')::date;
  v_historical boolean := p_input->>'apply_mode'='override_historical';
  v_count integer := 0; v_quotes uuid[]; v_header uuid; v_created boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_write_exchange_rates() THEN
    RAISE EXCEPTION 'Finance override permission required' USING ERRCODE='42501';
  END IF;
  IF length(p_input->>'from_currency')<>3 OR length(p_input->>'to_currency')<>3
    OR v_rate IS NULL OR v_rate <= 0 OR v_from=v_to OR v_start IS NULL OR v_end<v_start
    OR (v_historical AND nullif(btrim(p_input->>'override_reason'),'') IS NULL) THEN
    RAISE EXCEPTION 'Invalid exchange rate or missing override reason';
  END IF;
  -- Serialize rate edits, including inverse-pair changes and draft refreshes.
  PERFORM pg_advisory_xact_lock(20260920,1300);
  SELECT coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) INTO v_old FROM public.md_exchange_rates r
    WHERE (from_currency=v_from AND to_currency=v_to) OR (from_currency=v_to AND to_currency=v_from);
  IF nullif(p_input->>'id','') IS NOT NULL THEN
    v_id := (p_input->>'id')::uuid;
    IF NOT EXISTS(SELECT 1 FROM public.md_exchange_rates WHERE id=v_id AND from_currency=v_from AND to_currency=v_to) THEN
      RAISE EXCEPTION 'Exchange rate no longer exists or pair changed';
    END IF;
  ELSE
    SELECT id INTO v_id FROM public.md_exchange_rates WHERE from_currency=v_from AND to_currency=v_to
      AND effective_start_date=v_start ORDER BY updated_at DESC,id DESC LIMIT 1;
  END IF;
  IF v_id IS NULL THEN
    v_created := true;
    INSERT INTO public.md_exchange_rates(from_currency,to_currency,exchange_rate,effective_start_date,
      effective_end_date,source,notes,is_active,created_by)
    VALUES(v_from,v_to,v_rate,v_start,v_end,nullif(p_input->>'source',''),nullif(p_input->>'notes',''),true,auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.md_exchange_rates SET exchange_rate=v_rate,effective_start_date=v_start,effective_end_date=v_end,
      source=nullif(p_input->>'source',''),notes=nullif(p_input->>'notes',''),is_active=true,updated_at=now()
    WHERE id=v_id;
  END IF;
  IF v_historical THEN
    UPDATE public.md_exchange_rates SET exchange_rate=CASE WHEN from_currency=v_from THEN v_rate ELSE round(1/v_rate,8) END,
      updated_at=now()
    WHERE is_active AND effective_start_date<=v_start AND
      ((from_currency=v_from AND to_currency=v_to) OR (from_currency=v_to AND to_currency=v_from));
    -- Cover historical dates before the first recorded rate and gaps between intervals.
    IF v_start>'1900-01-01'::date THEN
      INSERT INTO public.md_exchange_rates(from_currency,to_currency,exchange_rate,effective_start_date,effective_end_date,
        source,notes,is_active,created_by)
      VALUES(v_from,v_to,v_rate,'1900-01-01',v_start-1,'historical_override',p_input->>'override_reason',true,auth.uid());
    END IF;
  END IF;

  -- Only derived reporting fields change. Linked or issued documents retain
  -- their original snapshots; no commercial values, acceptance or PDFs change.
  WITH eligible AS (
    SELECT i.id,i.quotation_id,public.resolve_effective_exchange_rate(i.cost_currency,'EGP',q.issue_date) AS rate
    FROM public.quotation_items i JOIN public.quotations q ON q.id=i.quotation_id
    WHERE q.status::text='draft' AND q.campaign_header_id IS NULL
      AND NOT EXISTS(SELECT 1 FROM public.financial_periods fp
        WHERE fp.year=extract(year FROM q.issue_date) AND fp.month=extract(month FROM q.issue_date) AND fp.status::text<>'open')
  ), changed AS (
    UPDATE public.quotation_items i SET fx_rate_to_egp=e.rate,cost_egp=round(i.cost*e.rate,2),
      revenue_egp=round(i.revenue*e.rate,2),gp_value_egp=round(i.revenue*e.rate,2)-round(i.cost*e.rate,2),
      af_value_egp=round(i.af_value*e.rate,2)
    FROM eligible e WHERE i.id=e.id AND i.fx_rate_to_egp IS DISTINCT FROM e.rate RETURNING i.quotation_id
  ) SELECT count(*),array_agg(DISTINCT quotation_id) INTO v_count,v_quotes FROM changed;
  UPDATE public.quotations q SET total_cost_egp=t.cost,total_revenue_egp=t.revenue,
    total_gp_value_egp=t.revenue-t.cost,total_gp_pct=CASE WHEN t.revenue=0 THEN 0 ELSE round((t.revenue-t.cost)/t.revenue*100,4) END,
    total_af_egp=t.af,total_agency_margin_egp=t.revenue-t.cost+t.af
  FROM (SELECT quotation_id,sum(cost_egp) cost,sum(revenue_egp) revenue,sum(af_value_egp) af
    FROM public.quotation_items WHERE quotation_id=ANY(v_quotes) GROUP BY quotation_id) t WHERE q.id=t.quotation_id;

  FOR v_header IN SELECT id FROM public.campaign_headers LOOP
    PERFORM public.sync_campaign_header_po_consumption(v_header);
  END LOOP;
  INSERT INTO public.fx_rate_audit_logs(exchange_rate_id,action,old_data,new_data,override_reason,
    recalculation_scope,impacted_record_count,changed_by)
  VALUES(v_id,CASE WHEN v_created THEN 'create' ELSE 'update' END,jsonb_build_object('rates',v_old),p_input,p_input->>'override_reason',
    CASE WHEN v_historical THEN 'historical_recalculation' ELSE 'future_effective' END,v_count,auth.uid());
  RETURN jsonb_build_object('id',v_id,'recalculated_items',v_count);
END;
$$;
REVOKE ALL ON FUNCTION public.save_exchange_rate(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_exchange_rate(jsonb) TO authenticated;
-- Audits are written only inside the authorized atomic operation.
ALTER TABLE public.fx_rate_audit_logs ENABLE ROW LEVEL SECURITY;
COMMENT ON FUNCTION public.save_exchange_rate(jsonb) IS 'Atomic finance-authorized FX update, effective history replacement, editable draft revaluation and audit.';

-- Keep obsolete seeded materializations for history, but visibly retire them.
-- Explicitly entered direct pairs remain independent overrides.
WITH retired AS (
  UPDATE public.md_exchange_rates SET is_active=false,updated_at=now()
  WHERE is_active AND source='seed' AND notes LIKE 'Derived %'
  RETURNING *
)
INSERT INTO public.fx_rate_audit_logs(action,old_data,new_data,override_reason,recalculation_scope,impacted_record_count)
SELECT 'update',jsonb_build_object('retired_derived_rates',jsonb_agg(to_jsonb(retired))),
  '{"derived_rates":"resolved dynamically from active underlying pairs"}'::jsonb,
  'FX consistency repair: retire stale generated rates; preserve manually entered rates',
  'derived_rate_repair',count(*) FROM retired HAVING count(*)>0;

DO $$ DECLARE v_id uuid; BEGIN
  FOR v_id IN SELECT id FROM public.campaign_headers LOOP
    PERFORM public.sync_campaign_header_po_consumption(v_id);
  END LOOP;
END; $$;
COMMIT;
