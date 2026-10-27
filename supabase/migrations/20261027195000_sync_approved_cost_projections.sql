BEGIN;
CREATE OR REPLACE FUNCTION public.apply_assignment_commercial_cost(p_line uuid,p_patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE prior campaign_lines%ROWTYPE; updated campaign_lines%ROWTYPE; patch jsonb; assignments text;
 rate numeric; cross_rate numeric; native_cost numeric; assignment_row record; rows_json jsonb;
BEGIN
 SELECT * INTO STRICT prior FROM campaign_lines WHERE id=p_line FOR UPDATE;
 IF auth.uid() IS NULL OR NOT (has_permission('campaigns.write') OR has_permission('campaigns.admin') OR has_permission('approvals.decide')) OR NOT can_access_campaign_header(prior.campaign_header_id) THEN
   RAISE EXCEPTION 'You do not have permission to change this assignment.';
 END IF;
 IF jsonb_typeof(p_patch)<>'object' OR p_patch IS NULL THEN RAISE EXCEPTION 'Commercial patch required'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN
 ('cost','cost_before_vat','revenue','revenue_before_vat','po_amount','currency_code','fx_rate','agency_fee_percent','agency_fee_amount','pricing_mode','markup_margin','profit','profit_margin','usage_rights_amount','usage_rights_cost','cost_vat_percent','cost_vat_exempt','revenue_vat_percent','revenue_vat_exempt','cost_fx_override','revenue_fx_override')) THEN
 RAISE EXCEPTION 'Unsupported commercial field'; END IF;
 IF NOT (p_patch ?| ARRAY['cost_before_vat','usage_rights_cost','cost_vat_percent','cost_vat_exempt']) THEN RAISE EXCEPTION 'Cost patch required'; END IF;
 -- Also protects reconciliation of an already-approved master whose projections are stale.
 IF prior.cost_locked THEN RAISE EXCEPTION 'Ungenerate the Vendor IO before changing costs.'; END IF;
 PERFORM id FROM campaign_influencers WHERE campaign_line_id=p_line ORDER BY id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM campaign_influencers a WHERE a.campaign_line_id=p_line AND (a.vendor_payment_status='paid' OR EXISTS
 (SELECT 1 FROM creator_payment_entries e WHERE e.assignment_id=a.id AND e.status IN ('paid','exported') AND e.cleared_at IS NULL))) THEN
 RAISE EXCEPTION 'Vendor payment is recorded or pending. Clear the payment before changing costs.'; END IF;
 patch:=p_patch;
 IF patch ? 'cost_before_vat' THEN patch:=patch || jsonb_build_object('cost',patch->'cost_before_vat'); END IF;
 IF coalesce(prior.cost_received_currency,prior.currency_code)=coalesce(patch->>'currency_code',prior.currency_code) THEN cross_rate:=1;
 ELSE cross_rate:=coalesce(nullif(prior.fx_cost_revenue_cross_rate,0),nullif(prior.cost_before_vat,0)/nullif(prior.cost_received,0),nullif(prior.fx_rate,0)); END IF;
 IF cross_rate IS NULL OR cross_rate<=0 THEN RAISE EXCEPTION 'A valid vendor currency conversion is required.'; END IF;
 native_cost:=round(coalesce((patch->>'cost_before_vat')::numeric,prior.cost_before_vat)/cross_rate,2);
 patch:=patch || jsonb_build_object('cost_received',native_cost);
 SELECT string_agg(format('%I=(jsonb_populate_record(NULL::public.campaign_lines,$1)).%I',key,key),',') INTO assignments FROM jsonb_object_keys(patch) key;
 EXECUTE format('UPDATE public.campaign_lines SET %s WHERE id=$2',assignments) USING patch,p_line;
 SELECT * INTO STRICT updated FROM campaign_lines WHERE id=p_line;
 rate:=CASE WHEN updated.cost_vat_exempt THEN 0 ELSE coalesce(updated.cost_vat_percent,0) END;
 FOR assignment_row IN SELECT id FROM campaign_influencers WHERE campaign_line_id=p_line ORDER BY id FOR UPDATE LOOP
   UPDATE campaign_influencers SET agreed_fee=native_cost,cost_before_vat=native_cost,cost_vat_percent=rate,
     cost_vat_amount=round(native_cost*rate/100,2),cost_after_vat=native_cost+round(native_cost*rate/100,2) WHERE id=assignment_row.id;
   UPDATE creator_payment_terms SET fee=(SELECT cost_before_vat FROM campaign_influencers WHERE id=assignment_row.id),vat=rate,updated_at=now(),updated_by=auth.uid() WHERE assignment_id=assignment_row.id;
 END LOOP;
 -- Preserve IDs, uploads, publication dates, revenue, invoice links and allocation weights.
 WITH weights AS (
 SELECT id,quantity,CASE WHEN updated.pricing_mode='package' OR sum(cost_before_vat) OVER()<=0 THEN greatest(quantity,1) ELSE cost_before_vat END w
 FROM assignment_deliverables WHERE campaign_line_id=p_line
 ), shares AS (SELECT *,sum(w) OVER(ORDER BY id) running,sum(w) OVER() total FROM weights), amounts AS (
 SELECT id,quantity,round(updated.cost_before_vat*running/total,2)-round(updated.cost_before_vat*(running-w)/total,2) cost,
 round(coalesce(updated.usage_rights_cost,0)*running/total,2)-round(coalesce(updated.usage_rights_cost,0)*(running-w)/total,2) ur FROM shares
 ) UPDATE assignment_deliverables d SET cost_before_vat=x.cost,total_cost=x.cost,unit_cost=round(x.cost/greatest(x.quantity,1),2),usage_rights_cost=x.ur,
 cost_vat_percent=rate,cost_vat_exempt=updated.cost_vat_exempt,cost_vat_amount=round(x.cost*rate/100,2),cost_after_vat=x.cost+round(x.cost*rate/100,2)
 FROM amounts x WHERE d.id=x.id;
 WITH weights AS (
 SELECT p.id,d.id deliverable_id,d.cost_before_vat cost,CASE WHEN sum(p.cost_before_vat) OVER(PARTITION BY d.id)>0 THEN p.cost_before_vat ELSE 1 END w
 FROM assignment_post_schedule p JOIN assignment_deliverables d ON d.id=p.assignment_deliverable_id WHERE p.campaign_line_id=p_line
 ), shares AS (SELECT *,sum(w) OVER(PARTITION BY deliverable_id ORDER BY id) running,sum(w) OVER(PARTITION BY deliverable_id) total FROM weights), amounts AS (
 SELECT id,round(cost*running/total,2)-round(cost*(running-w)/total,2) cost FROM shares
 ) UPDATE assignment_post_schedule p SET cost_before_vat=x.cost,cost_vat_percent=rate,cost_vat_amount=round(x.cost*rate/100,2) FROM amounts x WHERE p.id=x.id;
 -- The editable per-deliverable metadata is another projection of the same master.
 IF jsonb_typeof(updated.metadata#>'{influencer_assignment,commercial_rows}')='array' AND jsonb_array_length(updated.metadata#>'{influencer_assignment,commercial_rows}')>0 THEN
 WITH weights AS (
 SELECT value,ordinality,CASE WHEN sum(coalesce((value->>'cost_before_vat')::numeric,0)) OVER()>0 THEN coalesce((value->>'cost_before_vat')::numeric,0) ELSE greatest(coalesce((value->>'quantity')::numeric,1),1) END w
 FROM jsonb_array_elements(updated.metadata#>'{influencer_assignment,commercial_rows}') WITH ORDINALITY
 ), shares AS (SELECT *,sum(w) OVER(ORDER BY ordinality) running,sum(w) OVER() total FROM weights), amounts AS (
 SELECT *,round(updated.cost_before_vat*running/total,2)-round(updated.cost_before_vat*(running-w)/total,2) cost,
 round(coalesce(updated.usage_rights_cost,0)*running/total,2)-round(coalesce(updated.usage_rights_cost,0)*(running-w)/total,2) ur FROM shares)
 SELECT jsonb_agg(value || jsonb_build_object('cost_before_vat',cost,'total_cost',cost,'unit_cost',round(cost/greatest(coalesce((value->>'quantity')::numeric,1),1),2),'usage_rights_cost',ur) ORDER BY ordinality) INTO rows_json FROM amounts;
 UPDATE campaign_lines SET metadata=jsonb_set(metadata,'{influencer_assignment,commercial_rows}',rows_json) WHERE id=p_line;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.apply_assignment_commercial_cost(uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_assignment_commercial_cost(uuid,jsonb) TO authenticated;
COMMIT;
