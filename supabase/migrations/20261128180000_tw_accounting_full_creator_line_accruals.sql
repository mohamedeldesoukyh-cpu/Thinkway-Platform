BEGIN;
-- Authorized full-line eligibility; other tax and clearing behavior is preserved.
CREATE OR REPLACE FUNCTION tw_accounting_invoice_native_parts(p_invoice uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; parts jsonb; basis numeric; native numeric; k text; key text; reviewed jsonb; result jsonb:='{}';
BEGIN
 -- Approved historical journals may hold a frozen, reviewed native breakdown.
 -- The invoice and its saved custom FX are never repriced or rewritten here.
 IF EXISTS(SELECT 1 FROM invoice_line_items li WHERE li.invoice_id=p_invoice AND
  (li.metadata->'accounting_components' IS NULL OR nullif(coalesce(li.metadata->'billing_fx'->>'source_amount',li.metadata->>'operational_source_amount'),'') IS NULL)) THEN
  SELECT j.posting_mapping->'historicalNativeParts' INTO reviewed
  FROM tw_accounting_journals j JOIN invoices i ON i.id=j.source_invoice_id
  WHERE j.source_invoice_id=p_invoice AND j.status='posted'
   AND j.posting_mapping->>'historicalInvoiceHash'=md5(tw_accounting_invoice_snapshot(i)::text)
   AND jsonb_typeof(j.posting_mapping->'historicalNativeParts')='object'
  ORDER BY j.created_at DESC LIMIT 1;
  IF reviewed IS NOT NULL THEN RETURN reviewed;END IF;
 END IF;
 FOR r IN SELECT * FROM invoice_line_items WHERE invoice_id=p_invoice ORDER BY id LOOP
  IF r.campaign_line_id IS NULL THEN CONTINUE; END IF;
  parts:=r.metadata->'accounting_components';
  basis:=coalesce((parts->>'assignment_revenue')::numeric,0)+coalesce((parts->>'agency_fee')::numeric,0)+coalesce((parts->>'usage_rights_revenue')::numeric,0);
  native:=nullif(coalesce(r.metadata->'billing_fx'->>'source_amount',r.metadata->>'operational_source_amount'),'')::numeric;
  IF basis<=0 OR native IS NULL OR native<0 THEN RAISE EXCEPTION 'Invoice % needs its frozen assignment breakdown before monthly accrual review',p_invoice; END IF;
  FOREACH k IN ARRAY ARRAY['assignment_revenue','agency_fee','usage_rights_revenue'] LOOP
   key:=r.campaign_line_id::text||':'||k;
   result:=jsonb_set(result,ARRAY[key],to_jsonb(coalesce((result->>key)::numeric,0)+native*coalesce((parts->>k)::numeric,0)/basis));
  END LOOP;
 END LOOP;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.tw_accounting_monthly_plan(p_company uuid, p_month date, p_date date, p_assignments uuid[] DEFAULT NULL::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c tw_accounting_companies%ROWTYPE; r record; x record; k text; native numeric; fraction numeric; target numeric;
 billed numeric; used numeric; actual numeric; released numeric; amount numeric; rate numeric; ccy text; m jsonb; counter jsonb;
 result jsonb:='[]'; live_dates jsonb; parts jsonb; billed_parts jsonb:='{}'; key text; v jsonb; clientcode text;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 IF p_month IS NULL OR p_date IS NULL OR p_month<>date_trunc('month',p_month)::date OR p_date>(now() AT TIME ZONE 'Africa/Cairo')::date OR p_date<p_month THEN RAISE EXCEPTION 'Choose a valid month and posting date';END IF;
 SELECT * INTO STRICT c FROM tw_accounting_companies WHERE id=p_company;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_periods p JOIN tw_accounting_years y ON y.id=p.year_id WHERE y.company_id=p_company AND p_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed) THEN RAISE EXCEPTION 'Choose an open posting period';END IF;
 FOR x IN SELECT DISTINCT s.invoice_id FROM tw_accounting_invoice_submissions s JOIN tw_accounting_journals j ON j.id=s.journal_id WHERE s.company_id=p_company AND j.status='posted' AND j.entry_date<=least((p_month+interval '1 month' - interval '1 day')::date,p_date) AND (p_assignments IS NULL OR EXISTS(SELECT 1 FROM invoice_line_items li WHERE li.invoice_id=s.invoice_id AND li.campaign_line_id=ANY(p_assignments))) LOOP
  parts:=tw_accounting_invoice_native_parts(x.invoice_id);
  FOR key,v IN SELECT * FROM jsonb_each(parts) LOOP billed_parts:=jsonb_set(billed_parts,ARRAY[key],to_jsonb(coalesce((billed_parts->>key)::numeric,0)+(v#>>'{}')::numeric));END LOOP;
 END LOOP;
 FOR r IN SELECT l.*,h.name campaign,h.client_id FROM campaign_lines l JOIN campaign_headers h ON h.id=l.campaign_header_id
  WHERE (p_assignments IS NULL OR l.id=ANY(p_assignments))
   AND nullif(l.metadata->>'went_live_date','') IS NOT NULL
   AND coalesce(l.metadata->>'went_live','true')<>'false'
   AND (l.metadata->>'went_live_date')::date<=least((p_month+interval '1 month' - interval '1 day')::date,p_date)
  ORDER BY l.id LOOP
  -- The entire creator line is recognized on its assignment Went live date.
  live_dates:=jsonb_build_object('basis','full_creator_line','assignment',r.id,'date',r.metadata->>'went_live_date');
  fraction:=1;
  FOREACH k IN ARRAY ARRAY['assignment_revenue','agency_fee','usage_rights_revenue','assignment_cost','usage_rights_cost'] LOOP
   key:=CASE k WHEN 'assignment_revenue' THEN 'revenue' WHEN 'agency_fee' THEN 'fee' WHEN 'usage_rights_revenue' THEN 'ur' WHEN 'assignment_cost' THEN 'cost' ELSE 'urCost' END;
   native:=CASE k WHEN 'assignment_revenue' THEN coalesce(r.revenue_before_vat,r.revenue,0) WHEN 'agency_fee' THEN coalesce(nullif(r.agency_fee_amount,0),(coalesce(r.revenue_before_vat,r.revenue,0)+coalesce(r.usage_rights_amount,0))*coalesce(r.agency_fee_percent,0)/100) WHEN 'usage_rights_revenue' THEN coalesce(r.usage_rights_amount,0) WHEN 'assignment_cost' THEN coalesce(r.cost_received,r.cost_before_vat,r.cost,0) ELSE coalesce(r.usage_rights_cost,0) END;
   IF native<0 THEN RAISE EXCEPTION 'Review negative assignment amount: %',r.document_number;END IF;
   IF native=0 THEN CONTINUE;END IF;
   target:=round(native,2);IF target<=0 THEN CONTINUE;END IF;
   ccy:=trim(CASE WHEN k='assignment_cost' THEN coalesce(nullif(r.cost_received_currency,''),r.currency_code) ELSE r.currency_code END);
   IF NOT(ccy=ANY(c.currencies)) THEN RAISE EXCEPTION 'Enable % for %',ccy,r.document_number;END IF;
   IF k IN('assignment_cost','usage_rights_cost') THEN
    SELECT coalesce(sum(a.amount*resolve_effective_exchange_rate(a.currency,ccy,p_date)),0) INTO used FROM tw_accounting_cost_accruals a JOIN tw_accounting_journals j ON j.id=a.journal_id LEFT JOIN tw_accounting_monthly_accruals b ON b.id=a.monthly_id WHERE a.company_id=p_company AND a.assignment_line_id=r.id AND a.component=k AND j.status='posted' AND b.reversal_id IS NULL;
    SELECT coalesce(sum(z.net*resolve_effective_exchange_rate(z.currency,ccy,z.document_date)),0) INTO actual FROM tw_accounting_cost_invoices z WHERE z.company_id=p_company AND z.assignment_line_id=r.id AND z.status IN('internal','supplier') AND z.document_date<=least((p_month+interval '1 month' - interval '1 day')::date,p_date);
    SELECT coalesce(sum(z.amount*resolve_effective_exchange_rate(a.currency,ccy,p_date)),0) INTO released FROM tw_accounting_accrual_clearings z JOIN tw_accounting_cost_accruals a ON a.id=z.accrual_id JOIN tw_accounting_journals j ON j.id=z.journal_id LEFT JOIN tw_accounting_monthly_accruals b ON b.id=a.monthly_id WHERE a.company_id=p_company AND a.assignment_line_id=r.id AND j.status='posted' AND b.reversal_id IS NULL;
    billed:=greatest(actual-released,0)*native/nullif(coalesce(r.cost_received,r.cost_before_vat,r.cost,0)*resolve_effective_exchange_rate(coalesce(nullif(r.cost_received_currency,''),r.currency_code),ccy,p_date)+coalesce(r.usage_rights_cost,0)*resolve_effective_exchange_rate(r.currency_code,ccy,p_date),0);
   ELSE
    billed:=coalesce((billed_parts->>(r.id::text||':'||k))::numeric,0);
    SELECT coalesce(sum(a.amount-coalesce((SELECT sum(z.amount) FROM tw_accounting_monthly_revenue_clearings z JOIN tw_accounting_journals j ON j.id=z.journal_id WHERE z.accrual_id=a.id AND j.status='posted'),0)),0) INTO used FROM tw_accounting_monthly_revenue a JOIN tw_accounting_monthly_accruals b ON b.id=a.run_id WHERE a.company_id=p_company AND a.assignment_id=r.id AND a.component=k AND b.reversal_id IS NULL;
   END IF;
   amount:=round(greatest(target-coalesce(billed,0)-used,0),2);IF amount=0 THEN CONTINUE;END IF;
   m:=tw_accounting_media_mapping(p_company,k);counter:=tw_accounting_media_mapping(p_company,CASE WHEN k IN('assignment_cost','usage_rights_cost') THEN 'accrued_cost' ELSE 'unbilled_revenue' END);
   PERFORM tw_accounting_require_account(p_company,m->>'account','Posting',CASE WHEN k IN('assignment_cost','usage_rights_cost') THEN 'Expense' ELSE 'Revenue' END,CASE WHEN k IN('assignment_cost','usage_rights_cost') THEN 'Debit' ELSE 'Credit' END);
   PERFORM tw_accounting_require_account(p_company,counter->>'account',CASE WHEN k IN('assignment_cost','usage_rights_cost') THEN 'Posting' ELSE 'Control' END,CASE WHEN k IN('assignment_cost','usage_rights_cost') THEN 'Liability' ELSE 'Asset' END,CASE WHEN k IN('assignment_cost','usage_rights_cost') THEN 'Credit' ELSE 'Debit' END,CASE WHEN k NOT IN('assignment_cost','usage_rights_cost') THEN 'Customer' END);
   IF EXISTS(SELECT 1 FROM tw_accounting_accounts WHERE company_id=p_company AND code=m->>'account' AND has_auxiliary) AND m->>'auxiliary_id' IS NULL THEN RAISE EXCEPTION 'Configure % auxiliary in System Mapping',k;END IF;
   SELECT document_number INTO clientcode FROM clients WHERE id=r.client_id;
   IF k NOT IN('assignment_cost','usage_rights_cost') AND clientcode IS NULL THEN RAISE EXCEPTION 'Client code required for %',r.document_number;END IF;
   rate:=resolve_effective_exchange_rate(ccy,c.base_currency,p_date);
   IF round(amount*rate,2)<=0 THEN RAISE EXCEPTION 'Accrual is below one local-currency cent';END IF;
   result:=result||jsonb_build_array(jsonb_build_object('assignment',r.id,'reference',r.document_number,'campaign',r.campaign,'component',k,'label',m->>'media_label','currency',ccy,'amount',amount::text,'baseAmount',round(amount*rate,2)::text,'rate',rate::text,'account',m->>'account','auxiliary',m->>'auxiliary_id','auxiliaryLabel',(SELECT number::text||' · '||name FROM tw_accounting_auxiliaries WHERE id=nullif(m->>'auxiliary_id','')::uuid),'counter',counter->>'account','client',r.client_id,'clientCode',clientcode,'maximum',native::text,'liveShare',fraction,'liveEvidence',live_dates));
  END LOOP;
 END LOOP;
 RETURN jsonb_build_object('company',p_company,'month',p_month,'date',p_date,'base',c.base_currency,'items',result,'token',md5(result::text||p_date::text||p_month::text));
END $function$;
COMMIT;
