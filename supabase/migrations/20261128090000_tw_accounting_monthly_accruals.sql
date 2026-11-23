BEGIN;
-- Monthly estimates contain net commercial components only. No tax field is
-- read into an accrual. Actual invoices retain their existing tax posting path.
CREATE TABLE tw_accounting_monthly_accruals (
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),
 month date NOT NULL, posting_date date NOT NULL, journal_id uuid NOT NULL UNIQUE REFERENCES tw_accounting_journals(id),
 reversal_id uuid UNIQUE REFERENCES tw_accounting_journals(id), plan jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), created_by uuid NOT NULL REFERENCES profiles(id)
);
CREATE TABLE tw_accounting_monthly_revenue (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), run_id uuid NOT NULL REFERENCES tw_accounting_monthly_accruals(id),
 company_id uuid NOT NULL REFERENCES tw_accounting_companies(id), assignment_id uuid NOT NULL REFERENCES campaign_lines(id),
 component text NOT NULL CHECK(component IN('assignment_revenue','agency_fee','usage_rights_revenue')),
 currency text NOT NULL, amount numeric(18,2) NOT NULL CHECK(amount>0), base_amount numeric(18,2) NOT NULL CHECK(base_amount>0),
 source jsonb NOT NULL, UNIQUE(run_id,assignment_id,component)
);
CREATE TABLE tw_accounting_monthly_revenue_clearings (
 accrual_id uuid NOT NULL REFERENCES tw_accounting_monthly_revenue(id), invoice_id uuid NOT NULL REFERENCES invoices(id),
 journal_id uuid NOT NULL REFERENCES tw_accounting_journals(id), amount numeric(18,2) NOT NULL CHECK(amount>0),
 base_amount numeric(18,2) NOT NULL CHECK(base_amount>0), PRIMARY KEY(accrual_id,invoice_id,journal_id)
);
ALTER TABLE tw_accounting_cost_accruals ALTER COLUMN invoice_id DROP NOT NULL;
ALTER TABLE tw_accounting_cost_accruals ADD COLUMN monthly_id uuid REFERENCES tw_accounting_monthly_accruals(id);
ALTER TABLE tw_accounting_cost_accruals ADD CONSTRAINT tw_accrual_origin CHECK ((invoice_id IS NULL) <> (monthly_id IS NULL));
CREATE TABLE tw_accounting_monthly_cost_transfers (
 accrual_id uuid NOT NULL REFERENCES tw_accounting_cost_accruals(id), invoice_id uuid NOT NULL REFERENCES invoices(id), journal_id uuid NOT NULL REFERENCES tw_accounting_journals(id),
 amount numeric(18,2) NOT NULL CHECK(amount>0), base_amount numeric(18,2) NOT NULL CHECK(base_amount>0), PRIMARY KEY(accrual_id,invoice_id,journal_id)
);
ALTER TABLE tw_accounting_cost_accruals DROP CONSTRAINT tw_accounting_cost_accruals_amount_check;
ALTER TABLE tw_accounting_cost_accruals DROP CONSTRAINT tw_accounting_cost_accruals_base_amount_check;
ALTER TABLE tw_accounting_cost_accruals ADD CHECK(amount>=0 AND base_amount>=0 AND (amount>0 OR monthly_id IS NOT NULL));
CREATE INDEX tw_monthly_revenue_assignment ON tw_accounting_monthly_revenue(company_id,assignment_id,component);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['tw_accounting_monthly_accruals','tw_accounting_monthly_revenue','tw_accounting_monthly_revenue_clearings','tw_accounting_monthly_cost_transfers'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('GRANT SELECT ON %I TO authenticated',t);
  EXECUTE format('CREATE POLICY accounting_read ON %I FOR SELECT TO authenticated USING ((SELECT (tw_module_access()->>''accounting'')::boolean))',t);
  EXECUTE format('CREATE TRIGGER accounting_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION tw_accounting_audit_change()',t);
 END LOOP;
END $$;
-- Shared paired lines use the original booked amounts when releasing/reversing.
CREATE FUNCTION tw_accounting_monthly_pair(p_journal uuid,p_item jsonb,p_reverse boolean,p_label text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_accounting_journals%ROWTYPE;n integer;cost boolean;dr boolean;selected_code text;idx integer;a numeric;b numeric;
BEGIN
 SELECT * INTO STRICT j FROM tw_accounting_journals WHERE id=p_journal;
 SELECT coalesce(max(line_number),0) INTO n FROM tw_accounting_journal_lines WHERE journal_id=p_journal;
 cost:=p_item->>'component' IN('assignment_cost','usage_rights_cost');a:=(p_item->>'amount')::numeric;b:=(p_item->>'baseAmount')::numeric;
 IF a<=0 OR b<=0 THEN RAISE EXCEPTION 'Accrual amounts must be positive';END IF;
 FOR idx IN 1..2 LOOP
  selected_code:=p_item->>CASE WHEN idx=1 THEN 'account' ELSE 'counter' END;
  dr:=(CASE WHEN idx=1 THEN cost ELSE NOT cost END)<>p_reverse;
  INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,line_currency,line_rate,auxiliary_id,client_id,client_code)
  SELECT j.id,n+idx,j.company_id,ac.code,ac.name,left(p_label||' · '||(p_item->>'reference')||' · '||(p_item->>'component'),500),CASE WHEN dr THEN b ELSE 0 END,CASE WHEN dr THEN 0 ELSE b END,CASE WHEN dr THEN a ELSE 0 END,CASE WHEN dr THEN 0 ELSE a END,p_item->>'currency',(p_item->>'rate')::numeric,CASE WHEN idx=1 THEN nullif(p_item->>'auxiliary','')::uuid END,CASE WHEN idx=2 AND NOT cost THEN (p_item->>'client')::uuid END,CASE WHEN idx=2 AND NOT cost THEN p_item->>'clientCode' END
  FROM tw_accounting_accounts ac WHERE ac.company_id=j.company_id AND ac.code=selected_code;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mapped account is missing';END IF;
 END LOOP;
END $$;

-- Frozen operational amount per revenue component, not invoice-currency gross.
CREATE FUNCTION tw_accounting_invoice_native_parts(p_invoice uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r record; parts jsonb; basis numeric; native numeric; k text; key text; result jsonb:='{}';
BEGIN
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

CREATE FUNCTION tw_accounting_monthly_plan(p_company uuid,p_month date,p_date date,p_assignments uuid[] DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c tw_accounting_companies%ROWTYPE; r record; x record; k text; native numeric; fraction numeric; weights numeric; target numeric;
 billed numeric; used numeric; actual numeric; released numeric; amount numeric; rate numeric; ccy text; m jsonb; counter jsonb;
 result jsonb:='[]'; live_dates jsonb; parts jsonb; billed_parts jsonb:='{}'; key text; v jsonb; clientcode text;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 IF p_month IS NULL OR p_date IS NULL OR p_month<>date_trunc('month',p_month)::date OR p_date>(now() AT TIME ZONE 'Africa/Cairo')::date OR p_date<p_month THEN RAISE EXCEPTION 'Choose a valid month and posting date';END IF;
 SELECT * INTO STRICT c FROM tw_accounting_companies WHERE id=p_company;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_periods p JOIN tw_accounting_years y ON y.id=p.year_id WHERE y.company_id=p_company AND p_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed) THEN RAISE EXCEPTION 'Choose an open posting period';END IF;
 FOR x IN SELECT DISTINCT s.invoice_id FROM tw_accounting_invoice_submissions s JOIN tw_accounting_journals j ON j.id=s.journal_id WHERE s.company_id=p_company AND j.status='posted' AND (p_assignments IS NULL OR EXISTS(SELECT 1 FROM invoice_line_items li WHERE li.invoice_id=s.invoice_id AND li.campaign_line_id=ANY(p_assignments))) LOOP
  parts:=tw_accounting_invoice_native_parts(x.invoice_id);
  FOR key,v IN SELECT * FROM jsonb_each(parts) LOOP billed_parts:=jsonb_set(billed_parts,ARRAY[key],to_jsonb(coalesce((billed_parts->>key)::numeric,0)+(v#>>'{}')::numeric));END LOOP;
 END LOOP;
 FOR r IN SELECT l.*,h.name campaign,h.client_id FROM campaign_lines l JOIN campaign_headers h ON h.id=l.campaign_header_id
  WHERE (p_assignments IS NULL OR l.id=ANY(p_assignments)) AND EXISTS(SELECT 1 FROM assignment_post_schedule s WHERE s.campaign_line_id=l.id AND s.live_date<=least((p_month+interval '1 month' - interval '1 day')::date,p_date)
   AND s.status::text IN('posted','published','live','verified') AND
    ((s.metadata->>'live_date_source'='publication' AND EXISTS(SELECT 1 FROM campaign_publications p WHERE p.id::text=s.metadata->>'publication_id' AND publication_assignment_line(p)=l.id AND (p.publication_date AT TIME ZONE 'Africa/Cairo')::date=s.live_date))
     OR (s.metadata->>'live_date_source'='manual' AND NOT s.metadata ? 'assignment_live_date')))
  ORDER BY l.id LOOP
  SELECT jsonb_object_agg(d.id::text,jsonb_build_object('live',z.live,'count',greatest(d.quantity,z.total),'revenue',coalesce(d.revenue_before_vat,0),'ur',coalesce(d.usage_rights_amount,0),'fee',coalesce(nullif(d.agency_fee_amount,0),(coalesce(d.revenue_before_vat,0)+coalesce(d.usage_rights_amount,0))*coalesce(d.agency_fee_percent,0)/100),'cost',coalesce(d.cost_before_vat,0),'urCost',coalesce(d.usage_rights_cost,0))) INTO live_dates
  FROM assignment_deliverables d CROSS JOIN LATERAL(SELECT count(*) total,count(*) FILTER(WHERE s.live_date<=least((p_month+interval '1 month' - interval '1 day')::date,p_date) AND s.status::text IN('posted','published','live','verified') AND
   ((s.metadata->>'live_date_source'='publication' AND EXISTS(SELECT 1 FROM campaign_publications p WHERE p.id::text=s.metadata->>'publication_id' AND publication_assignment_line(p)=r.id AND (p.publication_date AT TIME ZONE 'Africa/Cairo')::date=s.live_date)) OR (s.metadata->>'live_date_source'='manual' AND NOT s.metadata ? 'assignment_live_date'))) live FROM assignment_post_schedule s WHERE s.assignment_deliverable_id=d.id) z WHERE d.campaign_line_id=r.id;
  FOREACH k IN ARRAY ARRAY['assignment_revenue','agency_fee','usage_rights_revenue','assignment_cost','usage_rights_cost'] LOOP
   key:=CASE k WHEN 'assignment_revenue' THEN 'revenue' WHEN 'agency_fee' THEN 'fee' WHEN 'usage_rights_revenue' THEN 'ur' WHEN 'assignment_cost' THEN 'cost' ELSE 'urCost' END;
   native:=CASE k WHEN 'assignment_revenue' THEN coalesce(r.revenue_before_vat,r.revenue,0) WHEN 'agency_fee' THEN coalesce(nullif(r.agency_fee_amount,0),(coalesce(r.revenue_before_vat,r.revenue,0)+coalesce(r.usage_rights_amount,0))*coalesce(r.agency_fee_percent,0)/100) WHEN 'usage_rights_revenue' THEN coalesce(r.usage_rights_amount,0) WHEN 'assignment_cost' THEN coalesce(r.cost_received,r.cost_before_vat,r.cost,0) ELSE coalesce(r.usage_rights_cost,0) END;
   IF native<0 THEN RAISE EXCEPTION 'Review negative assignment amount: %',r.document_number;END IF;
   IF native=0 THEN CONTINUE;END IF;
   SELECT sum((e.v->>key)::numeric) INTO weights FROM jsonb_each(live_dates) e(id,v);
   SELECT CASE WHEN weights>0 THEN sum((e.v->>key)::numeric*(e.v->>'live')::numeric/nullif((e.v->>'count')::numeric,0))/weights ELSE sum((e.v->>'live')::numeric)/nullif(sum((e.v->>'count')::numeric),0) END INTO fraction FROM jsonb_each(live_dates) e(id,v);
   target:=round(native*coalesce(fraction,0),2);IF target<=0 THEN CONTINUE;END IF;
   ccy:=trim(CASE WHEN k='assignment_cost' THEN coalesce(nullif(r.cost_received_currency,''),r.currency_code) ELSE r.currency_code END);
   IF NOT(ccy=ANY(c.currencies)) THEN RAISE EXCEPTION 'Enable % for %',ccy,r.document_number;END IF;
   IF k IN('assignment_cost','usage_rights_cost') THEN
    SELECT coalesce(sum(a.amount*resolve_effective_exchange_rate(a.currency,ccy,p_date)),0) INTO used FROM tw_accounting_cost_accruals a JOIN tw_accounting_journals j ON j.id=a.journal_id LEFT JOIN tw_accounting_monthly_accruals b ON b.id=a.monthly_id WHERE a.company_id=p_company AND a.assignment_line_id=r.id AND a.component=k AND j.status='posted' AND b.reversal_id IS NULL;
    SELECT coalesce(sum(z.net*resolve_effective_exchange_rate(z.currency,ccy,z.document_date)),0) INTO actual FROM tw_accounting_cost_invoices z WHERE z.company_id=p_company AND z.assignment_line_id=r.id AND z.status IN('internal','supplier');
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
END $$;

CREATE FUNCTION tw_accounting_monthly_post(p_company uuid,p_run uuid,p_month date,p_date date,p_token text,p_assignments uuid[] DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE plan jsonb;x jsonb;j uuid:=gen_random_uuid();existing tw_accounting_monthly_accruals%ROWTYPE;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO existing FROM tw_accounting_monthly_accruals WHERE id=p_run;
 IF FOUND THEN
  IF existing.company_id<>p_company OR existing.month<>p_month OR existing.posting_date<>p_date THEN RAISE EXCEPTION 'Review request does not match this batch';END IF;
  RETURN existing.journal_id;
 END IF;
 plan:=tw_accounting_monthly_plan(p_company,p_month,p_date,p_assignments);
 PERFORM pg_advisory_xact_lock(hashtextextended(l.id::text,0)) FROM campaign_lines l WHERE l.id IN(SELECT (v->>'assignment')::uuid FROM jsonb_array_elements(plan->'items') v) ORDER BY l.id;
 PERFORM 1 FROM campaign_lines l WHERE l.id IN(SELECT (v->>'assignment')::uuid FROM jsonb_array_elements(plan->'items') v) FOR SHARE;
 PERFORM 1 FROM assignment_deliverables d WHERE d.campaign_line_id IN(SELECT (v->>'assignment')::uuid FROM jsonb_array_elements(plan->'items') v) FOR SHARE;
 PERFORM 1 FROM assignment_post_schedule s WHERE s.campaign_line_id IN(SELECT (v->>'assignment')::uuid FROM jsonb_array_elements(plan->'items') v) FOR SHARE;
 plan:=tw_accounting_monthly_plan(p_company,p_month,p_date,p_assignments);
 IF p_token IS NULL OR p_token IS DISTINCT FROM plan->>'token' THEN RAISE EXCEPTION 'Live ads, amounts, mappings or rates changed. Review again.' USING ERRCODE='40001';END IF;
 IF jsonb_array_length(plan->'items')=0 THEN RAISE EXCEPTION 'No remaining live-ad accruals';END IF;
 IF jsonb_array_length(plan->'items')>5000 THEN RAISE EXCEPTION 'Monthly accrual exceeds 5,000 components';END IF;
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,activation_date,reference,memo,created_by,automatic_source,transaction_currency,exchange_rate,exchange_rate_date)
 VALUES(j,p_company,p_date,p_date,'Monthly accrual '||to_char(p_month,'YYYY-MM'),'Live-ad accrual · '||to_char(p_month,'YYYY-MM'),auth.uid(),'monthly_accrual',plan->>'base',1,p_date);
 INSERT INTO tw_accounting_monthly_accruals(id,company_id,month,posting_date,journal_id,plan,created_by) VALUES(p_run,p_company,p_month,p_date,j,plan,auth.uid());
 FOR x IN SELECT value FROM jsonb_array_elements(plan->'items') LOOP
  PERFORM tw_accounting_monthly_pair(j,x,false,'Monthly net accrual');
  IF x->>'component' IN('assignment_cost','usage_rights_cost') THEN
   INSERT INTO tw_accounting_cost_accruals(company_id,monthly_id,journal_id,assignment_line_id,component,currency,amount,base_amount,expense_account,auxiliary_id,liability_account,source)
   VALUES(p_company,p_run,j,(x->>'assignment')::uuid,x->>'component',x->>'currency',(x->>'amount')::numeric,(x->>'baseAmount')::numeric,x->>'account',nullif(x->>'auxiliary','')::uuid,x->>'counter',x);
  ELSE
   INSERT INTO tw_accounting_monthly_revenue(run_id,company_id,assignment_id,component,currency,amount,base_amount,source) VALUES(p_run,p_company,(x->>'assignment')::uuid,x->>'component',x->>'currency',(x->>'amount')::numeric,(x->>'baseAmount')::numeric,x);
  END IF;
 END LOOP;
 UPDATE tw_accounting_journals SET posting_mapping=plan WHERE id=j;
 PERFORM tw_accounting_finish_receipt_journal(j);
 RETURN j;
END $$;

CREATE FUNCTION tw_accounting_monthly_revenue_plan(p_invoice uuid,p_company uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;parts jsonb;key text;remaining numeric;used numeric;usedbase numeric;take numeric;booked numeric;result jsonb:='[]';consumed jsonb:='{}';
BEGIN
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_monthly_revenue a JOIN tw_accounting_monthly_accruals b ON b.id=a.run_id WHERE a.company_id=p_company AND b.reversal_id IS NULL AND a.assignment_id IN(SELECT campaign_line_id FROM invoice_line_items WHERE invoice_id=p_invoice)) THEN RETURN result;END IF;
 parts:=tw_accounting_invoice_native_parts(p_invoice);
 FOR r IN SELECT a.* FROM tw_accounting_monthly_revenue a JOIN tw_accounting_monthly_accruals b ON b.id=a.run_id WHERE a.company_id=p_company AND b.reversal_id IS NULL ORDER BY b.posting_date,a.id LOOP
  key:=r.assignment_id::text||':'||r.component;remaining:=coalesce((parts->>key)::numeric,0)-coalesce((consumed->>key)::numeric,0);IF remaining<=0 THEN CONTINUE;END IF;
  IF r.currency IS DISTINCT FROM (SELECT trim(currency_code) FROM campaign_lines WHERE id=r.assignment_id) THEN RAISE EXCEPTION 'Assignment currency changed since monthly accrual. Reverse the accrual before posting.';END IF;
  SELECT coalesce(sum(c.amount),0),coalesce(sum(c.base_amount),0) INTO used,usedbase FROM tw_accounting_monthly_revenue_clearings c JOIN tw_accounting_journals j ON j.id=c.journal_id WHERE c.accrual_id=r.id AND j.status='posted' AND c.invoice_id<>p_invoice;
  take:=least(round(remaining,2),r.amount-used);IF take<=0 THEN CONTINUE;END IF;
  booked:=CASE WHEN used+take=r.amount THEN r.base_amount-usedbase ELSE round(r.base_amount*(used+take)/r.amount,2)-usedbase END;
  IF booked<=0 THEN RAISE EXCEPTION 'Partial accrual release is below one local-currency cent';END IF;
  result:=result||jsonb_build_array(r.source||jsonb_build_object('accrual',r.id,'amount',take::text,'baseAmount',booked::text));
  consumed:=jsonb_set(consumed,ARRAY[key],to_jsonb(coalesce((consumed->>key)::numeric,0)+take));
 END LOOP;
 RETURN result;
END $$;

CREATE FUNCTION tw_accounting_monthly_revenue_apply(p_invoice uuid,p_company uuid,p_journal uuid,p_plan jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE x jsonb;BEGIN
 DELETE FROM tw_accounting_monthly_revenue_clearings WHERE invoice_id=p_invoice AND journal_id=p_journal;
 FOR x IN SELECT value FROM jsonb_array_elements(p_plan) LOOP
  PERFORM tw_accounting_monthly_pair(p_journal,x,true,'Release unbilled revenue · '||(SELECT document_number FROM invoices WHERE id=p_invoice));
  INSERT INTO tw_accounting_monthly_revenue_clearings VALUES((x->>'accrual')::uuid,p_invoice,p_journal,(x->>'amount')::numeric,(x->>'baseAmount')::numeric);
 END LOOP;
END $$;

CREATE FUNCTION tw_accounting_monthly_reversal_plan(p_company uuid,p_run uuid,p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE b tw_accounting_monthly_accruals%ROWTYPE;r record;used numeric;usedbase numeric;result jsonb:='[]';
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 SELECT * INTO STRICT b FROM tw_accounting_monthly_accruals WHERE id=p_run AND company_id=p_company;
 IF p_date IS NULL OR p_date<b.posting_date OR p_date>(now() AT TIME ZONE 'Africa/Cairo')::date THEN RAISE EXCEPTION 'Choose a reversal date on or after the original posting';END IF;
 IF b.reversal_id IS NOT NULL THEN RAISE EXCEPTION 'This monthly accrual has already been reversed';END IF;
 FOR r IN SELECT id,amount,base_amount,source,false cost FROM tw_accounting_monthly_revenue WHERE run_id=p_run UNION ALL SELECT id,amount,base_amount,source,true FROM tw_accounting_cost_accruals WHERE monthly_id=p_run LOOP
  IF r.cost THEN SELECT coalesce(sum(c.amount),0),coalesce(sum(c.base_amount),0) INTO used,usedbase FROM tw_accounting_accrual_clearings c JOIN tw_accounting_journals j ON j.id=c.journal_id WHERE c.accrual_id=r.id AND j.status='posted';
  ELSE SELECT coalesce(sum(c.amount),0),coalesce(sum(c.base_amount),0) INTO used,usedbase FROM tw_accounting_monthly_revenue_clearings c JOIN tw_accounting_journals j ON j.id=c.journal_id WHERE c.accrual_id=r.id AND j.status='posted';END IF;
  IF r.amount>used THEN result:=result||jsonb_build_array(r.source||jsonb_build_object('amount',(r.amount-used)::text,'baseAmount',(r.base_amount-usedbase)::text));END IF;
 END LOOP;
 RETURN jsonb_build_object('items',result,'date',p_date,'base',b.plan->>'base','token',md5(result::text||p_date::text||p_run::text));
END $$;

CREATE FUNCTION tw_accounting_monthly_reverse(p_company uuid,p_run uuid,p_date date,p_token text,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b tw_accounting_monthly_accruals%ROWTYPE;plan jsonb;x jsonb;j uuid:=gen_random_uuid();original tw_accounting_journals%ROWTYPE;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO STRICT b FROM tw_accounting_monthly_accruals WHERE id=p_run AND company_id=p_company FOR UPDATE;
 IF b.reversal_id IS NOT NULL THEN RETURN b.reversal_id;END IF;
 SELECT * INTO STRICT original FROM tw_accounting_journals WHERE id=b.journal_id;
 IF original.control_locked THEN RAISE EXCEPTION 'Unlock the accrual JV before reversal';END IF;
 IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Enter a reversal reason';END IF;
 plan:=tw_accounting_monthly_reversal_plan(p_company,p_run,p_date);
 IF p_token IS NULL OR p_token IS DISTINCT FROM plan->>'token' THEN RAISE EXCEPTION 'Accrual clearing changed. Review reversal again.' USING ERRCODE='40001';END IF;
 IF jsonb_array_length(plan->'items')=0 THEN RAISE EXCEPTION 'Accrual is fully cleared by actual invoices; nothing remains to reverse';END IF;
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,activation_date,reference,memo,created_by,automatic_source,transaction_currency,exchange_rate,exchange_rate_date,reversal_of,reversal_reason)
 VALUES(j,p_company,p_date,p_date,original.voucher_number,'Reverse remaining monthly accrual · '||to_char(b.month,'YYYY-MM')||' · '||left(p_reason,500),auth.uid(),'monthly_accrual_reversal',plan->>'base',1,p_date,original.id,p_reason);
 FOR x IN SELECT value FROM jsonb_array_elements(plan->'items') LOOP PERFORM tw_accounting_monthly_pair(j,x,true,'Reverse remaining accrual');END LOOP;
 PERFORM tw_accounting_finish_receipt_journal(j);
 UPDATE tw_accounting_monthly_accruals SET reversal_id=j WHERE id=p_run;
 RETURN j;
END $$;

-- A released estimate cannot be resurrected by unposting an actual invoice
-- after its remaining estimate was reversed. The dependency is explicit.
CREATE FUNCTION tw_accounting_monthly_dependency_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF OLD.status='posted' AND NEW.status<>'posted' AND (
  EXISTS(SELECT 1 FROM tw_accounting_monthly_revenue_clearings c JOIN tw_accounting_monthly_revenue a ON a.id=c.accrual_id JOIN tw_accounting_monthly_accruals b ON b.id=a.run_id WHERE c.journal_id=OLD.id AND b.reversal_id IS NOT NULL) OR
  EXISTS(SELECT 1 FROM tw_accounting_accrual_clearings c JOIN tw_accounting_monthly_accruals b ON b.id=(SELECT monthly_id FROM tw_accounting_cost_accruals WHERE id=c.accrual_id) WHERE c.journal_id=OLD.id AND b.reversal_id IS NOT NULL)) THEN RAISE EXCEPTION 'This invoice cleared a monthly accrual whose remainder was reversed. Use a linked credit/debit note for the correction.';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tw_monthly_dependencies BEFORE UPDATE ON tw_accounting_journals FOR EACH ROW EXECUTE FUNCTION tw_accounting_monthly_dependency_guard();

CREATE FUNCTION tw_accounting_monthly_cost_plan(p_company uuid,p_invoice uuid,p_assignment uuid,p_component text,p_amount numeric) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;used numeric;usedbase numeric;take numeric;booked numeric;remaining numeric:=p_amount;result jsonb:='[]';
BEGIN
 FOR r IN SELECT a.* FROM tw_accounting_cost_accruals a JOIN tw_accounting_monthly_accruals b ON b.id=a.monthly_id WHERE a.company_id=p_company AND a.assignment_line_id=p_assignment AND a.component=p_component AND b.reversal_id IS NULL ORDER BY b.posting_date,a.id LOOP
  SELECT coalesce(sum(c.amount),0),coalesce(sum(c.base_amount),0) INTO used,usedbase FROM tw_accounting_accrual_clearings c JOIN tw_accounting_journals j ON j.id=c.journal_id WHERE c.accrual_id=r.id AND j.status='posted';
  take:=least(remaining,r.amount-used);IF take<=0 THEN CONTINUE;END IF;
  booked:=CASE WHEN take=r.amount-used THEN r.base_amount-usedbase ELSE round((r.base_amount-usedbase)*take/(r.amount-used),2) END;
  IF booked<=0 THEN RAISE EXCEPTION 'Monthly cost transfer is below one local-currency cent';END IF;
  result:=result||jsonb_build_array(r.source||jsonb_build_object('accrual',r.id,'amount',take::text,'baseAmount',booked::text));remaining:=remaining-take;EXIT WHEN remaining=0;
 END LOOP;
 RETURN result;
END $$;
CREATE FUNCTION tw_accounting_monthly_cost_apply(p_invoice uuid,p_journal uuid,p_plan jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE x jsonb;BEGIN
 FOR x IN SELECT value FROM jsonb_array_elements(p_plan) LOOP
  PERFORM tw_accounting_monthly_pair(p_journal,x,true,'Transfer monthly estimate to invoice accrual');
  UPDATE tw_accounting_cost_accruals SET amount=amount-(x->>'amount')::numeric,base_amount=base_amount-(x->>'baseAmount')::numeric WHERE id=(x->>'accrual')::uuid;
  INSERT INTO tw_accounting_monthly_cost_transfers VALUES((x->>'accrual')::uuid,p_invoice,p_journal,(x->>'amount')::numeric,(x->>'baseAmount')::numeric);
 END LOOP;
END $$;
CREATE FUNCTION tw_accounting_monthly_transfer_restore() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;BEGIN
 IF OLD.status='posted' AND NEW.status<>'posted' THEN
  FOR r IN SELECT c.*,b.reversal_id FROM tw_accounting_monthly_cost_transfers c JOIN tw_accounting_cost_accruals a ON a.id=c.accrual_id JOIN tw_accounting_monthly_accruals b ON b.id=a.monthly_id WHERE c.journal_id=OLD.id LOOP
   IF r.reversal_id IS NOT NULL THEN RAISE EXCEPTION 'Monthly remainder was reversed; use a linked credit/debit note to correct this invoice';END IF;
   UPDATE tw_accounting_cost_accruals SET amount=amount+r.amount,base_amount=base_amount+r.base_amount WHERE id=r.accrual_id;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tw_monthly_restore BEFORE UPDATE ON tw_accounting_journals FOR EACH ROW EXECUTE FUNCTION tw_accounting_monthly_transfer_restore();

DO $patch$ DECLARE body text;needle text;BEGIN
 SELECT pg_get_functiondef('tw_accounting_invoice_mapping_preview(uuid,uuid,text,text,text)'::regprocedure) INTO body;
 needle:='''costAccruals'',tw_accounting_invoice_accrual_plan(p_invoice,p_company)';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected invoice preview';END IF;
 EXECUTE replace(body,needle,needle||',''monthlyRevenueClearings'',tw_accounting_monthly_revenue_plan(p_invoice,p_company)');
 SELECT pg_get_functiondef('tw_accounting_post_mapped_invoice(uuid,uuid,integer,date,text,text,text,numeric,jsonb,jsonb)'::regprocedure) INTO body;
 needle:='PERFORM tw_accounting_apply_invoice_accrual(p_invoice,p_company,jid,plan->''costAccruals'');';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected invoice post';END IF;
 EXECUTE replace(body,needle,needle||' PERFORM tw_accounting_monthly_revenue_apply(p_invoice,p_company,jid,plan->''monthlyRevenueClearings'');');
 SELECT pg_get_functiondef('tw_accounting_clear_cost_accrual(uuid,uuid,numeric)'::regprocedure) INTO body;
 needle:='AND j.status=''posted'' ORDER BY j.entry_date,a.invoice_id,a.component';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected cost accrual clearing';END IF;
 body:=replace(body,needle,'AND j.status=''posted'' AND NOT EXISTS(SELECT 1 FROM tw_accounting_monthly_accruals b WHERE b.id=a.monthly_id AND b.reversal_id IS NOT NULL) ORDER BY (a.monthly_id IS NOT NULL),j.entry_date,a.invoice_id,a.component');
 body:=replace(body,'(SELECT document_number FROM invoices WHERE id=r.invoice_id)','coalesce((SELECT document_number FROM invoices WHERE id=r.invoice_id),''monthly ''||(SELECT voucher_number FROM tw_accounting_journals WHERE id=r.journal_id))');
 EXECUTE body;
 SELECT pg_get_functiondef('tw_accounting_invoice_accrual_plan(uuid,uuid)'::regprocedure) INTO body;
 body:=replace(body,'prior_component_coverage numeric;','prior_component_coverage numeric; monthly_coverage numeric;');
 needle:='amount:=round(amount-coverage,2);';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected invoice accrual coverage';END IF;
 body:=replace(body,needle,needle||$coverage$
  item:=item||jsonb_build_object('monthlyTransfers',tw_accounting_monthly_cost_plan(p_company,p_invoice,(item->>'assignment')::uuid,item->>'component',amount));
  SELECT coalesce(sum((v->>'amount')::numeric),0) INTO monthly_coverage FROM jsonb_array_elements(item->'monthlyTransfers') v;
  amount:=amount-monthly_coverage;item:=item||jsonb_build_object('monthlyCoverage',monthly_coverage::text);
 $coverage$);
 body:=replace(body,'a.invoice_id<>p_invoice','a.invoice_id IS DISTINCT FROM p_invoice');
 -- Every reference to an accrual journal excludes a reversed monthly estimate.
 body:=replace(body,'a.component=item->>''component'' AND','a.component=item->>''component'' AND NOT EXISTS(SELECT 1 FROM tw_accounting_monthly_accruals b WHERE b.id=a.monthly_id AND b.reversal_id IS NOT NULL) AND');
 body:=replace(body,'WHERE a.company_id=p_company AND a.assignment_line_id=','WHERE NOT EXISTS(SELECT 1 FROM tw_accounting_monthly_accruals b WHERE b.id=a.monthly_id AND b.reversal_id IS NOT NULL) AND a.company_id=p_company AND a.assignment_line_id=');
 EXECUTE body;
 SELECT pg_get_functiondef('tw_accounting_apply_invoice_accrual(uuid,uuid,uuid,jsonb)'::regprocedure) INTO body;
 body:=replace(body,'SELECT coalesce(max(line_number),0) INTO n FROM tw_accounting_journal_lines WHERE journal_id=p_journal;','DELETE FROM tw_accounting_monthly_cost_transfers WHERE invoice_id=p_invoice AND journal_id=p_journal; SELECT coalesce(max(line_number),0) INTO n FROM tw_accounting_journal_lines WHERE journal_id=p_journal;');
 needle:='a:=(x->>''amount'')::numeric;b:=(x->>''baseAmount'')::numeric;IF a=0 THEN CONTINUE;END IF;';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected invoice accrual amount';END IF;
 body:=replace(body,needle,$transfer$
  PERFORM tw_accounting_monthly_cost_apply(p_invoice,p_journal,coalesce(x->'monthlyTransfers','[]'));
  a:=(x->>'amount')::numeric+coalesce((x->>'monthlyCoverage')::numeric,0);
  b:=(x->>'baseAmount')::numeric+coalesce((SELECT sum((t->>'baseAmount')::numeric) FROM jsonb_array_elements(coalesce(x->'monthlyTransfers','[]')) t),0);
  IF a=0 THEN CONTINUE;END IF;
  IF coalesce((x->>'monthlyCoverage')::numeric,0)>0 THEN x:=x||jsonb_build_object('rate',(b/a)::text);END IF;
  SELECT coalesce(max(line_number),0) INTO n FROM tw_accounting_journal_lines WHERE journal_id=p_journal;
 $transfer$);
 body:=replace(body,'WHERE z.company_id=p_company AND','WHERE NOT EXISTS(SELECT 1 FROM tw_accounting_monthly_accruals b WHERE b.id=z.monthly_id AND b.reversal_id IS NOT NULL) AND z.company_id=p_company AND');EXECUTE body;
END $patch$;
DO $$ DECLARE f record;BEGIN
 FOR f IN SELECT oid::regprocedure signature,proname FROM pg_proc WHERE pronamespace='public'::regnamespace AND (proname LIKE 'tw_accounting_monthly_%' OR proname='tw_accounting_invoice_native_parts') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,service_role',f.signature);
  IF f.proname IN('tw_accounting_monthly_plan','tw_accounting_monthly_post','tw_accounting_monthly_reversal_plan','tw_accounting_monthly_reverse') THEN EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',f.signature);END IF;
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
