BEGIN;
-- Accruals are estimates of NET assignment costs. Tax columns are deliberately
-- absent: input tax is recognised only by the supplier invoice posting flow.
ALTER TABLE tw_accounting_companies ADD COLUMN automatic_cost_accrual boolean NOT NULL DEFAULT false;
ALTER TABLE tw_accounting_cost_invoices ADD COLUMN assignment_line_id uuid REFERENCES campaign_lines(id);
CREATE TABLE tw_accounting_cost_accruals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),
 invoice_id uuid NOT NULL REFERENCES invoices(id),journal_id uuid NOT NULL REFERENCES tw_accounting_journals(id),
 assignment_line_id uuid NOT NULL REFERENCES campaign_lines(id),component text NOT NULL CHECK(component IN('assignment_cost','usage_rights_cost')),
 currency text NOT NULL,amount numeric(18,2) NOT NULL CHECK(amount>0),base_amount numeric(18,2) NOT NULL CHECK(base_amount>0),
 expense_account text NOT NULL,auxiliary_id uuid REFERENCES tw_accounting_auxiliaries(id),liability_account text NOT NULL,
 source jsonb NOT NULL,UNIQUE(invoice_id,assignment_line_id,component)
);
CREATE TABLE tw_accounting_accrual_clearings (
 cost_id uuid NOT NULL REFERENCES tw_accounting_cost_invoices(id),accrual_id uuid NOT NULL REFERENCES tw_accounting_cost_accruals(id),
 journal_id uuid NOT NULL REFERENCES tw_accounting_journals(id),amount numeric(18,2) NOT NULL CHECK(amount<>0),
 base_amount numeric(18,2) NOT NULL CHECK(base_amount<>0),PRIMARY KEY(cost_id,accrual_id,journal_id)
);
CREATE INDEX tw_cost_assignment ON tw_accounting_cost_invoices(company_id,assignment_line_id) WHERE assignment_line_id IS NOT NULL;
CREATE INDEX tw_accrual_assignment ON tw_accounting_cost_accruals(company_id,assignment_line_id,currency);
CREATE INDEX tw_accrual_clearing_source ON tw_accounting_accrual_clearings(accrual_id);
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['tw_accounting_cost_accruals','tw_accounting_accrual_clearings'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('GRANT SELECT ON %I TO authenticated',t);
  EXECUTE format('CREATE POLICY accounting_read ON %I FOR SELECT TO authenticated USING ((SELECT (tw_module_access()->>''accounting'')::boolean))',t);
  EXECUTE format('CREATE TRIGGER accounting_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION tw_accounting_audit_change()',t);
 END LOOP;
END $$;

CREATE FUNCTION tw_accounting_accrual_setting(p_company uuid,p_enabled boolean,p_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT tw_accounting_can_manage() OR NOT coalesce((tw_module_access()->>'admin')::boolean,false) THEN RAISE EXCEPTION 'Administrator and verified MFA required' USING ERRCODE='42501';END IF;
 UPDATE tw_accounting_companies SET automatic_cost_accrual=p_enabled,version=version+1 WHERE id=p_company AND version=p_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Company settings changed. Reload.' USING ERRCODE='40001';END IF;
END $$;

-- A frozen, reviewed plan is compared again inside the posting transaction.
-- Partial billings use the saved operational amount, before invoice-currency FX.
CREATE FUNCTION tw_accounting_invoice_accrual_plan(p_invoice uuid,p_company uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE i invoices%ROWTYPE;c tw_accounting_companies%ROWTYPE;r record;l campaign_lines%ROWTYPE;d assignment_deliverables%ROWTYPE;
 maps jsonb;m jsonb;liability text;result jsonb:='[]';parts jsonb;basis numeric;portion numeric;weight numeric;weights numeric;
 amount numeric;native numeric;rate numeric;ccy text;component text;account_row tw_accounting_accounts%ROWTYPE;details jsonb:='{}';covered jsonb:='{}';k text;item jsonb;requested numeric;recognised numeric;prior_coverage numeric;prior_component_coverage numeric;coverage numeric;used numeric;coverage_key text;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 SELECT * INTO c FROM tw_accounting_companies WHERE id=p_company;
 IF NOT c.automatic_cost_accrual THEN RETURN '[]';END IF;
 SELECT * INTO i FROM invoices WHERE id=p_invoice;
 maps:=tw_accounting_mappings_read(p_company);
 SELECT x->>'account' INTO liability FROM jsonb_array_elements(maps)x WHERE x->>'key'='accrued_cost' AND (x->>'active')::boolean;
 PERFORM tw_accounting_require_account(p_company,liability,'Posting','Liability','Credit');
 IF NOT EXISTS(SELECT 1 FROM invoice_line_items WHERE invoice_id=p_invoice) THEN RAISE EXCEPTION 'Automatic accrual needs linked assignment invoice lines';END IF;
 FOR r IN SELECT * FROM invoice_line_items WHERE invoice_id=p_invoice ORDER BY id LOOP
  SELECT * INTO l FROM campaign_lines WHERE id=r.campaign_line_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Automatic accrual needs an assignment reference for every invoice line';END IF;
  SELECT * INTO d FROM assignment_deliverables WHERE id=r.assignment_deliverable_id AND campaign_line_id=l.id;
  parts:=r.metadata->'accounting_components';
  basis:=coalesce((parts->>'assignment_revenue')::numeric,0)+coalesce((parts->>'usage_rights_revenue')::numeric,0)+coalesce((parts->>'agency_fee')::numeric,0);
  IF basis<=0 OR nullif(coalesce(r.metadata->'billing_fx'->>'source_amount',r.metadata->>'operational_source_amount'),'') IS NULL THEN
   RAISE EXCEPTION 'Invoice % lacks a frozen billing breakdown. Review/regenerate it in Media before automatic accrual.',i.document_number;
  END IF;
  portion:=(coalesce(r.metadata->'billing_fx'->>'source_amount',r.metadata->>'operational_source_amount'))::numeric/basis;
  IF portion<=0 OR portion>1.000001 THEN RAISE EXCEPTION 'Invalid partial-invoice cost proportion';END IF;
  FOREACH component IN ARRAY ARRAY['assignment_cost','usage_rights_cost'] LOOP
   native:=CASE component WHEN 'assignment_cost' THEN coalesce(l.cost_received,l.cost_before_vat,l.cost,0) ELSE coalesce(l.usage_rights_cost,0) END;
   IF native<0 THEN RAISE EXCEPTION 'Assignment net cost cannot be negative';END IF;
   weight:=1;
   IF d.id IS NOT NULL THEN
    SELECT sum(CASE component WHEN 'assignment_cost' THEN coalesce(x.cost_before_vat,0) ELSE coalesce(x.usage_rights_cost,0) END) INTO weights FROM assignment_deliverables x WHERE campaign_line_id=l.id;
    IF weights>0 THEN weight:=(CASE component WHEN 'assignment_cost' THEN coalesce(d.cost_before_vat,0) ELSE coalesce(d.usage_rights_cost,0) END)/weights;
    ELSE SELECT d.quantity::numeric/nullif(sum(x.quantity),0) INTO weight FROM assignment_deliverables x WHERE campaign_line_id=l.id;END IF;
   END IF;
   amount:=native*portion*coalesce(weight,0);IF amount=0 THEN CONTINUE;END IF;
   ccy:=trim(CASE component WHEN 'assignment_cost' THEN coalesce(nullif(l.cost_received_currency,''),l.currency_code) ELSE l.currency_code END);
   IF ccy IS NULL OR NOT(ccy=ANY(c.currencies)) THEN RAISE EXCEPTION 'Enable assignment cost currency before posting';END IF;
   k:=l.id::text||':'||component;
   item:=coalesce(details->k,'{}');
   details:=jsonb_set(details,ARRAY[k],jsonb_build_object('assignment',l.id,'reference',l.document_number,'component',component,'currency',ccy,'amount',coalesce((item->>'amount')::numeric,0)+amount,'maximum',native));
  END LOOP;
 END LOOP;
 FOR k,item IN SELECT * FROM jsonb_each(details) ORDER BY key LOOP
  amount:=round((item->>'amount')::numeric,2);IF amount=0 THEN CONTINUE;END IF;
  requested:=amount;coverage_key:=item->>'assignment';
  SELECT coalesce(sum(z.net*resolve_effective_exchange_rate(z.currency,item->>'currency',z.document_date)),0) INTO recognised FROM tw_accounting_cost_invoices z WHERE z.company_id=p_company AND z.assignment_line_id=(item->>'assignment')::uuid AND z.status IN('internal','supplier');
  SELECT recognised-coalesce(sum(x.amount*resolve_effective_exchange_rate(a.currency,item->>'currency',j.entry_date)),0) INTO recognised FROM tw_accounting_accrual_clearings x JOIN tw_accounting_cost_accruals a ON a.id=x.accrual_id JOIN tw_accounting_journals j ON j.id=x.journal_id WHERE a.company_id=p_company AND a.assignment_line_id=(item->>'assignment')::uuid AND j.status='posted';
  SELECT coalesce(sum(((v->>'requested')::numeric-(v->>'amount')::numeric)*resolve_effective_exchange_rate(v->>'currency',item->>'currency',j.entry_date)),0) INTO prior_coverage FROM tw_accounting_journals j CROSS JOIN LATERAL jsonb_array_elements(coalesce(j.posting_mapping->'costAccruals','[]')) v WHERE j.company_id=p_company AND j.status='posted' AND j.source_invoice_id IS DISTINCT FROM p_invoice AND v->>'assignment'=item->>'assignment';
  coverage:=least(amount,greatest(recognised-prior_coverage-coalesce((SELECT sum((v->>'amount')::numeric*resolve_effective_exchange_rate(v->>'currency',item->>'currency',i.issue_date)) FROM jsonb_each(covered) z(key,v) WHERE v->>'assignment'=coverage_key),0),0));
  covered:=jsonb_set(covered,ARRAY[k],jsonb_build_object('assignment',coverage_key,'currency',item->>'currency','amount',coverage));
  amount:=round(amount-coverage,2);
  SELECT coalesce(sum(a.amount),0) INTO used FROM tw_accounting_cost_accruals a JOIN tw_accounting_journals j ON j.id=a.journal_id WHERE a.company_id=p_company AND a.assignment_line_id=(item->>'assignment')::uuid AND a.component=item->>'component' AND a.invoice_id<>p_invoice AND j.status='posted';
  SELECT coalesce(sum((v->>'requested')::numeric-(v->>'amount')::numeric),0) INTO prior_component_coverage FROM tw_accounting_journals j CROSS JOIN LATERAL jsonb_array_elements(coalesce(j.posting_mapping->'costAccruals','[]')) v WHERE j.company_id=p_company AND j.status='posted' AND j.source_invoice_id IS DISTINCT FROM p_invoice AND v->>'assignment'=item->>'assignment' AND v->>'component'=item->>'component';
  amount:=least(amount,greatest(0,(item->>'maximum')::numeric-used-least(greatest(recognised,0),prior_component_coverage+coverage)));
  IF amount>(item->>'maximum')::numeric THEN RAISE EXCEPTION 'Invoice cost accrual exceeds the assignment net cost';END IF;
  SELECT x INTO m FROM jsonb_array_elements(maps)x WHERE x->>'key'=item->>'component' AND (x->>'active')::boolean;
  PERFORM tw_accounting_require_account(p_company,m->>'account','Posting','Expense','Debit');
  SELECT * INTO account_row FROM tw_accounting_accounts WHERE company_id=p_company AND code=m->>'account';
  IF account_row.has_auxiliary AND nullif(m->>'auxiliary_id','') IS NULL THEN RAISE EXCEPTION 'Configure the cost component auxiliary in System Mapping';END IF;
  rate:=resolve_effective_exchange_rate(item->>'currency',c.base_currency,i.issue_date);
  IF amount>0 AND round(amount*rate,2)<=0 THEN RAISE EXCEPTION 'Accrual is below one local-currency cent';END IF;
  result:=result||jsonb_build_array(item||jsonb_build_object('requested',requested::text,'amount',amount::text,'baseAmount',round(amount*rate,2)::text,'rate',rate::text,'expense',account_row.code,'auxiliary',m->>'auxiliary_id','liability',liability));
 END LOOP;
 RETURN result;
END $$;

CREATE FUNCTION tw_accounting_apply_invoice_accrual(p_invoice uuid,p_company uuid,p_journal uuid,p_plan jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE x jsonb;n integer;a numeric;b numeric;used numeric;BEGIN
 IF EXISTS(SELECT 1 FROM tw_accounting_cost_accruals a JOIN tw_accounting_accrual_clearings c ON c.accrual_id=a.id JOIN tw_accounting_journals j ON j.id=c.journal_id WHERE a.invoice_id=p_invoice AND j.status='posted') THEN RAISE EXCEPTION 'Unpost the linked cost invoices before revising this revenue accrual';END IF;
 DELETE FROM tw_accounting_accrual_clearings WHERE accrual_id IN(SELECT id FROM tw_accounting_cost_accruals WHERE invoice_id=p_invoice);
 DELETE FROM tw_accounting_cost_accruals WHERE invoice_id=p_invoice;
 SELECT coalesce(max(line_number),0) INTO n FROM tw_accounting_journal_lines WHERE journal_id=p_journal;
 FOR x IN SELECT value FROM jsonb_array_elements(coalesce(p_plan,'[]')) LOOP
  a:=(x->>'amount')::numeric;b:=(x->>'baseAmount')::numeric;IF a=0 THEN CONTINUE;END IF;
  SELECT coalesce(sum(z.amount),0) INTO used FROM tw_accounting_cost_accruals z JOIN tw_accounting_journals j ON j.id=z.journal_id WHERE z.company_id=p_company AND z.assignment_line_id=(x->>'assignment')::uuid AND z.component=x->>'component' AND j.status='posted';
  IF used+a>(x->>'maximum')::numeric THEN RAISE EXCEPTION 'Assignment costs already accrued by another invoice. Review the billing allocation.';END IF;
  INSERT INTO tw_accounting_cost_accruals(company_id,invoice_id,journal_id,assignment_line_id,component,currency,amount,base_amount,expense_account,auxiliary_id,liability_account,source)
  VALUES(p_company,p_invoice,p_journal,(x->>'assignment')::uuid,x->>'component',x->>'currency',a,b,x->>'expense',nullif(x->>'auxiliary','')::uuid,x->>'liability',x);
  n:=n+1;
  INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,line_currency,line_rate,auxiliary_id)
  SELECT p_journal,n,p_company,code,name,'Net cost accrual · '||(x->>'reference'),b,0,a,0,x->>'currency',(x->>'rate')::numeric,nullif(x->>'auxiliary','')::uuid FROM tw_accounting_accounts WHERE company_id=p_company AND code=x->>'expense';
  n:=n+1;
  INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,line_currency,line_rate)
  SELECT p_journal,n,p_company,code,name,'Accrued net cost · '||(x->>'reference'),0,b,0,a,x->>'currency',(x->>'rate')::numeric FROM tw_accounting_accounts WHERE company_id=p_company AND code=x->>'liability';
 END LOOP;
END $$;

-- Clearing uses the original accrual's booked rate, not today's rate. Original
-- expense recognition and its release cancel exactly, even after FX changes.
CREATE FUNCTION tw_accounting_clear_cost_accrual(p_cost uuid,p_journal uuid,p_net numeric) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c tw_accounting_cost_invoices%ROWTYPE;r record;remaining numeric;take numeric;booked numeric;n integer;used numeric;used_base numeric;cross_rate numeric;direction integer;
BEGIN
 SELECT * INTO c FROM tw_accounting_cost_invoices WHERE id=p_cost;
 IF c.assignment_line_id IS NULL OR p_net=0 THEN RETURN;END IF;
 IF NOT EXISTS(SELECT 1 FROM campaign_influencers WHERE campaign_line_id=c.assignment_line_id AND influencer_id=c.vendor_id) THEN RAISE EXCEPTION 'The cost assignment belongs to another vendor';END IF;
 remaining:=abs(p_net);direction:=CASE WHEN p_net<0 THEN -1 ELSE 1 END;
 SELECT coalesce(max(line_number),0) INTO n FROM tw_accounting_journal_lines WHERE journal_id=p_journal;
 FOR r IN SELECT a.* FROM tw_accounting_cost_accruals a JOIN tw_accounting_journals j ON j.id=a.journal_id
  WHERE a.company_id=c.company_id AND a.assignment_line_id=c.assignment_line_id AND j.status='posted' ORDER BY j.entry_date,a.invoice_id,a.component FOR UPDATE OF a LOOP
  SELECT coalesce(sum(x.amount),0),coalesce(sum(x.base_amount),0) INTO used,used_base FROM tw_accounting_accrual_clearings x JOIN tw_accounting_journals j ON j.id=x.journal_id WHERE x.accrual_id=r.id AND j.status='posted' AND (direction=1 OR x.cost_id=c.id);
  cross_rate:=resolve_effective_exchange_rate(r.currency,c.currency,c.document_date);
  take:=least(round(remaining/cross_rate,2),CASE WHEN direction=1 THEN r.amount-used ELSE used END);IF take<=0 THEN CONTINUE;END IF;
  booked:=CASE WHEN direction=-1 THEN CASE WHEN take=used THEN used_base ELSE round(used_base*take/used,2) END WHEN used+take=r.amount THEN r.base_amount-used_base ELSE round(r.base_amount*(used+take)/r.amount,2)-used_base END;
  IF booked<=0 THEN RAISE EXCEPTION 'Partial accrual clearing is below one local-currency cent';END IF;
  INSERT INTO tw_accounting_accrual_clearings VALUES(c.id,r.id,p_journal,take*direction,booked*direction);
  n:=n+1;
  INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,line_currency,line_rate)
  SELECT p_journal,n,c.company_id,code,name,left('Accrual clearing · '||c.supporting_reference||' · Invoice '||(SELECT document_number FROM invoices WHERE id=r.invoice_id),500),CASE WHEN direction=1 THEN booked ELSE 0 END,CASE WHEN direction=-1 THEN booked ELSE 0 END,CASE WHEN direction=1 THEN take ELSE 0 END,CASE WHEN direction=-1 THEN take ELSE 0 END,r.currency,(r.source->>'rate')::numeric FROM tw_accounting_accounts WHERE company_id=c.company_id AND code=r.liability_account;
  n:=n+1;
  INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,line_currency,line_rate,auxiliary_id)
  SELECT p_journal,n,c.company_id,code,name,left('Release accrued net cost · '||c.supporting_reference,500),CASE WHEN direction=-1 THEN booked ELSE 0 END,CASE WHEN direction=1 THEN booked ELSE 0 END,CASE WHEN direction=-1 THEN take ELSE 0 END,CASE WHEN direction=1 THEN take ELSE 0 END,r.currency,(r.source->>'rate')::numeric,r.auxiliary_id FROM tw_accounting_accounts WHERE company_id=c.company_id AND code=r.expense_account;
  remaining:=greatest(0,remaining-round(take*cross_rate,2));EXIT WHEN remaining=0;
 END LOOP;
END $$;

DO $patch$ DECLARE body text;needle text;BEGIN
 SELECT pg_get_functiondef('tw_accounting_invoice_mapping_preview(uuid,uuid,text,text,text)'::regprocedure) INTO body;
 needle:='''components'',parts,''auxiliaries'',aux,''mappings'',maps';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected invoice preview; stop';END IF;
 EXECUTE replace(body,needle,needle||',''costAccruals'',tw_accounting_invoice_accrual_plan(p_invoice,p_company)');
 SELECT pg_get_functiondef('tw_accounting_post_mapped_invoice(uuid,uuid,integer,date,text,text,text,numeric,jsonb,jsonb)'::regprocedure) INTO body;
 needle:='UPDATE tw_accounting_journals SET posting_mapping=plan WHERE id=jid;';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected invoice posting; stop';END IF;
 EXECUTE replace(body,needle,needle||' PERFORM tw_accounting_apply_invoice_accrual(p_invoice,p_company,jid,plan->''costAccruals'');');
 SELECT pg_get_functiondef('tw_accounting_unpost_invoice(uuid,uuid,integer,text)'::regprocedure) INTO body;
 needle:='UPDATE tw_accounting_journals SET status=''pending''';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected invoice correction; stop';END IF;
 EXECUTE replace(body,needle,'IF EXISTS(SELECT 1 FROM tw_accounting_cost_accruals a JOIN tw_accounting_accrual_clearings x ON x.accrual_id=a.id JOIN tw_accounting_journals cj ON cj.id=x.journal_id WHERE a.invoice_id=p_invoice AND cj.status=''posted'') THEN RAISE EXCEPTION ''Unpost linked cost invoices before correcting this revenue accrual'';END IF; '||needle);
 SELECT pg_get_functiondef('tw_accounting_cost_save(jsonb)'::regprocedure) INTO body;
 needle:='RETURN id;';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected cost save; stop';END IF;
 EXECUTE replace(body,needle,'IF nullif(p_value->>''assignment'','''') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM campaign_influencers WHERE campaign_line_id=(p_value->>''assignment'')::uuid AND influencer_id=v.id) THEN RAISE EXCEPTION ''Select an assignment for this vendor'';END IF; UPDATE tw_accounting_cost_invoices SET assignment_line_id=nullif(p_value->>''assignment'','''')::uuid WHERE tw_accounting_cost_invoices.id=id; '||needle);
 SELECT pg_get_functiondef('tw_accounting_cost_post(uuid,uuid,integer,numeric)'::regprocedure) INTO body;
 needle:='PERFORM tw_accounting_finish_receipt_journal(j);';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected cost posting; stop';END IF;
 EXECUTE replace(body,needle,'PERFORM tw_accounting_clear_cost_accrual(c.id,j,c.net); '||needle);
 SELECT pg_get_functiondef('tw_accounting_cost_reconcile(uuid,uuid,integer,date,text,date,numeric,numeric,text,text)'::regprocedure) INTO body;
 needle:='PERFORM tw_accounting_finish_receipt_journal(j);';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected cost reconciliation; stop';END IF;
 body:=replace(body,needle,'PERFORM tw_accounting_clear_cost_accrual(c.id,j,p_net-c.net); '||needle);
 -- Show the original cost reversal and the complete actual invoice, rather than
 -- a single unexplained net difference. The original estimate never includes VAT.
 body:=regexp_replace(body,' PERFORM tw_accounting_auto_line\(j,1,c.expense_account,''Supplier invoice cost adjustment''.*? PERFORM tw_accounting_auto_line\(j,3,c.payable_account,''Supplier invoice reconciliation''[^;]*;',
 $lines$ PERFORM tw_accounting_auto_line(j,1,c.expense_account,'Reverse original cost: '||c.number,0,c.base_net,0,c.net);
 IF c.base_tax>0 THEN PERFORM tw_accounting_auto_line(j,2,c.vat_account,'Reverse original tax: '||c.number,0,c.base_tax,0,c.tax,NULL,c.vendor_id,c.vendor_code);END IF;
 PERFORM tw_accounting_auto_line(j,3,c.payable_account,'Reverse original payable: '||c.number,c.base_net+c.base_tax,0,c.net+c.tax,0,NULL,c.vendor_id,c.vendor_code);
 PERFORM tw_accounting_auto_line(j,4,c.expense_account,'Actual supplier cost: '||p_number,round(p_net*c.exchange_rate,2),0,p_net,0);
 IF p_tax>0 THEN PERFORM tw_accounting_auto_line(j,5,p_vat,'Actual supplier VAT: '||p_number,round(p_tax*c.exchange_rate,2),0,p_tax,0,NULL,c.vendor_id,c.vendor_code);END IF;
 PERFORM tw_accounting_auto_line(j,6,c.payable_account,'Actual supplier payable: '||p_number,0,round(p_net*c.exchange_rate,2)+round(p_tax*c.exchange_rate,2),0,p_net+p_tax,NULL,c.vendor_id,c.vendor_code);$lines$,'s');
 IF position('Actual supplier cost:' IN body)=0 THEN RAISE EXCEPTION 'Unexpected cost adjustment lines; stop';END IF;
 EXECUTE body;
 SELECT pg_get_functiondef('tw_accounting_reverse_journal(uuid,uuid,uuid,date,text)'::regprocedure) INTO body;
 needle:='SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id AND company_id=p_company FOR UPDATE;';
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected journal reversal; stop';END IF;
 EXECUTE replace(body,needle,needle||' IF EXISTS(SELECT 1 FROM tw_accounting_cost_accruals WHERE journal_id=p_id) THEN RAISE EXCEPTION ''Unpost the revenue invoice to revise its tracked cost accrual'';END IF;');
END $patch$;
REVOKE ALL ON FUNCTION tw_accounting_accrual_setting(uuid,boolean,integer),tw_accounting_invoice_accrual_plan(uuid,uuid),tw_accounting_apply_invoice_accrual(uuid,uuid,uuid,jsonb),tw_accounting_clear_cost_accrual(uuid,uuid,numeric) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_accrual_setting(uuid,boolean,integer),tw_accounting_invoice_accrual_plan(uuid,uuid) TO authenticated;
CREATE FUNCTION tw_accounting_cost_assignments(p_vendor uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 RETURN (SELECT coalesce(jsonb_agg(r),'[]') FROM(SELECT DISTINCT l.id,l.document_number code,l.name FROM campaign_lines l JOIN campaign_influencers a ON a.campaign_line_id=l.id WHERE a.influencer_id=p_vendor ORDER BY l.document_number LIMIT 1000)r);
END $$;
REVOKE ALL ON FUNCTION tw_accounting_cost_assignments(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_cost_assignments(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
