BEGIN;
ALTER TABLE tw_accounting_accounts ADD COLUMN has_auxiliary boolean NOT NULL DEFAULT false;
UPDATE tw_accounting_accounts SET has_auxiliary=true WHERE kind='Control';
CREATE TABLE tw_accounting_auxiliary_sequences(company_id uuid NOT NULL,account_code text NOT NULL,last_number bigint NOT NULL,PRIMARY KEY(company_id,account_code),FOREIGN KEY(company_id,account_code) REFERENCES tw_accounting_accounts(company_id,code));
CREATE TABLE tw_accounting_auxiliaries(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL,account_code text NOT NULL,number bigint NOT NULL CHECK(number>0),name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 150),
 client_id uuid REFERENCES clients(id),vendor_id uuid REFERENCES influencers(id),active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,
 UNIQUE(company_id,account_code,number),UNIQUE(company_id,account_code,client_id),UNIQUE(company_id,account_code,vendor_id),
 FOREIGN KEY(company_id,account_code) REFERENCES tw_accounting_accounts(company_id,code),CHECK(client_id IS NULL OR vendor_id IS NULL)
);
ALTER TABLE tw_accounting_journal_lines ADD COLUMN auxiliary_id uuid REFERENCES tw_accounting_auxiliaries(id);
CREATE TABLE tw_accounting_account_moves(id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),source_account text NOT NULL,destination_account text NOT NULL,reason text NOT NULL,actor_id uuid NOT NULL REFERENCES profiles(id),created_at timestamptz NOT NULL DEFAULT now(),request jsonb NOT NULL,before_lines jsonb NOT NULL,after_lines jsonb NOT NULL);
DO $$ DECLARE t text;BEGIN
 FOREACH t IN ARRAY ARRAY['tw_accounting_auxiliaries','tw_accounting_auxiliary_sequences','tw_accounting_account_moves'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated,service_role',t);
 EXECUTE format('GRANT SELECT ON %I TO authenticated',t);
 EXECUTE format('CREATE POLICY accounting_read ON %I FOR SELECT TO authenticated USING ((SELECT (tw_module_access()->>''accounting'')::boolean))',t);
 EXECUTE format('CREATE TRIGGER accounting_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION tw_accounting_audit_change()',t);
 END LOOP;
END $$;
CREATE FUNCTION tw_accounting_auxiliary_link(p_company uuid,p_account text,p_client uuid DEFAULT NULL,p_vendor uuid DEFAULT NULL,p_name text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a tw_accounting_accounts%ROWTYPE;aux uuid;n bigint;label text;BEGIN
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_account;
 IF NOT FOUND OR NOT a.active OR NOT a.has_auxiliary THEN RAISE EXCEPTION 'Select an active account with auxiliaries'; END IF;
 IF a.kind='Control' AND a.subledger='Customer' THEN
 SELECT id INTO aux FROM tw_accounting_auxiliaries WHERE company_id=p_company AND account_code=p_account AND client_id=p_client;
 SELECT name INTO label FROM clients WHERE id=p_client;IF label IS NULL OR p_vendor IS NOT NULL THEN RAISE EXCEPTION 'Client required for this auxiliary'; END IF;
 ELSIF a.kind='Control' AND a.subledger='Supplier / creator' THEN
 SELECT id INTO aux FROM tw_accounting_auxiliaries WHERE company_id=p_company AND account_code=p_account AND vendor_id=p_vendor;
 SELECT coalesce(legal_name,display_name,document_number) INTO label FROM influencers WHERE id=p_vendor;IF label IS NULL OR p_client IS NOT NULL THEN RAISE EXCEPTION 'Vendor required for this auxiliary'; END IF;
 ELSE
 IF p_client IS NOT NULL OR p_vendor IS NOT NULL OR length(trim(coalesce(p_name,''))) NOT BETWEEN 1 AND 150 THEN RAISE EXCEPTION 'Enter the auxiliary name'; END IF;label:=trim(p_name);
 END IF;
 IF aux IS NOT NULL THEN RETURN aux; END IF;
 INSERT INTO tw_accounting_auxiliary_sequences AS s VALUES(p_company,p_account,1) ON CONFLICT(company_id,account_code) DO UPDATE SET last_number=s.last_number+1 RETURNING last_number INTO n;
 INSERT INTO tw_accounting_auxiliaries(company_id,account_code,number,name,client_id,vendor_id) VALUES(p_company,p_account,n,label,p_client,p_vendor) RETURNING id INTO aux;
 RETURN aux;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_auxiliary_link(uuid,text,uuid,uuid,text) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION tw_accounting_auxiliary_save(p_company uuid,p_account text,p_id uuid,p_version integer,p_name text,p_active boolean,p_client uuid DEFAULT NULL,p_vendor uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL THEN RETURN tw_accounting_auxiliary_link(p_company,p_account,p_client,p_vendor,p_name); END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 IF p_active IS NULL OR length(trim(coalesce(p_name,''))) NOT BETWEEN 1 AND 150 THEN RAISE EXCEPTION 'Auxiliary name and status required'; END IF;
 UPDATE tw_accounting_auxiliaries SET name=trim(p_name),active=p_active,version=version+1 WHERE id=p_id AND company_id=p_company AND account_code=p_account AND version=p_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Auxiliary changed. Reload.' USING ERRCODE='40001'; END IF;RETURN p_id;
END $$;
CREATE FUNCTION tw_accounting_auxiliary_account_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.kind='Control' THEN NEW.has_auxiliary:=true; END IF;
 IF NEW.kind NOT IN('Posting','Control') AND NEW.has_auxiliary THEN RAISE EXCEPTION 'Only detail accounts can have auxiliaries'; END IF;
 IF TG_OP='UPDATE' AND (NEW.has_auxiliary,NEW.subledger) IS DISTINCT FROM(OLD.has_auxiliary,OLD.subledger) THEN
 PERFORM 1 FROM tw_accounting_companies WHERE id=OLD.company_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE company_id=OLD.company_id AND account_code=OLD.code) THEN RAISE EXCEPTION 'Move all transactions out of this account before changing auxiliary settings'; END IF;
 IF NEW.subledger IS DISTINCT FROM OLD.subledger AND EXISTS(SELECT 1 FROM tw_accounting_auxiliaries WHERE company_id=OLD.company_id AND account_code=OLD.code) THEN RAISE EXCEPTION 'Existing auxiliaries keep their client/vendor directory type; use a new account for a different directory'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE TRIGGER a_tw_auxiliary_account BEFORE INSERT OR UPDATE ON tw_accounting_accounts FOR EACH ROW EXECUTE FUNCTION tw_accounting_auxiliary_account_guard();
CREATE FUNCTION tw_accounting_auxiliary_line_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a tw_accounting_accounts%ROWTYPE;x tw_accounting_auxiliaries%ROWTYPE;reversing boolean;BEGIN
 SELECT reversal_of IS NOT NULL INTO reversing FROM tw_accounting_journals WHERE id=NEW.journal_id;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=NEW.company_id AND code=NEW.account_code;
 IF NOT a.has_auxiliary THEN IF NEW.auxiliary_id IS NOT NULL THEN RAISE EXCEPTION 'This account has no auxiliaries'; END IF;RETURN NEW;END IF;
 IF a.kind='Control' AND a.subledger IN('Customer','Supplier / creator') AND NOT(coalesce(reversing,false) AND NEW.auxiliary_id IS NOT NULL) THEN
 NEW.auxiliary_id:=tw_accounting_auxiliary_link(NEW.company_id,NEW.account_code,NEW.client_id,NEW.vendor_id);
 END IF;
 IF NEW.auxiliary_id IS NULL AND a.kind='Posting' THEN NEW.auxiliary_id:=nullif(coalesce(nullif(current_setting('tw.accounting_auxiliaries',true),''),'{}')::jsonb->>NEW.account_code,'')::uuid; END IF;
 SELECT * INTO x FROM tw_accounting_auxiliaries WHERE id=NEW.auxiliary_id AND company_id=NEW.company_id AND account_code=NEW.account_code;
 IF NOT FOUND OR (NOT x.active AND NOT coalesce(reversing,false)) THEN RAISE EXCEPTION 'Select an active auxiliary under this account'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tw_auxiliary_line BEFORE INSERT OR UPDATE ON tw_accounting_journal_lines FOR EACH ROW EXECUTE FUNCTION tw_accounting_auxiliary_line_guard();
-- Populate party auxiliaries without changing amounts, dates or document numbers.
UPDATE tw_accounting_journal_lines l SET account_code=l.account_code FROM tw_accounting_accounts a WHERE a.company_id=l.company_id AND a.code=l.account_code AND a.kind='Control' AND a.subledger IN('Customer','Supplier / creator');
CREATE FUNCTION tw_accounting_move_accounts(p_id uuid,p_company uuid,p_source text,p_destination text,p_auxiliary uuid,p_all boolean,p_lines jsonb,p_expected_count integer,p_reason text,p_snapshot text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE src tw_accounting_accounts%ROWTYPE;dst tw_accounting_accounts%ROWTYPE;before_rows jsonb;after_rows jsonb;request_value jsonb;prior tw_accounting_account_moves%ROWTYPE;selected_count integer;linked boolean;BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 IF p_id IS NULL OR p_source=p_destination OR p_all IS NULL OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Choose two different accounts, transactions and a reason'; END IF;
 -- Match invoice posting's lock order before locking company books.
 PERFORM i.id FROM invoices i JOIN tw_accounting_invoice_submissions s ON s.invoice_id=i.id WHERE s.company_id=p_company ORDER BY i.id FOR UPDATE OF i;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 request_value:=jsonb_build_object('source',p_source,'destination',p_destination,'auxiliary',p_auxiliary,'all',p_all,'lines',p_lines,'count',p_expected_count,'reason',p_reason);
 SELECT * INTO prior FROM tw_accounting_account_moves WHERE id=p_id;
 IF FOUND THEN IF prior.company_id<>p_company OR prior.request IS DISTINCT FROM request_value THEN RAISE EXCEPTION 'Move request already used'; END IF;RETURN p_id;END IF;
 SELECT * INTO src FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_source;
 SELECT * INTO dst FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_destination;
 IF src.code IS NULL OR dst.code IS NULL OR NOT dst.active OR src.kind NOT IN('Posting','Control') OR dst.kind<>src.kind OR dst.account_type<>src.account_type OR dst.normal_balance<>src.normal_balance OR dst.subledger IS DISTINCT FROM src.subledger THEN RAISE EXCEPTION 'Destination must have the same account type, balance side and client/vendor directory'; END IF;
 SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('version',j.version) ORDER BY l.journal_id,l.line_number),count(*),bool_or(j.source_invoice_id IS NOT NULL OR j.source_payment_id IS NOT NULL OR j.automatic_source IS NOT NULL) INTO before_rows,selected_count,linked
 FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id WHERE l.company_id=p_company AND l.account_code=p_source AND (p_all OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_lines) x WHERE (x->>'journal')::uuid=l.journal_id AND (x->>'line')::integer=l.line_number AND (x->>'version')::integer=j.version));
 IF selected_count=0 OR selected_count IS DISTINCT FROM p_expected_count OR (NOT p_all AND selected_count<>jsonb_array_length(p_lines)) THEN RAISE EXCEPTION 'Transactions changed. Reload the move preview.' USING ERRCODE='40001'; END IF;
 IF p_all AND p_snapshot IS DISTINCT FROM (tw_accounting_move_lines(p_company,p_source)->>'snapshot') THEN RAISE EXCEPTION 'Transactions changed. Reload the move preview.' USING ERRCODE='40001'; END IF;
 IF linked AND NOT p_all THEN RAISE EXCEPTION 'Linked invoice/receipt/payment accounts must move together. Select all transactions to preserve source balances.'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(before_rows) x JOIN tw_accounting_journals j ON j.id=(x->>'journal_id')::uuid WHERE EXISTS(SELECT 1 FROM tw_accounting_periods p JOIN tw_accounting_years y ON y.id=p.year_id WHERE y.company_id=p_company AND p.is_closed AND j.entry_date BETWEEN p.start_date AND p.end_date)) THEN RAISE EXCEPTION 'A selected transaction belongs to a closed period. Reopen the period before an account correction.'; END IF;
 IF dst.has_auxiliary AND dst.kind='Posting' AND NOT EXISTS(SELECT 1 FROM tw_accounting_auxiliaries WHERE id=p_auxiliary AND company_id=p_company AND account_code=p_destination AND active AND client_id IS NULL AND vendor_id IS NULL) THEN RAISE EXCEPTION 'Choose the destination auxiliary'; END IF;
 IF NOT dst.has_auxiliary AND p_auxiliary IS NOT NULL THEN RAISE EXCEPTION 'Destination has no auxiliary'; END IF;
 UPDATE tw_accounting_journal_lines l SET account_code=p_destination,account_name=dst.name,parent_account=NULL,auxiliary_id=CASE WHEN dst.kind='Posting' AND dst.has_auxiliary THEN p_auxiliary END
 WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(before_rows) x WHERE (x->>'journal_id')::uuid=l.journal_id AND (x->>'line_number')::integer=l.line_number);
 UPDATE tw_accounting_journals SET version=version+1,updated_at=now() WHERE id IN(SELECT (x->>'journal_id')::uuid FROM jsonb_array_elements(before_rows) x);
 IF p_all THEN
 UPDATE tw_accounting_cost_invoices SET auxiliaries=(auxiliaries-p_source)||CASE WHEN p_auxiliary IS NOT NULL THEN jsonb_build_object(p_destination,p_auxiliary) ELSE '{}'::jsonb END,expense_account=CASE WHEN expense_account=p_source THEN p_destination ELSE expense_account END,payable_account=CASE WHEN payable_account=p_source THEN p_destination ELSE payable_account END,vat_account=CASE WHEN vat_account=p_source THEN p_destination ELSE vat_account END,version=version+1 WHERE company_id=p_company AND p_source IN(expense_account,payable_account,vat_account);
 UPDATE tw_accounting_settlements SET cash_account=CASE WHEN cash_account=p_source THEN p_destination ELSE cash_account END,control_account=CASE WHEN control_account=p_source THEN p_destination ELSE control_account END,advance_account=CASE WHEN advance_account=p_source THEN p_destination ELSE advance_account END,
 request=jsonb_set(request,'{value}',(SELECT jsonb_object_agg(key,CASE WHEN key IN('cash','control','advance','gain','loss') AND value=to_jsonb(p_source) THEN to_jsonb(p_destination) ELSE value END) FROM jsonb_each(request->'value'))) WHERE company_id=p_company AND (p_source IN(cash_account,control_account,advance_account) OR request->'value'->>'gain'=p_source OR request->'value'->>'loss'=p_source);
 END IF;
 SELECT jsonb_agg(to_jsonb(l) ORDER BY l.journal_id,l.line_number) INTO after_rows FROM tw_accounting_journal_lines l WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(before_rows) x WHERE (x->>'journal_id')::uuid=l.journal_id AND (x->>'line_number')::integer=l.line_number);
 INSERT INTO tw_accounting_account_moves VALUES(p_id,p_company,p_source,p_destination,trim(p_reason),auth.uid(),now(),request_value,before_rows,after_rows);
 RETURN p_id;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_auxiliary_save(uuid,text,uuid,integer,text,boolean,uuid,uuid),tw_accounting_move_accounts(uuid,uuid,text,text,uuid,boolean,jsonb,integer,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_auxiliary_save(uuid,text,uuid,integer,text,boolean,uuid,uuid),tw_accounting_move_accounts(uuid,uuid,text,text,uuid,boolean,jsonb,integer,text,text) TO authenticated;
CREATE OR REPLACE FUNCTION tw_accounting_save_entry(p_id uuid,p_company uuid,p_date date,p_reference text,p_memo text,p_version integer,p_kind text,p_lines jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,line_currency,line_rate,parent_account,auxiliary_id) VALUES(p_id,n,p_company,a.code,a.name,left(coalesce(l->>'description',''),500),d,cr,fd,fc,currency,rate,parent,nullif(l->>'auxiliaryId','')::uuid);
 sumd:=sumd+d;sumc:=sumc+cr;
 END LOOP;
 IF sumd<=0 OR sumd<>sumc THEN RAISE EXCEPTION 'Journal must balance in local currency before saving'; END IF;
 IF p_kind='expense' AND expense_count=0 THEN RAISE EXCEPTION 'An expense debit line is required'; END IF;
 UPDATE tw_accounting_journals SET transaction_currency=(SELECT CASE WHEN count(DISTINCT line_currency)=1 THEN min(line_currency) END FROM tw_accounting_journal_lines WHERE journal_id=p_id),exchange_rate=(SELECT CASE WHEN count(DISTINCT line_currency)=1 THEN min(line_rate) END FROM tw_accounting_journal_lines WHERE journal_id=p_id),exchange_rate_date=p_date WHERE id=p_id;
 RETURN p_id;
END $$;
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
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,client_id,client_code,foreign_debit,foreign_credit,line_currency,line_rate,parent_account,auxiliary_id)
 SELECT p_reversal,line_number,company_id,account_code,account_name,description,credit,debit,client_id,client_code,foreign_credit,foreign_debit,line_currency,line_rate,parent_account,auxiliary_id FROM tw_accounting_journal_lines WHERE journal_id=p_id;
 PERFORM tw_accounting_post_journal(p_reversal,p_company,1);
 RETURN p_reversal;
END $$;
CREATE FUNCTION tw_accounting_move_lines(p_company uuid,p_account text,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb;n integer;snapshot text;BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 SELECT count(*) INTO n FROM tw_accounting_journal_lines WHERE company_id=p_company AND account_code=p_account;
 SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT l.journal_id journal,l.line_number line,j.version,j.voucher_number number,j.entry_date date,j.status,l.description,l.debit::text,l.credit::text,CASE WHEN a.id IS NOT NULL THEN a.number||' · '||a.name END auxiliary,(j.source_invoice_id IS NOT NULL OR j.source_payment_id IS NOT NULL OR j.automatic_source IS NOT NULL) linked FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id LEFT JOIN tw_accounting_auxiliaries a ON a.id=l.auxiliary_id WHERE l.company_id=p_company AND l.account_code=p_account ORDER BY j.entry_date,j.voucher_number,l.journal_id,l.line_number LIMIT 100 OFFSET p_offset)x;
 SELECT md5(string_agg(l.journal_id||':'||l.line_number||':'||j.version,',' ORDER BY l.journal_id,l.line_number)) INTO snapshot FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id WHERE l.company_id=p_company AND l.account_code=p_account;
 RETURN jsonb_build_object('rows',result,'count',n,'snapshot',snapshot);END $$;
REVOKE ALL ON FUNCTION tw_accounting_move_lines(uuid,text,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_move_lines(uuid,text,integer) TO authenticated;
CREATE OR REPLACE FUNCTION tw_accounting_settlement_reverse(p_id uuid,p_company uuid,p_date date,p_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE s tw_accounting_settlements%ROWTYPE;j tw_accounting_journals%ROWTYPE;r uuid:=gen_random_uuid();remaining numeric;BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM i.id FROM invoices i WHERE i.id IN(SELECT invoice_id FROM tw_accounting_settlement_lines WHERE settlement_id=p_id) ORDER BY i.id FOR UPDATE;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO s FROM tw_accounting_settlements WHERE id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Voucher unavailable'; END IF;IF s.status='reversed' THEN RETURN s.reversal_id; END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_settlements WHERE parent_id=s.id AND status='posted') THEN RAISE EXCEPTION 'Reverse the advance allocations first'; END IF;
 IF p_date IS NULL OR p_date<s.date OR p_date>(now() AT TIME ZONE 'Africa/Cairo')::date OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Enter a valid reversal date and reason'; END IF;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=s.journal_id;
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,automatic_source,reversal_of,reversal_reason,transaction_currency,exchange_rate,exchange_rate_date) VALUES(r,p_company,p_date,s.number,'Reversal: '||p_reason,auth.uid(),s.kind,j.id,p_reason,j.transaction_currency,j.exchange_rate,j.exchange_rate_date);
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,client_id,client_code,vendor_id,vendor_code,auxiliary_id) SELECT r,line_number,company_id,account_code,account_name,description,credit,debit,foreign_credit,foreign_debit,client_id,client_code,vendor_id,vendor_code,auxiliary_id FROM tw_accounting_journal_lines WHERE journal_id=j.id;
 PERFORM tw_accounting_finish_receipt_journal(r);
 UPDATE tw_accounting_settlements SET status='reversed',reversal_id=r WHERE id=s.id;
 UPDATE payments SET status='cancelled',revision=revision+1 WHERE status='completed' AND id IN(SELECT payment_id FROM tw_accounting_settlement_payments WHERE settlement_id=s.id);
 DELETE FROM payment_allocations WHERE payment_id IN(SELECT payment_id FROM tw_accounting_settlement_payments WHERE settlement_id=s.id);
 IF s.kind='receipt_apply' THEN
 SELECT p.advance_amount-coalesce((SELECT sum(amount) FROM tw_accounting_settlements WHERE parent_id=p.id AND status='posted'),0) INTO remaining FROM tw_accounting_settlements p WHERE p.id=s.parent_id;
 UPDATE payments SET amount=remaining,status='completed',revision=revision+1 WHERE id IN(SELECT payment_id FROM tw_accounting_settlement_payments WHERE settlement_id=s.parent_id AND is_advance);
 END IF;RETURN r;
END $$;

ALTER TABLE tw_accounting_cost_invoices ADD COLUMN auxiliaries jsonb NOT NULL DEFAULT '{}';
CREATE FUNCTION tw_accounting_post_with_aux(p_operation text,p_value jsonb,p_auxiliaries jsonb DEFAULT '{}',p_id uuid DEFAULT NULL,p_expected jsonb DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;choices jsonb;BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 choices:=coalesce(p_value->'auxiliaries',p_auxiliaries,'{}');
 IF p_operation IN('cost-post','cost-reconcile') THEN SELECT auxiliaries||choices INTO choices FROM tw_accounting_cost_invoices WHERE id=(p_value->>'id')::uuid AND company_id=(p_value->>'company')::uuid;END IF;
 IF jsonb_typeof(choices) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Select valid auxiliary choices';END IF;
 PERFORM set_config('tw.accounting_auxiliaries',choices::text,true);
 IF p_operation='settlement' THEN result:=tw_accounting_settlement_post(p_id,p_value,p_expected);
 ELSIF p_operation='invoice' THEN result:=tw_accounting_post_invoice((p_value->>'invoice')::uuid,(p_value->>'company')::uuid,(p_value->>'version')::integer,(p_value->>'date')::date,p_value->>'receivable',p_value->>'revenue',p_value->>'vat',(p_value->>'rate')::numeric);
 ELSIF p_operation='cost-save' THEN result:=tw_accounting_cost_save(p_value);UPDATE tw_accounting_cost_invoices SET auxiliaries=choices WHERE id=result;
 ELSIF p_operation='cost-post' THEN result:=tw_accounting_cost_post((p_value->>'id')::uuid,(p_value->>'company')::uuid,(p_value->>'version')::integer,(p_value->>'rate')::numeric);
 ELSIF p_operation='cost-reconcile' THEN result:=tw_accounting_cost_reconcile((p_value->>'id')::uuid,(p_value->>'company')::uuid,(p_value->>'version')::integer,(p_value->>'date')::date,p_value->>'number',(p_value->>'supplierDate')::date,(p_value->>'net')::numeric,(p_value->>'tax')::numeric,p_value->>'vat',p_value->>'reference');UPDATE tw_accounting_cost_invoices SET auxiliaries=choices WHERE id=(p_value->>'id')::uuid;
 ELSE RAISE EXCEPTION 'Unknown auxiliary posting operation';END IF;
 PERFORM set_config('tw.accounting_auxiliaries','{}',true);RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_post_with_aux(text,jsonb,jsonb,uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_post_with_aux(text,jsonb,jsonb,uuid,jsonb) TO authenticated;
DROP FUNCTION tw_accounting_statement(uuid,date,date,text,text,uuid,text,integer);
CREATE FUNCTION tw_accounting_statement(p_company uuid,p_from date,p_to date,p_account text DEFAULT NULL,p_kind text DEFAULT 'all',p_party uuid DEFAULT NULL,p_currency text DEFAULT NULL,p_offset integer DEFAULT 0,p_auxiliary uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb; summaries jsonb;n bigint;BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_offset<0 OR p_offset>10000000 OR p_kind NOT IN ('all','client','vendor') THEN RAISE EXCEPTION 'Invalid statement filters'; END IF;
 WITH source AS(SELECT l.*,j.entry_date,j.voucher_number,j.reference,coalesce(l.line_currency,j.transaction_currency,c.base_currency) currency FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id JOIN tw_accounting_companies c ON c.id=j.company_id WHERE j.company_id=p_company AND j.status='posted' AND (p_auxiliary IS NULL OR l.auxiliary_id=p_auxiliary) AND j.entry_date<=p_to AND (p_account IS NULL OR l.account_code=p_account) AND (p_kind='all' OR p_kind='client' AND l.client_id IS NOT NULL AND (p_party IS NULL OR l.client_id=p_party) OR p_kind='vendor' AND l.vendor_id IS NOT NULL AND (p_party IS NULL OR l.vendor_id=p_party)) AND (p_currency IS NULL OR coalesce(l.line_currency,j.transaction_currency,c.base_currency)=p_currency)),
 balances AS(SELECT *,sum(debit-credit) OVER(PARTITION BY account_code ORDER BY entry_date,voucher_number,journal_id,line_number ROWS UNBOUNDED PRECEDING) balance FROM source),
 rows AS(SELECT journal_id id,line_number line,account_code account,account_name name,entry_date date,voucher_number number,reference,description,(SELECT number||' · '||name FROM tw_accounting_auxiliaries a WHERE a.id=balances.auxiliary_id) auxiliary,coalesce(client_code,vendor_code) party,currency,debit::text,credit::text,foreign_debit::text,foreign_credit::text,balance::text FROM balances WHERE entry_date>=p_from ORDER BY account_code,entry_date,voucher_number,journal_id,line_number LIMIT 100 OFFSET p_offset)
 SELECT coalesce(jsonb_agg(rows),'[]') INTO result FROM rows;
 WITH source AS(SELECT l.*,j.entry_date FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id JOIN tw_accounting_companies c ON c.id=j.company_id WHERE j.company_id=p_company AND j.status='posted' AND (p_auxiliary IS NULL OR l.auxiliary_id=p_auxiliary) AND j.entry_date<=p_to AND (p_account IS NULL OR l.account_code=p_account) AND (p_kind='all' OR p_kind='client' AND l.client_id IS NOT NULL AND (p_party IS NULL OR l.client_id=p_party) OR p_kind='vendor' AND l.vendor_id IS NOT NULL AND (p_party IS NULL OR l.vendor_id=p_party)) AND (p_currency IS NULL OR coalesce(l.line_currency,j.transaction_currency,c.base_currency)=p_currency)),
 totals AS(SELECT account_code account,max(account_name) name,coalesce(sum(debit-credit) FILTER(WHERE entry_date<p_from),0)::text opening,coalesce(sum(debit) FILTER(WHERE entry_date>=p_from),0)::text debit,coalesce(sum(credit) FILTER(WHERE entry_date>=p_from),0)::text credit,sum(debit-credit)::text closing,count(*) FILTER(WHERE entry_date>=p_from) count FROM source GROUP BY account_code ORDER BY account_code)
 SELECT coalesce(jsonb_agg(totals),'[]'),coalesce(sum(count),0) INTO summaries,n FROM totals;
 RETURN jsonb_build_object('rows',result,'accounts',summaries,'count',n);
END $$;

REVOKE ALL ON FUNCTION tw_accounting_statement(uuid,date,date,text,text,uuid,text,integer,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_statement(uuid,date,date,text,text,uuid,text,integer,uuid) TO authenticated;
COMMIT;
