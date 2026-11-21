BEGIN;
ALTER TABLE tw_accounting_journals ADD COLUMN entry_kind text NOT NULL DEFAULT 'manual' CHECK(entry_kind IN ('manual','expense'));
ALTER TABLE tw_accounting_journal_lines ADD COLUMN line_currency text,ADD COLUMN line_rate numeric(24,8),ADD COLUMN parent_account text;
CREATE FUNCTION tw_accounting_currency_rates(p_company uuid,p_date date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c tw_accounting_companies%ROWTYPE;currency text;rate numeric;result jsonb:='{}';BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM tw_accounting_companies WHERE id=p_company;IF NOT FOUND OR p_date IS NULL THEN RAISE EXCEPTION 'Company and date required'; END IF;
 FOREACH currency IN ARRAY c.currencies LOOP
 BEGIN rate:=resolve_effective_exchange_rate(currency,c.base_currency,p_date);EXCEPTION WHEN OTHERS THEN rate:=NULL;END;
 result:=result||jsonb_build_object(currency,rate::text);
 END LOOP;RETURN result;
END $$;
CREATE FUNCTION tw_accounting_save_entry(p_id uuid,p_company uuid,p_date date,p_reference text,p_memo text,p_version integer,p_kind text,p_lines jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_accounting_journals%ROWTYPE;a tw_accounting_accounts%ROWTYPE;l jsonb;c tw_accounting_companies%ROWTYPE;n integer:=0;d numeric;cr numeric;fd numeric;fc numeric;rate numeric;currency text;expense_count integer:=0;sumd numeric:=0;sumc numeric:=0;parent text;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Company unavailable'; END IF;
 IF p_kind NOT IN ('manual','expense') OR p_id IS NULL OR p_date IS NULL OR length(trim(coalesce(p_memo,''))) NOT BETWEEN 3 AND 1000 OR p_reference IS NULL OR length(p_reference)>120 OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) NOT BETWEEN 2 AND 200 THEN RAISE EXCEPTION 'Check journal date, description and lines'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_periods p JOIN tw_accounting_years y ON y.id=p.year_id WHERE y.company_id=p_company AND p_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed) THEN RAISE EXCEPTION 'Choose an open financial period'; END IF;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
 IF j.company_id<>p_company OR j.status<>'draft' OR j.source_invoice_id IS NOT NULL OR j.source_payment_id IS NOT NULL OR j.automatic_source IS NOT NULL OR j.reversal_of IS NOT NULL THEN RAISE EXCEPTION 'Only ordinary drafts can be edited'; END IF;
 IF p_version IS DISTINCT FROM j.version THEN RAISE EXCEPTION 'Journal changed. Reload.' USING ERRCODE='40001'; END IF;
 IF j.entry_kind<>p_kind THEN RAISE EXCEPTION 'Journal type cannot change'; END IF;
 INSERT INTO tw_accounting_audit(actor_id,table_name,operation,before_data,after_data) SELECT auth.uid(),'tw_accounting_journal_lines','REPLACE_DRAFT',jsonb_build_object('journal_id',p_id,'lines',jsonb_agg(to_jsonb(x))),jsonb_build_object('journal_id',p_id) FROM tw_accounting_journal_lines x WHERE journal_id=p_id;
 DELETE FROM tw_accounting_journal_lines WHERE journal_id=p_id;
 UPDATE tw_accounting_journals SET entry_date=p_date,reference=trim(p_reference),memo=trim(p_memo),version=version+1,updated_at=now() WHERE id=p_id;
 ELSE
 IF p_version IS NOT NULL THEN RAISE EXCEPTION 'Draft no longer exists' USING ERRCODE='40001'; END IF;
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,entry_kind) VALUES(p_id,p_company,p_date,trim(p_reference),trim(p_memo),auth.uid(),p_kind);
 END IF;
 FOR l IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
 n:=n+1;currency:=coalesce(nullif(l->>'lineCurrency',''),c.base_currency);
 IF NOT(currency=ANY(c.currencies)) THEN RAISE EXCEPTION 'Select an enabled currency'; END IF;
 IF coalesce(l->>'debit','') !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' OR coalesce(l->>'credit','') !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'Amounts must have at most two decimals'; END IF;
 fd:=coalesce(l->>'foreignDebit',l->>'debit')::numeric;fc:=coalesce(l->>'foreignCredit',l->>'credit')::numeric;
 IF fd<>round(fd,2) OR fc<>round(fc,2) OR NOT((fd>0 AND fc=0) OR(fc>0 AND fd=0)) THEN RAISE EXCEPTION 'Each line needs either a debit or a credit'; END IF;
 rate:=resolve_effective_exchange_rate(currency,c.base_currency,p_date);
 IF currency<>c.base_currency AND (l->>'lineRate')::numeric IS DISTINCT FROM rate THEN RAISE EXCEPTION 'Exchange rate changed. Refresh the journal rates.' USING ERRCODE='40001'; END IF;
 d:=round(fd*rate,2);cr:=round(fc*rate,2);
 IF (d=0 AND cr=0) OR d IS DISTINCT FROM (l->>'debit')::numeric OR cr IS DISTINCT FROM (l->>'credit')::numeric THEN RAISE EXCEPTION 'Local currency amounts must match the system exchange rate'; END IF;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=l->>'account';
 IF NOT FOUND OR NOT a.active OR a.kind<>'Posting' THEN RAISE EXCEPTION 'Select an active detail posting account. Use receipts, payments or cost invoices for party control accounts.'; END IF;
 IF p_kind='expense' THEN
 IF d>0 AND a.account_type<>'Expense' THEN RAISE EXCEPTION 'Debit lines in Expenses must use expense accounts'; END IF;
 IF a.account_type='Expense' AND d>0 THEN expense_count:=expense_count+1; END IF;
 END IF;
 parent:=nullif(l->>'parentAccount','');
 IF parent IS NOT NULL AND NOT EXISTS(WITH RECURSIVE ancestors AS(SELECT code,parent_code,kind FROM tw_accounting_accounts WHERE company_id=p_company AND code=a.code UNION ALL SELECT x.code,x.parent_code,x.kind FROM tw_accounting_accounts x JOIN ancestors y ON x.code=y.parent_code WHERE x.company_id=p_company)SELECT 1 FROM ancestors WHERE code=parent AND kind='Group') THEN RAISE EXCEPTION 'Auxiliary account must belong to the selected parent account'; END IF;
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,line_currency,line_rate,parent_account) VALUES(p_id,n,p_company,a.code,a.name,left(coalesce(l->>'description',''),500),d,cr,fd,fc,currency,rate,parent);
 sumd:=sumd+d;sumc:=sumc+cr;
 END LOOP;
 IF sumd<=0 OR sumd<>sumc THEN RAISE EXCEPTION 'Journal must balance in local currency before saving'; END IF;
 IF p_kind='expense' AND expense_count=0 THEN RAISE EXCEPTION 'An expense debit line is required'; END IF;
 UPDATE tw_accounting_journals SET transaction_currency=(SELECT CASE WHEN count(DISTINCT line_currency)=1 THEN min(line_currency) END FROM tw_accounting_journal_lines WHERE journal_id=p_id),exchange_rate=(SELECT CASE WHEN count(DISTINCT line_currency)=1 THEN min(line_rate) END FROM tw_accounting_journal_lines WHERE journal_id=p_id),exchange_rate_date=p_date WHERE id=p_id;
 RETURN p_id;
END $$;
CREATE OR REPLACE FUNCTION tw_accounting_save_journal(p_id uuid,p_company uuid,p_date date,p_reference text,p_memo text,p_version integer,p_lines jsonb) RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
 SELECT tw_accounting_save_entry(p_id,p_company,p_date,p_reference,p_memo,p_version,'manual',p_lines)
$$;
REVOKE ALL ON FUNCTION tw_accounting_currency_rates(uuid,date),tw_accounting_save_entry(uuid,uuid,date,text,text,integer,text,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_currency_rates(uuid,date),tw_accounting_save_entry(uuid,uuid,date,text,text,integer,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.tw_accounting_reverse_journal(p_id uuid,p_company uuid,p_reversal uuid,p_date date,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE j tw_accounting_journals%ROWTYPE; existing_id uuid;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id AND company_id=p_company FOR UPDATE;
 IF (j.source_payment_id IS NOT NULL OR j.automatic_source IS NOT NULL) THEN RAISE EXCEPTION 'Reverse the receipt from Receipts & collections to update both modules'; END IF;
 IF j.source_invoice_id IS NOT NULL AND EXISTS(SELECT 1 FROM payments WHERE invoice_id=j.source_invoice_id AND status='completed') THEN RAISE EXCEPTION 'Reverse linked receipts before reversing this invoice'; END IF;
 IF NOT FOUND OR j.status<>'posted' OR j.reversal_of IS NOT NULL THEN RAISE EXCEPTION 'Select an original posted journal to reverse'; END IF;
 SELECT id INTO existing_id FROM tw_accounting_journals WHERE reversal_of=p_id;
 IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;
 IF p_reversal IS NULL OR p_date IS NULL OR p_date<j.entry_date OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Enter a reversal reason and a date on or after the original entry'; END IF;
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,reversal_of,reversal_reason,created_by,entry_kind,source_invoice_id,transaction_currency,exchange_rate,exchange_rate_date)
 VALUES(p_reversal,p_company,p_date,j.voucher_number,'Reversal of '||j.voucher_number||': '||trim(p_reason),p_id,trim(p_reason),auth.uid(),j.entry_kind,j.source_invoice_id,j.transaction_currency,j.exchange_rate,j.exchange_rate_date);
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,client_id,client_code,foreign_debit,foreign_credit,line_currency,line_rate,parent_account)
 SELECT p_reversal,line_number,company_id,account_code,account_name,description,credit,debit,client_id,client_code,foreign_credit,foreign_debit,line_currency,line_rate,parent_account FROM tw_accounting_journal_lines WHERE journal_id=p_id;
 PERFORM tw_accounting_post_journal(p_reversal,p_company,1);
 RETURN p_reversal;
END $$;
CREATE OR REPLACE FUNCTION tw_accounting_statement(p_company uuid,p_from date,p_to date,p_account text DEFAULT NULL,p_kind text DEFAULT 'all',p_party uuid DEFAULT NULL,p_currency text DEFAULT NULL,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb; summaries jsonb;n bigint;BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_offset<0 OR p_offset>10000000 OR p_kind NOT IN ('all','client','vendor') THEN RAISE EXCEPTION 'Invalid statement filters'; END IF;
 WITH source AS(SELECT l.*,j.entry_date,j.voucher_number,j.reference,coalesce(l.line_currency,j.transaction_currency,c.base_currency) currency FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id JOIN tw_accounting_companies c ON c.id=j.company_id WHERE j.company_id=p_company AND j.status='posted' AND j.entry_date<=p_to AND (p_account IS NULL OR l.account_code=p_account) AND (p_kind='all' OR p_kind='client' AND l.client_id IS NOT NULL AND (p_party IS NULL OR l.client_id=p_party) OR p_kind='vendor' AND l.vendor_id IS NOT NULL AND (p_party IS NULL OR l.vendor_id=p_party)) AND (p_currency IS NULL OR coalesce(l.line_currency,j.transaction_currency,c.base_currency)=p_currency)),
 balances AS(SELECT *,sum(debit-credit) OVER(PARTITION BY account_code ORDER BY entry_date,voucher_number,journal_id,line_number ROWS UNBOUNDED PRECEDING) balance FROM source),
 rows AS(SELECT journal_id id,line_number line,account_code account,account_name name,entry_date date,voucher_number number,reference,description,coalesce(client_code,vendor_code) party,currency,debit::text,credit::text,foreign_debit::text,foreign_credit::text,balance::text FROM balances WHERE entry_date>=p_from ORDER BY account_code,entry_date,voucher_number,journal_id,line_number LIMIT 100 OFFSET p_offset)
 SELECT coalesce(jsonb_agg(rows),'[]') INTO result FROM rows;
 WITH source AS(SELECT l.*,j.entry_date FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id JOIN tw_accounting_companies c ON c.id=j.company_id WHERE j.company_id=p_company AND j.status='posted' AND j.entry_date<=p_to AND (p_account IS NULL OR l.account_code=p_account) AND (p_kind='all' OR p_kind='client' AND l.client_id IS NOT NULL AND (p_party IS NULL OR l.client_id=p_party) OR p_kind='vendor' AND l.vendor_id IS NOT NULL AND (p_party IS NULL OR l.vendor_id=p_party)) AND (p_currency IS NULL OR coalesce(l.line_currency,j.transaction_currency,c.base_currency)=p_currency)),
 totals AS(SELECT account_code account,max(account_name) name,coalesce(sum(debit-credit) FILTER(WHERE entry_date<p_from),0)::text opening,coalesce(sum(debit) FILTER(WHERE entry_date>=p_from),0)::text debit,coalesce(sum(credit) FILTER(WHERE entry_date>=p_from),0)::text credit,sum(debit-credit)::text closing,count(*) FILTER(WHERE entry_date>=p_from) count FROM source GROUP BY account_code ORDER BY account_code)
 SELECT coalesce(jsonb_agg(totals),'[]'),coalesce(sum(count),0) INTO summaries,n FROM totals;
 RETURN jsonb_build_object('rows',result,'accounts',summaries,'count',n);
END $$;
REVOKE ALL ON FUNCTION tw_accounting_cost_fx(uuid,uuid),tw_accounting_statement(uuid,date,date,text,text,uuid,text,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_cost_fx(uuid,uuid),tw_accounting_statement(uuid,date,date,text,text,uuid,text,integer) TO authenticated;
COMMIT;
