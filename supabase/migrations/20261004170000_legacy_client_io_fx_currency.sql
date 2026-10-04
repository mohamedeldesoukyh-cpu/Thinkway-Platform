BEGIN;
-- Preserve legacy issued snapshots; resolve their original single currency on read.
CREATE OR REPLACE FUNCTION public.update_assignment_reporting_fx(
 p_campaign_id uuid,p_line_id uuid,p_cost_override text,p_revenue_override text,
 p_expected_cost_override text,p_expected_revenue_override text,
 p_expected_currency text,p_expected_cost_currency text
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE l public.campaign_lines%ROWTYPE; v public.client_ios%ROWTYPE;
 rev_ccy text; cost_ccy text; doc_ccy text; rev_rate numeric; cost_rate numeric; cross_rate numeric;
 old_doc_rate numeric; new_doc_rate numeric; doc_rate numeric; event_id uuid; revised integer:=0;
 snap_line jsonb; billable numeric;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_permission('campaigns.write') OR NOT public.can_access_campaign_header(p_campaign_id) THEN
  RAISE EXCEPTION 'You do not have permission to edit assignment FX.';
 END IF;
 SELECT * INTO l FROM public.campaign_lines WHERE id=p_line_id AND campaign_header_id=p_campaign_id FOR UPDATE;
 IF NOT FOUND OR l.status='cancelled' THEN RAISE EXCEPTION 'Active assignment not found.'; END IF;
 rev_ccy:=upper(trim(l.currency_code)); cost_ccy:=upper(trim(coalesce(l.cost_received_currency,l.currency_code)));
 IF l.cost_fx_override IS DISTINCT FROM p_expected_cost_override OR l.revenue_fx_override IS DISTINCT FROM p_expected_revenue_override
 OR rev_ccy IS DISTINCT FROM p_expected_currency OR cost_ccy IS DISTINCT FROM p_expected_cost_currency THEN
  RAISE EXCEPTION 'The assignment FX or currency changed. Refresh before saving; your edits have been kept.';
 END IF;
 IF NOT public.valid_creator_fx(p_cost_override) OR NOT public.valid_creator_fx(p_revenue_override) THEN RAISE EXCEPTION 'Enter valid positive FX rates.'; END IF;
 IF (p_cost_override IS NOT NULL AND (p_cost_override::jsonb->>'from')<>cost_ccy)
 OR (p_revenue_override IS NOT NULL AND (p_revenue_override::jsonb->>'from')<>rev_ccy) THEN
  RAISE EXCEPTION 'The custom FX currency must match the assignment currency.';
 END IF;
 IF l.cost_fx_override IS NOT DISTINCT FROM p_cost_override AND l.revenue_fx_override IS NOT DISTINCT FROM p_revenue_override THEN RETURN 0; END IF;
 rev_rate:=public.resolve_effective_exchange_rate(rev_ccy::char(3),'EGP'::char(3));
 cost_rate:=public.resolve_effective_exchange_rate(cost_ccy::char(3),'EGP'::char(3));
 cross_rate:=CASE WHEN cost_ccy=rev_ccy THEN 1 ELSE coalesce(l.fx_cost_revenue_cross_rate,cost_rate/rev_rate) END;
 IF p_cost_override IS NULL AND p_revenue_override IS NULL THEN cross_rate:=NULL; END IF;
 INSERT INTO public.business_change_events(event_type,reason_code,reason_detail,campaign_header_id,entity_type,entity_id,payload,actor_id)
 VALUES('assignment_fx_changed','assignment_fx_changed','Assignment reporting FX updated; native amounts and issued documents preserved.',p_campaign_id,'campaign_line',p_line_id,
 jsonb_build_object('previous_cost_fx',l.cost_fx_override,'previous_revenue_fx',l.revenue_fx_override,'cost_fx',p_cost_override,'revenue_fx',p_revenue_override,'cost_revenue_cross_rate',cross_rate),auth.uid()) RETURNING id INTO event_id;
 -- Inspect the frozen currency and rate on the issued document, never the campaign display selector.
 IF l.revenue_fx_override IS DISTINCT FROM p_revenue_override THEN
  FOR v IN SELECT * FROM public.client_ios WHERE campaign_header_id=p_campaign_id AND NOT is_superseded
   AND status IN('generated','sent','under_client_review','approved','rejected','revision_required') FOR UPDATE
  LOOP
   IF v.assignment_snapshot IS NULL THEN RAISE EXCEPTION 'The existing Client IO has no frozen snapshot. Preserve its original document before changing revenue FX.'; END IF;
   SELECT value INTO snap_line FROM jsonb_array_elements(v.assignment_snapshot->'lines') WHERE value->>'id'=p_line_id::text LIMIT 1;
   IF snap_line IS NULL THEN CONTINUE; END IF;
   doc_ccy:=nullif(trim(v.assignment_snapshot->>'documentCurrency'),'');
   -- Legacy V1 IO rendering uses the frozen line currency when documentCurrency
   -- was not yet captured. Recover it only when every frozen line agrees.
   -- Never infer an issued IO currency from today's campaign display currency.
   IF doc_ccy IS NULL AND jsonb_array_length(v.assignment_snapshot->'lines')>0 THEN
    SELECT min(value->>'currency_code') INTO doc_ccy
    FROM jsonb_array_elements(v.assignment_snapshot->'lines')
    HAVING count(DISTINCT value->>'currency_code')=1
       AND bool_and(coalesce((value->>'currency_code') ~ '^[A-Z]{3}$',false));
   END IF;
   IF doc_ccy IS NULL THEN RAISE EXCEPTION 'The issued Client IO currency is missing. Preserve its original currency before changing revenue FX.'; END IF;
   -- No client revision when the IO is already in the assignment's native currency.
   IF doc_ccy=rev_ccy THEN CONTINUE; END IF;
   old_doc_rate:=(v.assignment_snapshot->'assignmentFxRates'->>p_line_id::text)::numeric;
   IF old_doc_rate IS NULL OR old_doc_rate<=0 THEN RAISE EXCEPTION 'The issued Client IO FX snapshot is missing. Preserve it before changing revenue FX.'; END IF;
   doc_rate:=public.resolve_effective_exchange_rate(doc_ccy::char(3),'EGP'::char(3));
   new_doc_rate:=public.creator_fx_rate(p_revenue_override,rev_ccy,doc_ccy,rev_rate,doc_rate);
   billable:=public.resolve_line_po_billable_base((snap_line->>'revenue_before_vat')::numeric,(snap_line->>'revenue')::numeric,(snap_line->>'usage_rights_amount')::numeric,(snap_line->>'agency_fee_amount')::numeric,(snap_line->>'agency_fee_percent')::numeric);
   IF round(billable*old_doc_rate,2)=round(billable*new_doc_rate,2) THEN CONTINUE; END IF;
   UPDATE public.client_ios SET status='revision_required',updated_by=auth.uid(),lifecycle_reason_code='assignment_fx_changed',
    lifecycle_reason_detail='Revenue FX changed the amount in the issued Client IO currency. Regenerate and send a revised IO.',lifecycle_changed_at=now(),lifecycle_changed_by=auth.uid() WHERE id=v.id;
   INSERT INTO public.document_lifecycle_reactions(business_change_event_id,document_type,document_id,from_status,to_status,reason_code,reason_detail,recommended_actions)
   VALUES(event_id,'client_io',v.id,v.status,'revision_required','assignment_fx_changed','Revenue FX changed the client-facing amount.',ARRAY['preview_changes','regenerate','send_updated_version']);
   revised:=revised+1;
  END LOOP;
 END IF;
 -- Reporting-only change: do not rewrite quotation masters, invoice allocations, native values or historical IO payloads.
 UPDATE public.campaign_lines SET cost_fx_override=p_cost_override,revenue_fx_override=p_revenue_override,fx_cost_revenue_cross_rate=cross_rate WHERE id=p_line_id;
 RETURN revised;
END; $$;
REVOKE ALL ON FUNCTION public.update_assignment_reporting_fx(uuid,uuid,text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_assignment_reporting_fx(uuid,uuid,text,text,text,text,text,text) TO authenticated;
COMMIT;
