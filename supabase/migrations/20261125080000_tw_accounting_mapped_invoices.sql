BEGIN;
ALTER TABLE tw_accounting_journals ADD COLUMN posting_mapping jsonb;
CREATE FUNCTION tw_accounting_invoice_components(p_invoice uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r record;parts jsonb;w numeric;rev numeric;ur numeric;af numeric;v numeric;u numeric;f numeric;total numeric:=0;rv numeric:=0;uv numeric:=0;fv numeric:=0;combined boolean:=false;net numeric;
BEGIN
 SELECT subtotal INTO net FROM invoices WHERE id=p_invoice;
 FOR r IN SELECT revenue_before_vat,metadata FROM invoice_line_items WHERE invoice_id=p_invoice LOOP
  v:=round(coalesce(r.revenue_before_vat,0),2);IF v<0 THEN RAISE EXCEPTION 'Invoice component amount cannot be negative';END IF;
  parts:=r.metadata->'accounting_components';
  IF parts IS NULL THEN rev:=v;ur:=0;af:=0;combined:=true;
  ELSE
   rev:=coalesce((parts->>'assignment_revenue')::numeric,0);ur:=coalesce((parts->>'usage_rights_revenue')::numeric,0);af:=coalesce((parts->>'agency_fee')::numeric,0);w:=rev+ur+af;
   IF least(rev,ur,af)<0 OR w<=0 THEN RAISE EXCEPTION 'Invalid saved invoice component breakdown';END IF;
   u:=round(v*(rev+ur)/w,2);rev:=round(v*rev/w,2);ur:=u-rev;af:=v-u;
  END IF;
  total:=total+v;rv:=rv+rev;uv:=uv+ur;fv:=fv+af;
 END LOOP;
 IF total=0 THEN rv:=net;combined:=true;ELSIF total<>net THEN RAISE EXCEPTION 'Invoice line totals do not match the invoice subtotal';END IF;
 RETURN jsonb_build_object('assignment_revenue',rv::text,'usage_rights_revenue',uv::text,'agency_fee',fv::text,'combined_legacy',combined);
END $$;
REVOKE ALL ON FUNCTION tw_accounting_invoice_components(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION tw_accounting_invoice_mapping_preview(p_invoice uuid,p_company uuid,p_receivable text,p_revenue text,p_vat text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE i invoices%ROWTYPE;a tw_accounting_accounts%ROWTYPE;parts jsonb;maps jsonb;mapping jsonb;lines jsonb:='[]';key text;mapped_code text;amount numeric;running numeric:=0;previous_local numeric:=0;lc numeric;rate numeric;base text;label text;aux jsonb:='{}';
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 SELECT * INTO i FROM invoices WHERE id=p_invoice;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_invoice_submissions WHERE invoice_id=p_invoice AND company_id=p_company) THEN RAISE EXCEPTION 'Invoice is not submitted to this company';END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE id=p_company;
 rate:=resolve_effective_exchange_rate(trim(i.currency),base,i.issue_date);parts:=tw_accounting_invoice_components(p_invoice);maps:=tw_accounting_mappings_read(p_company);
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_receivable;
 IF NOT FOUND OR NOT a.active OR a.kind<>'Control' OR a.subledger<>'Customer' OR a.account_type<>'Asset' OR a.normal_balance<>'Debit' OR a.client_id IS NOT NULL AND a.client_id<>i.client_id THEN RAISE EXCEPTION 'Choose the client receivable account';END IF;
 lines:=lines||jsonb_build_array(jsonb_build_object('account',a.code,'description','Client receivable','foreignDebit',i.total::text,'foreignCredit','0','debit',(round(i.subtotal*rate,2)+round(i.tax_amount*rate,2))::text,'credit','0'));
 FOREACH key IN ARRAY ARRAY['assignment_revenue','usage_rights_revenue','agency_fee'] LOOP
  amount:=(parts->>key)::numeric;IF amount=0 THEN CONTINUE;END IF;
  SELECT x INTO mapping FROM jsonb_array_elements(maps)x WHERE x->>'key'=key;
  mapped_code:=CASE WHEN key='assignment_revenue' THEN p_revenue ELSE mapping->>'account' END;
  SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=mapped_code;
  IF NOT FOUND OR NOT a.active OR a.kind<>'Posting' OR a.account_type<>'Revenue' OR a.normal_balance<>'Credit' THEN RAISE EXCEPTION 'Configure an active revenue account for % in System Mapping',key;END IF;
  running:=running+amount;lc:=round(running*rate,2)-previous_local;previous_local:=previous_local+lc;
  IF lc<=0 THEN RAISE EXCEPTION 'Converted component is below one local-currency cent';END IF;
  label:=mapping->>'media_label';IF key='assignment_revenue' AND (parts->>'combined_legacy')::boolean THEN label:='Combined invoice revenue · legacy breakdown unavailable';END IF;
  lines:=lines||jsonb_build_array(jsonb_build_object('account',mapped_code,'description',label,'foreignDebit','0','foreignCredit',amount::text,'debit','0','credit',lc::text));
  IF mapped_code=mapping->>'account' AND mapping->>'auxiliary_id' IS NOT NULL THEN aux:=aux||jsonb_build_object(mapped_code,mapping->>'auxiliary_id');END IF;
 END LOOP;
 IF i.tax_amount>0 THEN
  SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_vat;
  IF NOT FOUND OR NOT a.active OR a.kind<>'Posting' OR a.account_type<>'Liability' OR a.normal_balance<>'Credit' THEN RAISE EXCEPTION 'Configure Output VAT in System Mapping';END IF;
  lines:=lines||jsonb_build_array(jsonb_build_object('account',a.code,'description','Invoice output VAT','foreignDebit','0','foreignCredit',i.tax_amount::text,'debit','0','credit',round(i.tax_amount*rate,2)::text));
 END IF;
 RETURN jsonb_build_object('lines',lines,'date',i.issue_date,'rate',rate::text,'base',base,'currency',trim(i.currency),'components',parts,'auxiliaries',aux,'mappings',maps);
END $$;
REVOKE ALL ON FUNCTION tw_accounting_invoice_mapping_preview(uuid,uuid,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_invoice_mapping_preview(uuid,uuid,text,text,text) TO authenticated;
-- The mapped posting function is appended below from the validated invoice lifecycle.

CREATE OR REPLACE FUNCTION public.tw_accounting_post_mapped_invoice(p_invoice uuid,p_company uuid,p_version integer,p_date date,p_receivable text,p_revenue text,p_vat text,p_expected_rate numeric,p_expected_plan jsonb,p_auxiliaries jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE plan jsonb;l jsonb;n integer:=1; s tw_accounting_invoice_submissions%ROWTYPE; i invoices%ROWTYPE; a tw_accounting_accounts%ROWTYPE;
 jid uuid:=gen_random_uuid(); fiscal integer; seq bigint; base text; rate numeric; local_net numeric; local_tax numeric; existing tw_accounting_journals%ROWTYPE;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM invoices WHERE id=p_invoice FOR UPDATE;
 SELECT * INTO s FROM tw_accounting_invoice_submissions WHERE invoice_id=p_invoice FOR UPDATE;
 IF NOT FOUND OR s.company_id<>p_company THEN RAISE EXCEPTION 'Submission not found in this company'; END IF;
 IF s.status='posted' THEN RETURN s.journal_id; END IF;
 IF s.status<>'submitted' OR p_version IS NULL OR p_version<>s.version THEN RAISE EXCEPTION 'Submission changed. Reload before posting.' USING ERRCODE='40001'; END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 IF tw_accounting_invoice_snapshot(i) IS DISTINCT FROM s.source OR i.status::text='void' OR i.regeneration_status::text IS DISTINCT FROM 'active'
 THEN RAISE EXCEPTION 'Source invoice changed or is unavailable. Withdraw and review it in Media.'; END IF;
 rate:=resolve_effective_exchange_rate(trim(i.currency),base,i.issue_date);
 IF p_expected_rate IS NOT NULL AND p_expected_rate IS DISTINCT FROM rate THEN RAISE EXCEPTION 'Exchange rate changed. Reload the invoice preview.' USING ERRCODE='40001'; END IF;
 plan:=tw_accounting_invoice_mapping_preview(p_invoice,p_company,p_receivable,p_revenue,p_vat);
 IF p_expected_plan IS NULL OR plan IS DISTINCT FROM p_expected_plan THEN RAISE EXCEPTION 'System mapping or invoice components changed. Reload the posting preview.' USING ERRCODE='40001';END IF;
 PERFORM set_config('tw.accounting_auxiliaries',(coalesce(plan->'auxiliaries','{}')||coalesce(p_auxiliaries,'{}'))::text,true);
 local_net:=round(i.subtotal*rate,2); local_tax:=round(i.tax_amount*rate,2);
 IF local_net<=0 OR (i.tax_amount>0 AND local_tax<=0) THEN RAISE EXCEPTION 'Converted invoice line is below one base-currency cent'; END IF;
 SELECT extract(year FROM y.start_date)::integer INTO fiscal FROM tw_accounting_years y JOIN tw_accounting_periods p ON p.year_id=y.id
 WHERE y.company_id=p_company AND p_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed;
 IF fiscal IS NULL OR p_date<i.issue_date THEN RAISE EXCEPTION 'Choose an open posting date on or after the invoice date'; END IF;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_receivable;
 IF NOT FOUND OR NOT a.active OR a.kind<>'Control' OR a.subledger<>'Customer' OR a.account_type<>'Asset' OR a.normal_balance<>'Debit'
 THEN RAISE EXCEPTION 'Select an active customer receivable control account'; END IF;
 IF s.journal_id IS NOT NULL THEN
  SELECT * INTO existing FROM tw_accounting_journals WHERE id=s.journal_id FOR UPDATE;
  IF existing.status<>'pending' OR existing.company_id<>p_company OR existing.source_invoice_id<>i.id THEN RAISE EXCEPTION 'Original journal is not pending'; END IF;
  IF NOT EXISTS(SELECT 1 FROM tw_accounting_periods p JOIN tw_accounting_years y ON y.id=p.year_id WHERE y.company_id=p_company AND existing.entry_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed)
  THEN RAISE EXCEPTION 'The original posting period is closed'; END IF;
  IF split_part(existing.voucher_number,'-',2)::integer<>fiscal THEN RAISE EXCEPTION 'Repost within the original fiscal year to retain the voucher number'; END IF;
  jid:=existing.id;
  INSERT INTO tw_accounting_audit(actor_id,table_name,operation,before_data,after_data)
   SELECT auth.uid(),'tw_accounting_journal_lines','REPLACE_PENDING',jsonb_build_object('journal_id',jid,'lines',jsonb_agg(to_jsonb(l))),jsonb_build_object('journal_id',jid) FROM tw_accounting_journal_lines l WHERE journal_id=jid;
  DELETE FROM tw_accounting_journal_lines WHERE journal_id=jid;
  UPDATE tw_accounting_journals SET entry_date=p_date,transaction_currency=trim(i.currency),exchange_rate=rate,exchange_rate_date=i.issue_date WHERE id=jid;
 ELSE
  INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,source_invoice_id,transaction_currency,exchange_rate,exchange_rate_date)
  VALUES(jid,p_company,p_date,left(i.document_number,120),'Invoice '||i.document_number||' · '||left(s.client_name,500),auth.uid(),i.id,trim(i.currency),rate,i.issue_date);
 END IF;
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,client_id,client_code,foreign_debit,foreign_credit)
 VALUES(jid,1,p_company,a.code,a.name,left(s.client_code||' · '||s.client_name,500),local_net+local_tax,0,s.client_id,s.client_code,i.total,0);
 FOR l IN SELECT value FROM jsonb_array_elements(plan->'lines') WITH ORDINALITY WHERE ordinality>1 LOOP
 n:=n+1;SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=l->>'account';
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit) VALUES(jid,n,p_company,a.code,a.name,l->>'description',0,(l->>'credit')::numeric,0,(l->>'foreignCredit')::numeric);
 END LOOP;
 UPDATE tw_accounting_journals SET posting_mapping=plan WHERE id=jid;
 IF (SELECT sum(debit-credit) FROM tw_accounting_journal_lines WHERE journal_id=jid)<>0 THEN RAISE EXCEPTION 'Invoice journal does not balance'; END IF;
 IF s.journal_id IS NULL THEN
 INSERT INTO tw_accounting_journal_sequences(company_id,fiscal_year,last_number) VALUES(p_company,fiscal,1)
 ON CONFLICT(company_id,fiscal_year) DO UPDATE SET last_number=tw_accounting_journal_sequences.last_number+1 RETURNING last_number INTO seq;
 UPDATE tw_accounting_journals SET status='posted',voucher_number='JV-'||fiscal||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0'),posted_by=auth.uid(),posted_at=now(),version=version+1 WHERE id=jid;
 ELSE
 UPDATE tw_accounting_journals SET status='posted',posted_by=auth.uid(),posted_at=now(),updated_at=now(),version=version+1 WHERE id=jid;
 END IF;
 UPDATE tw_accounting_invoice_submissions SET status='posted',journal_id=jid,version=version+1 WHERE invoice_id=p_invoice;
 PERFORM set_config('tw.accounting_auxiliaries','{}',true);
 RETURN jid;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_post_mapped_invoice(uuid,uuid,integer,date,text,text,text,numeric,jsonb,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_post_mapped_invoice(uuid,uuid,integer,date,text,text,text,numeric,jsonb,jsonb) TO authenticated;
COMMIT;
