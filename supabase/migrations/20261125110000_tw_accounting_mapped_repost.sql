BEGIN;
-- Disambiguate the saved line snapshot from the JSON posting-loop variable.
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
   SELECT auth.uid(),'tw_accounting_journal_lines','REPLACE_PENDING',jsonb_build_object('journal_id',jid,'lines',jsonb_agg(to_jsonb(previous_line))),jsonb_build_object('journal_id',jid) FROM tw_accounting_journal_lines previous_line WHERE journal_id=jid;
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
