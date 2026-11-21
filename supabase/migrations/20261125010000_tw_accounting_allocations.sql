BEGIN;
ALTER TABLE tw_accounting_journals ADD COLUMN automatic_source text;
ALTER TABLE tw_accounting_journal_lines ADD COLUMN vendor_id uuid REFERENCES influencers(id), ADD COLUMN vendor_code text;
CREATE TABLE tw_accounting_document_sequences(company_id uuid REFERENCES tw_accounting_companies(id),prefix text,year integer,last_number bigint NOT NULL,PRIMARY KEY(company_id,prefix,year));
CREATE TABLE tw_accounting_cost_invoices(
 id uuid PRIMARY KEY, company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),vendor_id uuid NOT NULL REFERENCES influencers(id),vendor_code text NOT NULL,vendor_name text NOT NULL,
 number text,document_date date NOT NULL,due_date date,currency text NOT NULL,net numeric(18,2) NOT NULL CHECK(net>0),tax numeric(18,2) NOT NULL DEFAULT 0 CHECK(tax>=0),
 expense_account text NOT NULL,payable_account text NOT NULL,vat_account text,description text NOT NULL,supporting_reference text NOT NULL,
 supplier_number text,supplier_date date,status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','internal','supplier','reversed')),
 exchange_rate numeric(24,8),base_net numeric(18,2),base_tax numeric(18,2),journal_id uuid UNIQUE REFERENCES tw_accounting_journals(id),reversal_id uuid REFERENCES tw_accounting_journals(id),
 version integer NOT NULL DEFAULT 1,created_by uuid NOT NULL REFERENCES profiles(id),created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(company_id,number),
 CHECK(currency ~ '^[A-Z]{3}$'),CHECK(supplier_number IS NOT NULL OR tax=0)
);
CREATE UNIQUE INDEX tw_cost_supplier_number ON tw_accounting_cost_invoices(company_id,vendor_id,lower(supplier_number)) WHERE supplier_number IS NOT NULL AND status<>'reversed';
CREATE TABLE tw_accounting_settlements(
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),kind text NOT NULL CHECK(kind IN ('receipt','payment','receipt_apply','payment_apply')),
 client_id uuid REFERENCES clients(id),vendor_id uuid REFERENCES influencers(id),party_code text NOT NULL,party_name text NOT NULL,
 number text NOT NULL,date date NOT NULL,currency text NOT NULL,amount numeric(18,2) NOT NULL CHECK(amount>0),exchange_rate numeric(24,8) NOT NULL,
 cash_account text,control_account text NOT NULL,advance_account text NOT NULL,advance_amount numeric(18,2) NOT NULL CHECK(advance_amount>=0),advance_base numeric(18,2) NOT NULL,
 parent_id uuid REFERENCES tw_accounting_settlements(id),journal_id uuid UNIQUE NOT NULL REFERENCES tw_accounting_journals(id),reversal_id uuid REFERENCES tw_accounting_journals(id),
 status text NOT NULL DEFAULT 'posted' CHECK(status IN ('posted','reversed')),request jsonb NOT NULL,created_by uuid NOT NULL REFERENCES profiles(id),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((client_id IS NOT NULL)<>(vendor_id IS NOT NULL)),UNIQUE(company_id,number)
);
CREATE TABLE tw_accounting_settlement_lines(
 settlement_id uuid NOT NULL REFERENCES tw_accounting_settlements(id),line integer NOT NULL,invoice_id uuid REFERENCES invoices(id),cost_id uuid REFERENCES tw_accounting_cost_invoices(id),
 amount numeric(18,2) NOT NULL CHECK(amount>0),base_amount numeric(18,2) NOT NULL CHECK(base_amount>0),PRIMARY KEY(settlement_id,line),CHECK((invoice_id IS NOT NULL)<>(cost_id IS NOT NULL)),UNIQUE(settlement_id,invoice_id),UNIQUE(settlement_id,cost_id)
);
CREATE TABLE tw_accounting_settlement_payments(payment_id uuid PRIMARY KEY REFERENCES payments(id),settlement_id uuid NOT NULL REFERENCES tw_accounting_settlements(id),is_advance boolean NOT NULL);
CREATE INDEX tw_settlement_invoice ON tw_accounting_settlement_lines(invoice_id);
CREATE INDEX tw_settlement_cost ON tw_accounting_settlement_lines(cost_id);
CREATE INDEX tw_settlement_parent ON tw_accounting_settlements(parent_id);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['tw_accounting_document_sequences','tw_accounting_cost_invoices','tw_accounting_settlements','tw_accounting_settlement_lines','tw_accounting_settlement_payments'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated,service_role',t);
 EXECUTE format('GRANT SELECT ON %I TO authenticated',t);
 EXECUTE format('CREATE POLICY accounting_read ON %I FOR SELECT TO authenticated USING ((SELECT (public.tw_module_access()->>''accounting'')::boolean))',t);
 EXECUTE format('CREATE TRIGGER accounting_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION tw_accounting_audit_change()',t);
 END LOOP;
END $$;
CREATE FUNCTION tw_accounting_number(p_company uuid,p_prefix text,p_date date) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE n bigint; BEGIN
 INSERT INTO tw_accounting_document_sequences AS s VALUES(p_company,p_prefix,extract(year FROM p_date),1) ON CONFLICT(company_id,prefix,year) DO UPDATE SET last_number=s.last_number+1 RETURNING last_number INTO n;
 RETURN p_prefix||'-'||extract(year FROM p_date)||'-'||lpad(n::text,greatest(6,length(n::text)),'0');
END $$;
CREATE FUNCTION tw_accounting_require_account(p_company uuid,p_code text,p_kind text,p_type text,p_normal text,p_subledger text DEFAULT NULL) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE a tw_accounting_accounts%ROWTYPE; BEGIN
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_code;
 IF NOT FOUND OR NOT a.active OR a.kind<>p_kind OR a.account_type<>p_type OR a.normal_balance<>p_normal OR (p_subledger IS NOT NULL AND a.subledger IS DISTINCT FROM p_subledger) THEN RAISE EXCEPTION 'Select an active % % account (%).',p_type,p_kind,p_code; END IF;
 RETURN a.name;
END $$;
CREATE FUNCTION tw_accounting_auto_line(p_journal uuid,p_line integer,p_account text,p_description text,p_debit numeric,p_credit numeric,p_fd numeric,p_fc numeric,p_client uuid DEFAULT NULL,p_vendor uuid DEFAULT NULL,p_code text DEFAULT NULL) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF coalesce(p_debit,0)=0 AND coalesce(p_credit,0)=0 THEN RETURN; END IF;
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,client_id,client_code,vendor_id,vendor_code)
 SELECT p_journal,p_line,j.company_id,a.code,a.name,left(p_description,500),p_debit,p_credit,p_fd,p_fc,p_client,CASE WHEN p_client IS NOT NULL THEN p_code END,p_vendor,CASE WHEN p_vendor IS NOT NULL THEN p_code END FROM tw_accounting_journals j JOIN tw_accounting_accounts a ON a.company_id=j.company_id AND a.code=p_account WHERE j.id=p_journal;
 IF NOT FOUND THEN RAISE EXCEPTION 'Journal account unavailable'; END IF;
END $$;
CREATE FUNCTION tw_accounting_cost_save(p_value jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE c tw_accounting_cost_invoices%ROWTYPE; v influencers%ROWTYPE; id uuid:=(p_value->>'id')::uuid; company uuid:=(p_value->>'company')::uuid; BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE tw_accounting_companies.id=company FOR UPDATE;
 SELECT * INTO c FROM tw_accounting_cost_invoices WHERE tw_accounting_cost_invoices.id=id FOR UPDATE;
 IF FOUND AND (c.company_id<>company OR c.status<>'draft' OR c.version IS DISTINCT FROM (p_value->>'version')::integer) THEN RAISE EXCEPTION 'Cost invoice changed or is already posted'; END IF;
 SELECT * INTO v FROM influencers WHERE influencers.id=(p_value->>'vendor')::uuid;
 IF v.id IS NULL OR nullif(v.document_number,'') IS NULL THEN RAISE EXCEPTION 'Select a vendor with an existing code'; END IF;
 IF (p_value->>'net')::numeric<=0 OR (p_value->>'net')::numeric<>round((p_value->>'net')::numeric,2) OR (p_value->>'tax')::numeric<0 OR (p_value->>'tax')::numeric<>round((p_value->>'tax')::numeric,2) OR length(trim(p_value->>'description')) NOT BETWEEN 3 AND 1000 OR length(trim(p_value->>'reference')) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Enter amounts, description and a supporting reference'; END IF;
 IF nullif(p_value->>'date','') IS NULL OR (p_value->>'date')::date>(now() AT TIME ZONE 'Africa/Cairo')::date OR (nullif(trim(p_value->>'supplierNumber'),'') IS NOT NULL AND nullif(p_value->>'supplierDate','') IS NULL) OR nullif(p_value->>'supplierDate','')::date>(now() AT TIME ZONE 'Africa/Cairo')::date THEN RAISE EXCEPTION 'Check invoice and supplier dates'; END IF;
 IF nullif(trim(p_value->>'supplierNumber'),'') IS NULL AND (p_value->>'tax')::numeric<>0 THEN RAISE EXCEPTION 'Internal provisional cost invoices do not assume input tax'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_companies WHERE tw_accounting_companies.id=company AND p_value->>'currency'=ANY(currencies)) THEN RAISE EXCEPTION 'Enable the invoice currency for this company'; END IF;
 PERFORM tw_accounting_require_account(company,p_value->>'expense','Posting','Expense','Debit');
 PERFORM tw_accounting_require_account(company,p_value->>'payable','Control','Liability','Credit','Supplier / creator');
 IF (p_value->>'tax')::numeric>0 THEN PERFORM tw_accounting_require_account(company,p_value->>'vat','Posting','Asset','Debit'); END IF;
 INSERT INTO tw_accounting_cost_invoices(id,company_id,vendor_id,vendor_code,vendor_name,document_date,due_date,currency,net,tax,expense_account,payable_account,vat_account,description,supporting_reference,supplier_number,supplier_date,created_by)
 VALUES(id,company,v.id,v.document_number,coalesce(v.legal_name,v.display_name,v.document_number),(p_value->>'date')::date,nullif(p_value->>'due','')::date,p_value->>'currency',(p_value->>'net')::numeric,(p_value->>'tax')::numeric,p_value->>'expense',p_value->>'payable',nullif(p_value->>'vat',''),trim(p_value->>'description'),trim(p_value->>'reference'),nullif(trim(p_value->>'supplierNumber'),''),nullif(p_value->>'supplierDate','')::date,auth.uid())
 ON CONFLICT ON CONSTRAINT tw_accounting_cost_invoices_pkey DO UPDATE SET vendor_id=excluded.vendor_id,vendor_code=excluded.vendor_code,vendor_name=excluded.vendor_name,document_date=excluded.document_date,due_date=excluded.due_date,currency=excluded.currency,net=excluded.net,tax=excluded.tax,expense_account=excluded.expense_account,payable_account=excluded.payable_account,vat_account=excluded.vat_account,description=excluded.description,supporting_reference=excluded.supporting_reference,supplier_number=excluded.supplier_number,supplier_date=excluded.supplier_date,version=tw_accounting_cost_invoices.version+1;
 RETURN id;
END $$;
CREATE FUNCTION tw_accounting_cost_post(p_id uuid,p_company uuid,p_version integer,p_rate numeric) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE c tw_accounting_cost_invoices%ROWTYPE; j uuid:=gen_random_uuid(); rate numeric; bn numeric; bt numeric; base text; BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO c FROM tw_accounting_cost_invoices WHERE id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Cost invoice unavailable'; END IF;
 IF c.status IN ('internal','supplier') THEN RETURN c.journal_id; END IF;
 IF c.status<>'draft' OR c.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Cost invoice changed. Reload.' USING ERRCODE='40001'; END IF;
 rate:=resolve_effective_exchange_rate(c.currency,base,c.document_date);
 IF rate IS DISTINCT FROM p_rate THEN RAISE EXCEPTION 'Rate changed. Refresh the preview.' USING ERRCODE='40001'; END IF;
 bn:=round(c.net*rate,2);bt:=round(c.tax*rate,2);
 IF bn<=0 OR (c.tax>0 AND bt<=0) THEN RAISE EXCEPTION 'Amount converts to less than one local cent'; END IF;
 PERFORM tw_accounting_require_account(p_company,c.expense_account,'Posting','Expense','Debit');
 PERFORM tw_accounting_require_account(p_company,c.payable_account,'Control','Liability','Credit','Supplier / creator');
 IF c.tax>0 THEN PERFORM tw_accounting_require_account(p_company,c.vat_account,'Posting','Asset','Debit'); END IF;
 c.number:=tw_accounting_number(p_company,CASE WHEN c.supplier_number IS NULL THEN 'IC' ELSE 'CI' END,c.document_date);
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,automatic_source,transaction_currency,exchange_rate,exchange_rate_date)
 VALUES(j,p_company,c.document_date,c.number,c.description,auth.uid(),'cost_invoice',c.currency,rate,c.document_date);
 PERFORM tw_accounting_auto_line(j,1,c.expense_account,c.description,bn,0,c.net,0);
 IF c.tax>0 THEN PERFORM tw_accounting_auto_line(j,2,c.vat_account,'Reviewed input tax',bt,0,c.tax,0); END IF;
 PERFORM tw_accounting_auto_line(j,3,c.payable_account,c.vendor_code||' · '||c.vendor_name,0,bn+bt,0,c.net+c.tax,NULL,c.vendor_id,c.vendor_code);
 PERFORM tw_accounting_finish_receipt_journal(j);
 UPDATE tw_accounting_cost_invoices SET number=c.number,journal_id=j,exchange_rate=rate,base_net=bn,base_tax=bt,status=CASE WHEN supplier_number IS NULL THEN 'internal' ELSE 'supplier' END,version=version+1 WHERE id=c.id;
 RETURN j;
END $$;
CREATE FUNCTION tw_accounting_cost_reconcile(p_id uuid,p_company uuid,p_version integer,p_date date,p_number text,p_supplier_date date,p_net numeric,p_tax numeric,p_vat text,p_reference text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE c tw_accounting_cost_invoices%ROWTYPE; j uuid:=gen_random_uuid(); dn numeric; dt numeric; settled numeric; settled_base numeric; BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO c FROM tw_accounting_cost_invoices WHERE id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND OR c.status<>'internal' OR c.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Select the current provisional cost invoice'; END IF;
 IF p_date IS NULL OR p_number IS NULL OR p_reference IS NULL OR p_net IS NULL OR p_tax IS NULL OR p_supplier_date>(now() AT TIME ZONE 'Africa/Cairo')::date OR p_date<c.document_date OR p_date>(now() AT TIME ZONE 'Africa/Cairo')::date OR p_supplier_date IS NULL OR length(trim(p_number)) NOT BETWEEN 1 AND 120 OR length(trim(p_reference)) NOT BETWEEN 3 AND 500 OR p_net<=0 OR p_tax<0 OR p_net<>round(p_net,2) OR p_tax<>round(p_tax,2) THEN RAISE EXCEPTION 'Check supplier invoice details, amounts and adjustment date'; END IF;
 SELECT coalesce(sum(l.amount),0),coalesce(sum(l.base_amount),0) INTO settled,settled_base FROM tw_accounting_settlement_lines l JOIN tw_accounting_settlements s ON s.id=l.settlement_id WHERE l.cost_id=c.id AND s.status='posted';
 IF p_net+p_tax<settled OR round(p_net*c.exchange_rate,2)+round(p_tax*c.exchange_rate,2)<settled_base THEN RAISE EXCEPTION 'The revised invoice is below payments already settled. Reconcile those payments first.'; END IF;
 dn:=round(p_net*c.exchange_rate,2)-c.base_net;dt:=round(p_tax*c.exchange_rate,2)-c.base_tax;
 IF (p_net<>c.net AND dn=0) OR (p_tax<>c.tax AND dt=0) OR (p_net+p_tax<>c.net+c.tax AND dn+dt=0) THEN RAISE EXCEPTION 'Adjustment converts to less than one local cent'; END IF;
 IF p_tax>0 THEN PERFORM tw_accounting_require_account(p_company,p_vat,'Posting','Asset','Debit'); END IF;
 IF dn<>0 OR dt<>0 THEN
 PERFORM tw_accounting_require_account(p_company,c.expense_account,'Posting','Expense','Debit');PERFORM tw_accounting_require_account(p_company,c.payable_account,'Control','Liability','Credit','Supplier / creator');
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,automatic_source,transaction_currency,exchange_rate,exchange_rate_date) VALUES(j,p_company,p_date,c.number,'Supplier invoice reconciliation: '||trim(p_number),auth.uid(),'cost_adjustment',c.currency,c.exchange_rate,c.document_date);
 PERFORM tw_accounting_auto_line(j,1,c.expense_account,'Supplier invoice cost adjustment',greatest(dn,0),greatest(-dn,0),CASE WHEN p_net=c.net THEN NULL ELSE greatest(p_net-c.net,0) END,CASE WHEN p_net=c.net THEN NULL ELSE greatest(c.net-p_net,0) END);
 PERFORM tw_accounting_auto_line(j,2,p_vat,'Reviewed input tax',greatest(dt,0),greatest(-dt,0),greatest(p_tax-c.tax,0),greatest(c.tax-p_tax,0));
 PERFORM tw_accounting_auto_line(j,3,c.payable_account,'Supplier invoice reconciliation',greatest(-dn-dt,0),greatest(dn+dt,0),CASE WHEN p_net+p_tax=c.net+c.tax THEN NULL ELSE greatest(c.net+c.tax-p_net-p_tax,0) END,CASE WHEN p_net+p_tax=c.net+c.tax THEN NULL ELSE greatest(p_net+p_tax-c.net-c.tax,0) END,NULL,c.vendor_id,c.vendor_code);
 PERFORM tw_accounting_finish_receipt_journal(j);
 ELSE j:=c.journal_id; END IF;
 UPDATE tw_accounting_cost_invoices SET supplier_number=trim(p_number),supplier_date=p_supplier_date,supporting_reference=trim(p_reference),net=p_net,tax=p_tax,vat_account=p_vat,base_net=round(p_net*exchange_rate,2),base_tax=round(p_tax*exchange_rate,2),status='supplier',version=version+1 WHERE id=c.id;
 RETURN j;
END $$;

-- Narrow financial directories: Accounting users never need general Media access.
CREATE FUNCTION tw_accounting_parties(p_kind text,p_search text DEFAULT '') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE result jsonb; BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 IF length(p_search)>120 THEN RAISE EXCEPTION 'Search is too long'; END IF;
 IF p_kind='client' THEN SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT id,document_number code,name FROM clients WHERE document_number IS NOT NULL AND concat_ws(' ',document_number,name) ILIKE '%'||p_search||'%' ORDER BY name,id LIMIT 100)x;
 ELSIF p_kind='vendor' THEN SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM(SELECT id,document_number code,coalesce(legal_name,display_name,document_number) name FROM influencers WHERE document_number IS NOT NULL AND concat_ws(' ',document_number,legal_name,display_name) ILIKE '%'||p_search||'%' ORDER BY coalesce(legal_name,display_name),id LIMIT 100)x;
 ELSE RAISE EXCEPTION 'Choose client or vendor'; END IF; RETURN result;
END $$;

CREATE FUNCTION tw_accounting_open_items(p_company uuid,p_kind text,p_party uuid,p_currency text,p_account text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE result jsonb; BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 IF p_kind='client' THEN
 SELECT coalesce(jsonb_agg(x ORDER BY x.due NULLS LAST,x.date,x.number,x.id),'[]') INTO result FROM(
 SELECT i.id,i.document_number number,i.issue_date date,i.due_date due,i.total::text total,i.amount_paid::text settled,(i.total-i.amount_paid)::text outstanding,trim(i.currency) currency,a.account_code account
 FROM tw_accounting_invoice_submissions s JOIN invoices i ON i.id=s.invoice_id JOIN tw_accounting_journal_lines a ON a.journal_id=s.journal_id AND a.client_id=s.client_id AND a.debit>0
 WHERE s.company_id=p_company AND s.status='posted' AND i.client_id=p_party AND i.currency=p_currency AND i.status<>'void' AND i.regeneration_status::text='active' AND i.total>i.amount_paid AND (p_account IS NULL OR a.account_code=p_account) AND NOT EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=s.journal_id))x;
 ELSIF p_kind='vendor' THEN
 SELECT coalesce(jsonb_agg(x ORDER BY x.due NULLS LAST,x.date,x.number,x.id),'[]') INTO result FROM(
 SELECT c.id,c.number,c.document_date date,c.due_date due,(c.net+c.tax)::text total,coalesce(a.paid,0)::text settled,(c.net+c.tax-coalesce(a.paid,0))::text outstanding,c.currency,c.payable_account account,c.status
 FROM tw_accounting_cost_invoices c LEFT JOIN LATERAL(SELECT sum(l.amount) paid FROM tw_accounting_settlement_lines l JOIN tw_accounting_settlements s ON s.id=l.settlement_id WHERE l.cost_id=c.id AND s.status='posted')a ON true
 WHERE c.company_id=p_company AND c.vendor_id=p_party AND c.currency=p_currency AND c.status IN ('internal','supplier') AND c.net+c.tax>coalesce(a.paid,0) AND (p_account IS NULL OR c.payable_account=p_account))x;
 ELSE RAISE EXCEPTION 'Choose client or vendor'; END IF;RETURN result;
END $$;

CREATE FUNCTION tw_accounting_settlement_quote(p_value jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE company uuid:=(p_value->>'company')::uuid; party uuid:=(p_value->>'party')::uuid; kind text:=p_value->>'kind'; currency text:=p_value->>'currency'; day date:=(p_value->>'date')::date;
 amount numeric:=(p_value->>'amount')::numeric; base text; rate numeric; cash numeric; allocated numeric:=0; carrying numeric:=0; part numeric; b numeric; paid numeric; paid_base numeric; q jsonb; result jsonb:='[]'; item jsonb; c tw_accounting_cost_invoices%ROWTYPE; parent tw_accounting_settlements%ROWTYPE; used numeric; used_base numeric; adv numeric;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 IF kind NOT IN ('receipt','payment','receipt_apply','payment_apply') OR amount IS NULL OR amount<=0 OR amount<>round(amount,2) OR day IS NULL OR day>(now() AT TIME ZONE 'Africa/Cairo')::date OR jsonb_typeof(p_value->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_value->'lines')>200 THEN RAISE EXCEPTION 'Check voucher type, date, amount and allocation lines'; END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE id=company AND currency=ANY(currencies);
 IF NOT FOUND THEN RAISE EXCEPTION 'Enable the voucher currency in this company'; END IF;
 IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_value->'lines'))<>jsonb_array_length(p_value->'lines') THEN RAISE EXCEPTION 'Duplicate invoice allocation'; END IF;
 IF kind LIKE 'receipt%' THEN
 IF NOT EXISTS(SELECT 1 FROM clients WHERE id=party AND document_number IS NOT NULL) THEN RAISE EXCEPTION 'Client code unavailable'; END IF;
 PERFORM tw_accounting_require_account(company,p_value->>'control','Control','Asset','Debit','Customer');
 PERFORM tw_accounting_require_account(company,p_value->>'advance','Control','Liability','Credit','Customer');
 ELSE
 IF NOT EXISTS(SELECT 1 FROM influencers WHERE id=party AND document_number IS NOT NULL) THEN RAISE EXCEPTION 'Vendor code unavailable'; END IF;
 PERFORM tw_accounting_require_account(company,p_value->>'control','Control','Liability','Credit','Supplier / creator');
 PERFORM tw_accounting_require_account(company,p_value->>'advance','Control','Asset','Debit','Supplier / creator');
 END IF;
 IF kind LIKE '%_apply' THEN
 SELECT * INTO parent FROM tw_accounting_settlements WHERE id=(p_value->>'parent')::uuid AND company_id=company AND status='posted';
 IF NOT FOUND OR parent.parent_id IS NOT NULL OR parent.currency<>currency OR coalesce(parent.client_id,parent.vendor_id)<>party OR parent.kind||'_apply'<>kind OR parent.advance_account<>p_value->>'advance' OR day<parent.date THEN RAISE EXCEPTION 'Select an available advance for this party, currency and date'; END IF;
 SELECT coalesce(sum(s.amount),0),coalesce(sum((s.request->'quote'->>'cash')::numeric),0) INTO used,used_base FROM tw_accounting_settlements s WHERE s.parent_id=parent.id AND s.status='posted';
 IF amount>parent.advance_amount-used THEN RAISE EXCEPTION 'Allocation exceeds the available advance'; END IF;
 cash:=CASE WHEN amount=parent.advance_amount-used THEN parent.advance_base-used_base ELSE round(amount/(parent.advance_amount-used)*(parent.advance_base-used_base),2) END;rate:=parent.exchange_rate;
 ELSE
 PERFORM tw_accounting_require_account(company,p_value->>'cash','Posting','Asset','Debit');
 IF p_value->>'cash' NOT LIKE '11%' THEN RAISE EXCEPTION 'Select a cash/bank account in class 11'; END IF;
 rate:=resolve_effective_exchange_rate(currency,base,day);cash:=round(amount*rate,2);
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_value->'lines') LOOP
 part:=(item->>'amount')::numeric;
 IF part IS NULL OR part<=0 OR part<>round(part,2) THEN RAISE EXCEPTION 'Each allocation needs a positive amount with at most two decimals'; END IF;
 IF kind LIKE 'receipt%' THEN
 IF NOT EXISTS(SELECT 1 FROM invoices i JOIN tw_accounting_invoice_submissions s ON s.invoice_id=i.id WHERE i.id=(item->>'id')::uuid AND s.company_id=company AND i.client_id=party AND i.currency=currency AND i.total-i.amount_paid>=part) THEN RAISE EXCEPTION 'Invoice balance changed or belongs to another client/currency'; END IF;
 q:=tw_accounting_receipt_quote((item->>'id')::uuid,company,part,day);
 IF q->>'account'<>p_value->>'control' OR day<(q->>'minPostingDate')::date THEN RAISE EXCEPTION 'Use the invoice receivable account and a date on or after its posting'; END IF;
 b:=(q->>'receivable')::numeric;
 ELSE
 SELECT * INTO c FROM tw_accounting_cost_invoices WHERE id=(item->>'id')::uuid AND company_id=company AND vendor_id=party AND tw_accounting_cost_invoices.currency=currency AND status IN ('internal','supplier');
 IF NOT FOUND OR c.payable_account<>p_value->>'control' OR day<c.document_date THEN RAISE EXCEPTION 'Select a posted cost invoice for this vendor, currency and payable account'; END IF;
 SELECT coalesce(sum(l.amount),0),coalesce(sum(l.base_amount),0) INTO paid,paid_base FROM tw_accounting_settlement_lines l JOIN tw_accounting_settlements s ON s.id=l.settlement_id WHERE l.cost_id=c.id AND s.status='posted';
 IF part>c.net+c.tax-paid THEN RAISE EXCEPTION 'Cost invoice balance changed. Reload.' USING ERRCODE='40001'; END IF;
 b:=CASE WHEN part=c.net+c.tax-paid THEN c.base_net+c.base_tax-paid_base ELSE round(part/(c.net+c.tax-paid)*(c.base_net+c.base_tax-paid_base),2) END;
 END IF;
 IF b<=0 THEN RAISE EXCEPTION 'Allocation converts to less than one local cent'; END IF;
 allocated:=allocated+part;carrying:=carrying+b;
 result:=result||jsonb_build_array(jsonb_build_object('id',item->>'id','number',CASE WHEN kind LIKE 'receipt%' THEN (SELECT source->>'number' FROM tw_accounting_invoice_submissions WHERE invoice_id=(item->>'id')::uuid) ELSE c.number END,'amount',round(part,2)::text,'base',b::text));
 END LOOP;
 IF allocated>amount OR (kind LIKE '%_apply' AND allocated<>amount) THEN RAISE EXCEPTION 'Allocations must not exceed the voucher; advance applications must be fully allocated'; END IF;
 adv:=round((amount-allocated)*rate,2);
 IF cash<=0 OR (amount>allocated AND adv<=0) THEN RAISE EXCEPTION 'Voucher or advance converts to less than one local cent'; END IF;
 IF amount>allocated AND NOT coalesce((p_value->>'advanceRow')::boolean,false) THEN RAISE EXCEPTION 'Allocate the full amount or add an advance row (Ctrl+N)'; END IF;
 RETURN jsonb_build_object('currency',currency,'base',base,'rate',rate::text,'date',day,'amount',round(amount,2)::text,'cash',cash::text,'allocated',allocated::text,'carrying',carrying::text,'advance',round(amount-allocated,2)::text,'advanceBase',adv::text,'gain',(CASE WHEN kind LIKE 'receipt%' THEN cash-carrying-adv ELSE carrying+adv-cash END)::text,'lines',result);
END $$;

CREATE FUNCTION tw_accounting_settlement_post(p_id uuid,p_value jsonb,p_expected jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE company uuid:=(p_value->>'company')::uuid; party uuid:=(p_value->>'party')::uuid; kind text:=p_value->>'kind'; day date:=(p_value->>'date')::date; q jsonb; existing tw_accounting_settlements%ROWTYPE; parent tw_accounting_settlements%ROWTYPE; j uuid:=gen_random_uuid(); item jsonb; n integer:=0; code text; name text; number text; client uuid; vendor uuid; amount numeric; b numeric; difference numeric; account text; pay uuid; payseq bigint; advance_left numeric;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 -- Same invoice-first lock order as Media and Stage 4/5; then serialize company books.
 IF kind LIKE 'receipt%' THEN PERFORM id FROM invoices WHERE id IN(SELECT (value->>'id')::uuid FROM jsonb_array_elements(p_value->'lines')) ORDER BY id FOR UPDATE; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=company FOR UPDATE;
 SELECT * INTO existing FROM tw_accounting_settlements WHERE id=p_id;
 IF FOUND THEN IF existing.company_id<>company OR existing.request->'value' IS DISTINCT FROM p_value OR existing.status<>'posted' THEN RAISE EXCEPTION 'Request ID already used with different details'; END IF;RETURN existing.journal_id; END IF;
 q:=tw_accounting_settlement_quote(p_value);
 IF p_expected IS NULL OR q IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Balances or rate changed. Refresh the preview.' USING ERRCODE='40001'; END IF;
 IF kind LIKE 'receipt%' THEN client:=party;SELECT document_number,clients.name INTO code,name FROM clients WHERE id=party;ELSE vendor:=party;SELECT document_number,coalesce(legal_name,display_name,document_number) INTO code,name FROM influencers WHERE id=party; END IF;
 number:=tw_accounting_number(company,CASE WHEN kind LIKE '%_apply' THEN 'AL' WHEN client IS NOT NULL THEN 'RV' ELSE 'PV' END,day);
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,automatic_source,transaction_currency,exchange_rate,exchange_rate_date) VALUES(j,company,day,number,left(kind||' · '||code||' · '||coalesce(p_value->>'reference',''),1000),auth.uid(),kind,q->>'currency',(q->>'rate')::numeric,day);
 INSERT INTO tw_accounting_settlements(id,company_id,kind,client_id,vendor_id,party_code,party_name,number,date,currency,amount,exchange_rate,cash_account,control_account,advance_account,advance_amount,advance_base,parent_id,journal_id,request,created_by)
 VALUES(p_id,company,kind,client,vendor,code,name,number,day,q->>'currency',(q->>'amount')::numeric,(q->>'rate')::numeric,CASE WHEN kind NOT LIKE '%_apply' THEN p_value->>'cash' END,p_value->>'control',p_value->>'advance',(q->>'advance')::numeric,(q->>'advanceBase')::numeric,nullif(p_value->>'parent','')::uuid,j,jsonb_build_object('value',p_value,'quote',q),auth.uid());
 IF kind LIKE '%_apply' THEN SELECT * INTO parent FROM tw_accounting_settlements WHERE id=(p_value->>'parent')::uuid; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(q->'lines') LOOP
 n:=n+1;amount:=(item->>'amount')::numeric;b:=(item->>'base')::numeric;
 INSERT INTO tw_accounting_settlement_lines VALUES(p_id,n,CASE WHEN client IS NOT NULL THEN (item->>'id')::uuid END,CASE WHEN vendor IS NOT NULL THEN (item->>'id')::uuid END,amount,b);
 PERFORM tw_accounting_auto_line(j,n,p_value->>'control','Settlement · '||code,CASE WHEN vendor IS NOT NULL THEN b ELSE 0 END,CASE WHEN client IS NOT NULL THEN b ELSE 0 END,CASE WHEN vendor IS NOT NULL THEN amount ELSE 0 END,CASE WHEN client IS NOT NULL THEN amount ELSE 0 END,client,vendor,code);
 IF client IS NOT NULL THEN
 INSERT INTO document_sequences AS ds(prefix,last_value) VALUES('PAY',1) ON CONFLICT(prefix) DO UPDATE SET last_value=ds.last_value+1 RETURNING last_value INTO payseq;
 INSERT INTO payments(document_number,invoice_id,client_id,amount,currency,status,payment_method,reference_number,paid_at,notes,recorded_by,metadata)
 VALUES('PAY-'||lpad(payseq::text,greatest(6,length(payseq::text)),'0'),(item->>'id')::uuid,client,amount,q->>'currency','completed',coalesce(p_value->>'method','bank_transfer')::payment_method,number,coalesce(parent.date,day)::timestamp AT TIME ZONE 'UTC',p_value->>'reference',auth.uid(),jsonb_build_object('accounting_voucher',p_id)) RETURNING id INTO pay;
 INSERT INTO payment_allocations(payment_id,invoice_id,allocated_amount,currency_code) VALUES(pay,(item->>'id')::uuid,amount,q->>'currency');
 INSERT INTO tw_accounting_settlement_payments VALUES(pay,p_id,false);
 END IF;
 END LOOP;
 amount:=(q->>'advance')::numeric;b:=(q->>'advanceBase')::numeric;
 IF amount>0 THEN
 n:=n+1;PERFORM tw_accounting_auto_line(j,n,p_value->>'advance','Advance · '||code,CASE WHEN vendor IS NOT NULL THEN b ELSE 0 END,CASE WHEN client IS NOT NULL THEN b ELSE 0 END,CASE WHEN vendor IS NOT NULL THEN amount ELSE 0 END,CASE WHEN client IS NOT NULL THEN amount ELSE 0 END,client,vendor,code);
 IF client IS NOT NULL THEN
 INSERT INTO document_sequences AS ds(prefix,last_value) VALUES('PAY',1) ON CONFLICT(prefix) DO UPDATE SET last_value=ds.last_value+1 RETURNING last_value INTO payseq;
 INSERT INTO payments(document_number,client_id,amount,currency,status,payment_method,reference_number,paid_at,recorded_by,metadata) VALUES('PAY-'||lpad(payseq::text,greatest(6,length(payseq::text)),'0'),client,amount,q->>'currency','completed',coalesce(p_value->>'method','bank_transfer')::payment_method,number,day::timestamp AT TIME ZONE 'UTC',auth.uid(),jsonb_build_object('accounting_voucher',p_id,'original_advance_amount',amount)) RETURNING id INTO pay;
 INSERT INTO tw_accounting_settlement_payments VALUES(pay,p_id,true);
 END IF;END IF;
 n:=n+1;account:=CASE WHEN kind LIKE '%_apply' THEN p_value->>'advance' ELSE p_value->>'cash' END;amount:=(q->>'amount')::numeric;b:=(q->>'cash')::numeric;
 PERFORM tw_accounting_auto_line(j,n,account,CASE WHEN kind LIKE '%_apply' THEN 'Advance applied · '||code ELSE 'Cash / bank' END,CASE WHEN client IS NOT NULL THEN b ELSE 0 END,CASE WHEN vendor IS NOT NULL THEN b ELSE 0 END,CASE WHEN client IS NOT NULL THEN amount ELSE 0 END,CASE WHEN vendor IS NOT NULL THEN amount ELSE 0 END,CASE WHEN kind LIKE '%_apply' THEN client END,CASE WHEN kind LIKE '%_apply' THEN vendor END,code);
 difference:=(q->>'gain')::numeric;
 IF difference<>0 THEN
 account:=CASE WHEN difference>0 THEN p_value->>'gain' ELSE p_value->>'loss' END;
 PERFORM tw_accounting_require_account(company,account,'Posting',CASE WHEN difference>0 THEN 'Revenue' ELSE 'Expense' END,CASE WHEN difference>0 THEN 'Credit' ELSE 'Debit' END);
 PERFORM tw_accounting_auto_line(j,n+1,account,'Realized exchange difference',greatest(-difference,0),greatest(difference,0),NULL,NULL);
 END IF;
 PERFORM tw_accounting_finish_receipt_journal(j);
 IF client IS NOT NULL AND kind='receipt_apply' THEN
 SELECT * INTO parent FROM tw_accounting_settlements WHERE id=(p_value->>'parent')::uuid;
 SELECT parent.advance_amount-coalesce(sum(s.amount),0) INTO advance_left FROM tw_accounting_settlements s WHERE s.parent_id=parent.id AND s.status='posted';
 UPDATE payments SET amount=CASE WHEN advance_left>0 THEN advance_left ELSE payments.amount END,status=CASE WHEN advance_left>0 THEN 'completed' ELSE 'cancelled' END::payment_status,revision=revision+1 WHERE id IN(SELECT payment_id FROM tw_accounting_settlement_payments WHERE settlement_id=parent.id AND is_advance);
 END IF;
 RETURN j;
END $$;

CREATE FUNCTION tw_accounting_settlement_reverse(p_id uuid,p_company uuid,p_date date,p_reason text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,client_id,client_code,vendor_id,vendor_code) SELECT r,line_number,company_id,account_code,account_name,description,credit,debit,foreign_credit,foreign_debit,client_id,client_code,vendor_id,vendor_code FROM tw_accounting_journal_lines WHERE journal_id=j.id;
 PERFORM tw_accounting_finish_receipt_journal(r);
 UPDATE tw_accounting_settlements SET status='reversed',reversal_id=r WHERE id=s.id;
 UPDATE payments SET status='cancelled',revision=revision+1 WHERE status='completed' AND id IN(SELECT payment_id FROM tw_accounting_settlement_payments WHERE settlement_id=s.id);
 DELETE FROM payment_allocations WHERE payment_id IN(SELECT payment_id FROM tw_accounting_settlement_payments WHERE settlement_id=s.id);
 IF s.kind='receipt_apply' THEN
 SELECT p.advance_amount-coalesce((SELECT sum(amount) FROM tw_accounting_settlements WHERE parent_id=p.id AND status='posted'),0) INTO remaining FROM tw_accounting_settlements p WHERE p.id=s.parent_id;
 UPDATE payments SET amount=remaining,status='completed',revision=revision+1 WHERE id IN(SELECT payment_id FROM tw_accounting_settlement_payments WHERE settlement_id=s.parent_id AND is_advance);
 END IF;RETURN r;
END $$;

CREATE FUNCTION tw_accounting_guard_settlement_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE m tw_accounting_settlement_payments%ROWTYPE;s tw_accounting_settlements%ROWTYPE;remaining numeric;BEGIN
 SELECT * INTO m FROM tw_accounting_settlement_payments WHERE payment_id=OLD.id;IF NOT FOUND THEN IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Accounting voucher payments cannot be deleted'; END IF;
 SELECT * INTO s FROM tw_accounting_settlements WHERE id=m.settlement_id;
 IF (to_jsonb(NEW)-ARRAY['amount','status','revision','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['amount','status','revision','updated_at']) OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Correct this payment through its Accounting voucher'; END IF;
 IF s.status='reversed' AND NEW.status='cancelled' AND NEW.amount=OLD.amount THEN RETURN NEW; END IF;
 IF m.is_advance AND s.status='posted' THEN
 SELECT s.advance_amount-coalesce(sum(amount),0) INTO remaining FROM tw_accounting_settlements WHERE parent_id=s.id AND status='posted';
 IF (remaining>0 AND NEW.status='completed' AND NEW.amount=remaining AND (OLD.amount<>NEW.amount OR OLD.status<>NEW.status)) OR (remaining=0 AND NEW.status='cancelled' AND NEW.amount=OLD.amount) THEN RETURN NEW; END IF;
 END IF;RAISE EXCEPTION 'Accounting voucher payments are read-only; use allocation or reversal in TW Accounting';
END $$;
CREATE TRIGGER aa_tw_accounting_settlement_payment BEFORE UPDATE OR DELETE ON payments FOR EACH ROW EXECUTE FUNCTION tw_accounting_guard_settlement_payment();
CREATE FUNCTION tw_accounting_guard_settlement_allocation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM tw_accounting_settlement_payments m JOIN tw_accounting_settlements s ON s.id=m.settlement_id WHERE m.payment_id=OLD.payment_id AND (s.status='posted' OR TG_OP<>'DELETE')) OR TG_OP<>'DELETE' AND EXISTS(SELECT 1 FROM tw_accounting_settlement_payments WHERE payment_id=NEW.payment_id) THEN RAISE EXCEPTION 'Accounting allocations are read-only; reverse their voucher'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END $$;
CREATE TRIGGER aa_tw_accounting_settlement_allocation BEFORE INSERT OR UPDATE OR DELETE ON payment_allocations FOR EACH ROW EXECUTE FUNCTION tw_accounting_guard_settlement_allocation();

-- Public read endpoints use RLS; private helpers never grant general Media access.
REVOKE ALL ON FUNCTION tw_accounting_number(uuid,text,date),tw_accounting_require_account(uuid,text,text,text,text,text),tw_accounting_auto_line(uuid,integer,text,text,numeric,numeric,numeric,numeric,uuid,uuid,text),tw_accounting_guard_settlement_payment(),tw_accounting_guard_settlement_allocation() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION tw_accounting_cost_save(jsonb),tw_accounting_cost_post(uuid,uuid,integer,numeric),tw_accounting_cost_reconcile(uuid,uuid,integer,date,text,date,numeric,numeric,text,text),tw_accounting_parties(text,text),tw_accounting_open_items(uuid,text,uuid,text,text),tw_accounting_settlement_quote(jsonb),tw_accounting_settlement_post(uuid,jsonb,jsonb),tw_accounting_settlement_reverse(uuid,uuid,date,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_cost_save(jsonb),tw_accounting_cost_post(uuid,uuid,integer,numeric),tw_accounting_cost_reconcile(uuid,uuid,integer,date,text,date,numeric,numeric,text,text),tw_accounting_parties(text,text),tw_accounting_open_items(uuid,text,uuid,text,text),tw_accounting_settlement_quote(jsonb),tw_accounting_settlement_post(uuid,jsonb,jsonb),tw_accounting_settlement_reverse(uuid,uuid,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tw_accounting_receipt_quote(p_invoice uuid,p_company uuid,p_amount numeric,p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE i invoices%ROWTYPE; s tw_accounting_invoice_submissions%ROWTYPE; original tw_accounting_journal_lines%ROWTYPE;
 base text; rate numeric; settled numeric; settled_base numeric; carrying numeric; cash numeric;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM tw_accounting_invoice_submissions WHERE invoice_id=p_invoice AND company_id=p_company AND status='posted';
 IF NOT FOUND OR EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=s.journal_id) THEN RAISE EXCEPTION 'Select an original posted invoice'; END IF;
 SELECT * INTO i FROM invoices WHERE id=p_invoice;
 IF i.status='void' OR i.regeneration_status::text<>'active' OR p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2)
 OR p_date IS NULL OR p_date>(now() AT TIME ZONE 'Africa/Cairo')::date OR p_date<i.issue_date THEN RAISE EXCEPTION 'Enter a positive receipt and valid receipt date on or after the invoice date'; END IF;
 SELECT * INTO original FROM tw_accounting_journal_lines WHERE journal_id=s.journal_id AND client_id=s.client_id AND debit>0 ORDER BY line_number LIMIT 1;
 SELECT coalesce(sum(x.amount),0),coalesce(sum(x.base),0) INTO settled,settled_base FROM (SELECT amount,receivable_base base FROM tw_accounting_receipts WHERE invoice_id=i.id AND status='posted' UNION ALL SELECT l.amount,l.base_amount FROM tw_accounting_settlement_lines l JOIN tw_accounting_settlements v ON v.id=l.settlement_id WHERE l.invoice_id=i.id AND v.status='posted')x;
 IF settled+p_amount>i.total OR original.journal_id IS NULL THEN RAISE EXCEPTION 'Receipt exceeds the remaining Accounting receivable'; END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE id=p_company;
 rate:=resolve_effective_exchange_rate(trim(i.currency),base,p_date);
 cash:=round(p_amount*rate,2);
 -- Cumulative allocation assigns the final local cent to the last receipt.
 carrying:=round((settled+p_amount)*original.debit/i.total,2)-settled_base;
 IF cash<=0 OR carrying<=0 THEN RAISE EXCEPTION 'Receipt converts to less than one local cent'; END IF;
 RETURN jsonb_build_object('currency',trim(i.currency),'base',base,'rate',rate::text,'date',p_date,'amount',round(p_amount,2)::text,
 'cash',cash::text,'receivable',carrying::text,'gain',(cash-carrying)::text,'account',original.account_code,
 'invoiceVersion',s.version,'settled',settled::text,'settledBase',settled_base::text,'minPostingDate',(SELECT entry_date FROM tw_accounting_journals WHERE id=s.journal_id));
END $$;
CREATE OR REPLACE FUNCTION public.tw_accounting_save_journal(p_id uuid,p_company uuid,p_date date,p_reference text,p_memo text,p_version integer,p_lines jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE j tw_accounting_journals%ROWTYPE; a tw_accounting_accounts%ROWTYPE; l jsonb; n integer:=0; d numeric; c numeric;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Company not found'; END IF;
 IF p_id IS NULL OR p_date IS NULL OR p_memo IS NULL OR length(trim(p_memo)) NOT BETWEEN 3 AND 1000 OR p_reference IS NULL OR length(p_reference)>120 THEN RAISE EXCEPTION 'Date, reference and description are invalid'; END IF;
 IF jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines) NOT BETWEEN 2 AND 200 THEN RAISE EXCEPTION 'Use 2 to 200 journal lines'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_periods p JOIN tw_accounting_years y ON y.id=p.year_id WHERE y.company_id=p_company AND p_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed) THEN RAISE EXCEPTION 'Journal date must be in an open financial period'; END IF;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id FOR UPDATE;
 IF FOUND THEN
  IF j.company_id<>p_company OR j.status<>'draft' OR j.source_invoice_id IS NOT NULL OR (j.source_payment_id IS NOT NULL OR j.automatic_source IS NOT NULL) OR j.reversal_of IS NOT NULL THEN RAISE EXCEPTION 'Only an ordinary draft in this company can be edited'; END IF;
  IF p_version IS NULL OR j.version<>p_version THEN RAISE EXCEPTION 'Journal changed. Reload before editing.' USING ERRCODE='40001'; END IF;
  UPDATE tw_accounting_journals SET entry_date=p_date,reference=trim(p_reference),memo=trim(p_memo),version=version+1,updated_at=now() WHERE id=p_id;
  -- Deleting draft lines is audited by recording the prior line set on the header audit.
  INSERT INTO tw_accounting_audit(actor_id,table_name,operation,before_data,after_data)
   SELECT auth.uid(),'tw_accounting_journal_lines','REPLACE_DRAFT',jsonb_build_object('journal_id',p_id,'lines',jsonb_agg(to_jsonb(x))),jsonb_build_object('journal_id',p_id) FROM tw_accounting_journal_lines x WHERE journal_id=p_id;
  DELETE FROM tw_accounting_journal_lines WHERE journal_id=p_id;
 ELSE
  IF p_version IS NOT NULL THEN RAISE EXCEPTION 'Draft no longer exists. Reload.' USING ERRCODE='40001'; END IF;
  INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by) VALUES(p_id,p_company,p_date,trim(p_reference),trim(p_memo),auth.uid());
 END IF;
 FOR l IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  n:=n+1;
  IF coalesce(l->>'debit','') !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' OR coalesce(l->>'credit','') !~ '^[0-9]{1,12}(\.[0-9]{1,2})?$' THEN RAISE EXCEPTION 'Amounts must be nonnegative decimals with at most two decimal places'; END IF;
  d:=(l->>'debit')::numeric; c:=(l->>'credit')::numeric;
  IF NOT ((d>0 AND c=0) OR (c>0 AND d=0)) THEN RAISE EXCEPTION 'Each line must have either a debit or a credit'; END IF;
  SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=l->>'account';
  IF NOT FOUND OR NOT a.active OR a.kind<>'Posting' THEN RAISE EXCEPTION 'Use an active posting account. Control and system accounts require their dedicated workflows.'; END IF;
  INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit)
   VALUES(p_id,n,p_company,a.code,a.name,coalesce(l->>'description',''),d,c);
 END LOOP;
 RETURN p_id;
END $$;
CREATE OR REPLACE FUNCTION public.tw_accounting_cancel_journal(p_id uuid,p_company uuid,p_version integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE j tw_accounting_journals%ROWTYPE;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND OR j.status<>'draft' OR j.source_invoice_id IS NOT NULL OR (j.source_payment_id IS NOT NULL OR j.automatic_source IS NOT NULL) OR p_version IS NULL OR j.version<>p_version THEN RAISE EXCEPTION 'Only the current draft can be cancelled' USING ERRCODE='40001'; END IF;
 UPDATE tw_accounting_journals SET status='cancelled',version=version+1,updated_at=now() WHERE id=p_id;
 RETURN p_id;
END $$;
CREATE OR REPLACE FUNCTION public.tw_accounting_post_journal(p_id uuid,p_company uuid,p_version integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE j tw_accounting_journals%ROWTYPE; fiscal integer; seq bigint; d numeric; c numeric; n integer;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Journal not found'; END IF;
 IF (j.source_payment_id IS NOT NULL OR j.automatic_source IS NOT NULL) THEN RAISE EXCEPTION 'Automatic receipt journals must use Receipts & collections'; END IF;
 IF j.source_invoice_id IS NOT NULL AND j.reversal_of IS NULL THEN RAISE EXCEPTION 'Automatic journals must be posted through their source invoice'; END IF;
 IF j.status='posted' THEN RETURN p_id; END IF; -- Retry never consumes another voucher number.
 IF j.status<>'draft' OR p_version IS NULL OR j.version<>p_version THEN RAISE EXCEPTION 'Journal changed. Reload before posting.' USING ERRCODE='40001'; END IF;
 SELECT extract(year FROM y.start_date)::integer INTO fiscal FROM tw_accounting_years y JOIN tw_accounting_periods p ON p.year_id=y.id
  WHERE y.company_id=p_company AND j.entry_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed;
 IF fiscal IS NULL THEN RAISE EXCEPTION 'Journal date must be in an open financial period'; END IF;
 SELECT count(*),sum(debit),sum(credit) INTO n,d,c FROM tw_accounting_journal_lines WHERE journal_id=p_id;
 IF n<2 OR n>200 OR d IS NULL OR d<=0 OR d<>c THEN RAISE EXCEPTION 'Journal must balance: total debits must equal total credits'; END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_lines l JOIN tw_accounting_accounts a ON a.company_id=l.company_id AND a.code=l.account_code
  WHERE l.journal_id=p_id AND (l.company_id<>p_company OR (a.kind<>'Posting' AND NOT (a.kind='Control' AND a.subledger='Customer' AND j.reversal_of IS NOT NULL AND EXISTS(SELECT 1 FROM tw_accounting_invoice_submissions s JOIN tw_accounting_journal_lines original ON original.journal_id=s.journal_id AND original.line_number=l.line_number WHERE s.journal_id=j.reversal_of AND s.invoice_id=j.source_invoice_id AND s.company_id=p_company AND original.account_code=l.account_code AND original.client_id=l.client_id AND original.client_code=l.client_code AND original.debit=l.credit AND original.credit=l.debit))) OR (NOT a.active AND j.reversal_of IS NULL))) THEN RAISE EXCEPTION 'Journal contains an unavailable posting account'; END IF;
 UPDATE tw_accounting_journal_lines l SET account_name=a.name FROM tw_accounting_accounts a
  WHERE l.journal_id=p_id AND a.company_id=l.company_id AND a.code=l.account_code;
 INSERT INTO tw_accounting_journal_sequences(company_id,fiscal_year,last_number) VALUES(p_company,fiscal,1)
 ON CONFLICT(company_id,fiscal_year) DO UPDATE SET last_number=tw_accounting_journal_sequences.last_number+1 RETURNING last_number INTO seq;
 UPDATE tw_accounting_journals SET status='posted',voucher_number='JV-'||fiscal||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0'),posted_by=auth.uid(),posted_at=now(),updated_at=now(),version=version+1 WHERE id=p_id;
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
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,reversal_of,reversal_reason,created_by,source_invoice_id,transaction_currency,exchange_rate,exchange_rate_date)
 VALUES(p_reversal,p_company,p_date,j.voucher_number,'Reversal of '||j.voucher_number||': '||trim(p_reason),p_id,trim(p_reason),auth.uid(),j.source_invoice_id,j.transaction_currency,j.exchange_rate,j.exchange_rate_date);
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,client_id,client_code,foreign_debit,foreign_credit)
 SELECT p_reversal,line_number,company_id,account_code,account_name,description,credit,debit,client_id,client_code,foreign_credit,foreign_debit FROM tw_accounting_journal_lines WHERE journal_id=p_id;
 PERFORM tw_accounting_post_journal(p_reversal,p_company,1);
 RETURN p_reversal;
END $$;
CREATE OR REPLACE FUNCTION public.tw_accounting_post_receipt(p_payment uuid,p_company uuid,p_revision integer,p_post_date date,p_cash text,p_gain text,p_loss text,p_expected jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE p payments%ROWTYPE; i invoices%ROWTYPE; s tw_accounting_invoice_submissions%ROWTYPE; r tw_accounting_receipts%ROWTYPE;
 q jsonb; j uuid:=gen_random_uuid(); a tw_accounting_accounts%ROWTYPE; difference numeric; receipt_date date;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM invoices WHERE id=(SELECT invoice_id FROM payments WHERE id=p_payment) FOR UPDATE;
 SELECT * INTO p FROM payments WHERE id=p_payment FOR UPDATE;
 IF EXISTS(SELECT 1 FROM tw_accounting_settlement_payments WHERE payment_id=p_payment) THEN RAISE EXCEPTION 'This receipt is already part of an Accounting allocation voucher'; END IF;
 IF i.id IS NULL OR p.id IS NULL OR p.invoice_id<>i.id THEN RAISE EXCEPTION 'Invoice receipt unavailable'; END IF;
 SELECT * INTO s FROM tw_accounting_invoice_submissions WHERE invoice_id=i.id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice is not in this accounting company'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO r FROM tw_accounting_receipts WHERE payment_id=p_payment;
 IF FOUND THEN
  IF r.company_id<>p_company OR r.status<>'posted' THEN RAISE EXCEPTION 'Receipt is already reversed or assigned elsewhere'; END IF;
  RETURN r.journal_id;
 END IF;
 IF p_revision IS NULL OR p.revision<>p_revision THEN RAISE EXCEPTION 'Receipt changed. Reload before posting.' USING ERRCODE='40001'; END IF;
 IF p.status<>'completed' OR p.currency<>i.currency OR p.client_id<>i.client_id OR p.paid_at IS NULL
 OR p.advance_source_id IS NOT NULL OR p.advance_campaign_id IS NOT NULL OR p.metadata ? 'original_advance_amount'
 THEN RAISE EXCEPTION 'Select a completed actual invoice receipt; advance accounting is separate'; END IF;
 IF EXISTS(SELECT 1 FROM payment_allocations WHERE payment_id=p.id AND (invoice_id<>i.id OR allocated_amount<>p.amount OR currency_code<>p.currency)) THEN RAISE EXCEPTION 'Reconcile payment allocations before posting'; END IF;
 receipt_date:=(p.paid_at AT TIME ZONE 'UTC')::date;
 q:=tw_accounting_receipt_quote(i.id,p_company,p.amount,receipt_date);
 IF p_expected IS NULL OR q IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Receipt, rate or receivable changed. Refresh the preview.' USING ERRCODE='40001'; END IF;
 IF p_post_date IS NULL OR p_post_date>(now() AT TIME ZONE 'Africa/Cairo')::date OR p_post_date<receipt_date OR p_post_date<(q->>'minPostingDate')::date THEN RAISE EXCEPTION 'Posting date must be on or after the receipt and invoice posting dates, and no later than today'; END IF;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_cash;
 IF NOT FOUND OR NOT a.active OR a.kind<>'Posting' OR a.account_type<>'Asset' OR a.normal_balance<>'Debit' OR a.code NOT LIKE '11%' THEN RAISE EXCEPTION 'Select an active cash/bank posting account in class 11'; END IF;
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,source_payment_id,transaction_currency,exchange_rate,exchange_rate_date)
 VALUES(j,p_company,p_post_date,left(p.document_number,120),'Receipt '||p.document_number||' · Invoice '||i.document_number,auth.uid(),p.id,trim(p.currency),(q->>'rate')::numeric,receipt_date);
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit)
 VALUES(j,1,p_company,a.code,a.name,'Client receipt',(q->>'cash')::numeric,0,p.amount,0);
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=q->>'account';
 IF NOT FOUND OR NOT a.active OR a.kind<>'Control' OR a.subledger<>'Customer' THEN RAISE EXCEPTION 'The invoice receivable account is unavailable'; END IF;
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,client_id,client_code)
 VALUES(j,2,p_company,a.code,a.name,left(s.client_code||' · '||s.client_name,500),0,(q->>'receivable')::numeric,0,p.amount,s.client_id,s.client_code);
 difference:=(q->>'gain')::numeric;
 IF difference<>0 THEN
  SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=CASE WHEN difference>0 THEN p_gain ELSE p_loss END;
  IF NOT FOUND OR NOT a.active OR a.kind<>'Posting' OR a.account_type<>(CASE WHEN difference>0 THEN 'Revenue' ELSE 'Expense' END) OR a.normal_balance<>(CASE WHEN difference>0 THEN 'Credit' ELSE 'Debit' END) THEN RAISE EXCEPTION 'Select an active realized exchange gain/loss account'; END IF;
  INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit)
  VALUES(j,3,p_company,a.code,a.name,'Realized exchange difference',greatest(-difference,0),greatest(difference,0));
 END IF;
 PERFORM tw_accounting_finish_receipt_journal(j);
 INSERT INTO tw_accounting_receipts(payment_id,company_id,invoice_id,journal_id,status,amount,receivable_base,cash_base,payment_revision,created_by)
 VALUES(p.id,p_company,i.id,j,'posted',p.amount,(q->>'receivable')::numeric,(q->>'cash')::numeric,p.revision,auth.uid());
 RETURN j;
END $$;
CREATE OR REPLACE FUNCTION public.tw_accounting_receipts_list(p_company uuid,p_search text DEFAULT '',p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE rows jsonb; n bigint; choices jsonb;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page<0 OR p_page>100000 OR length(coalesce(p_search,''))>120 THEN RAISE EXCEPTION 'Invalid receipt filters'; END IF;
 SELECT count(*) INTO n FROM payments p JOIN tw_accounting_invoice_submissions s ON s.invoice_id=p.invoice_id
 LEFT JOIN tw_accounting_receipts r ON r.payment_id=p.id WHERE s.company_id=p_company AND NOT EXISTS(SELECT 1 FROM tw_accounting_settlement_payments WHERE payment_id=p.id) AND (p.status='completed' OR r.payment_id IS NOT NULL)
 AND concat_ws(' ',p.document_number,s.client_code,s.client_name,s.source->>'number',p.reference_number) ILIKE '%'||coalesce(p_search,'')||'%';
 SELECT coalesce(jsonb_agg(x ORDER BY x.created_at DESC,x.id),'[]') INTO rows FROM (
 SELECT p.id,p.document_number,p.invoice_id,s.source->>'number' invoice_number,s.client_code,s.client_name,p.amount::text,trim(p.currency) currency,(p.paid_at AT TIME ZONE 'UTC')::date date,p.payment_method::text method,p.reference_number reference,p.revision,
 coalesce(r.status,'unposted') status,j.voucher_number voucher,r.journal_id,r.reversal_id,rj.voucher_number reversal,p.created_at,
 (p.advance_source_id IS NOT NULL OR p.advance_campaign_id IS NOT NULL OR p.metadata ? 'original_advance_amount') advance
 FROM payments p JOIN tw_accounting_invoice_submissions s ON s.invoice_id=p.invoice_id LEFT JOIN tw_accounting_receipts r ON r.payment_id=p.id
 LEFT JOIN tw_accounting_journals j ON j.id=r.journal_id LEFT JOIN tw_accounting_journals rj ON rj.id=r.reversal_id
 WHERE s.company_id=p_company AND NOT EXISTS(SELECT 1 FROM tw_accounting_settlement_payments WHERE payment_id=p.id) AND (p.status='completed' OR r.payment_id IS NOT NULL)
 AND concat_ws(' ',p.document_number,s.client_code,s.client_name,s.source->>'number',p.reference_number) ILIKE '%'||coalesce(p_search,'')||'%'
 ORDER BY p.created_at DESC,p.id LIMIT 50 OFFSET p_page*50) x;
 SELECT coalesce(jsonb_agg(x ORDER BY x.date DESC,x.number),'[]') INTO choices FROM (
 SELECT i.id,i.document_number number,s.client_code,s.client_name,trim(i.currency) currency,i.total::text total,i.amount_paid::text paid,(i.total-i.amount_paid)::text outstanding,i.issue_date date,
 (i.total-coalesce((SELECT sum(amount) FROM tw_accounting_receipts WHERE invoice_id=i.id AND status='posted'),0))::text accounting_outstanding
 FROM tw_accounting_invoice_submissions s JOIN invoices i ON i.id=s.invoice_id
 WHERE s.company_id=p_company AND s.status='posted' AND i.status<>'void' AND i.regeneration_status::text='active'
 AND NOT EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=s.journal_id)
 AND concat_ws(' ',i.document_number,s.client_code,s.client_name) ILIKE '%'||coalesce(p_search,'')||'%'
 ORDER BY i.issue_date DESC,i.document_number LIMIT 100) x;
 RETURN jsonb_build_object('rows',rows,'count',n,'invoices',choices);
END $$;
CREATE VIEW tw_accounting_voucher_register WITH(security_invoker=true) AS
 SELECT s.*,j.voucher_number,(s.advance_amount-coalesce((SELECT sum(c.amount) FROM tw_accounting_settlements c WHERE c.parent_id=s.id AND c.status='posted'),0))::text advance_remaining FROM tw_accounting_settlements s JOIN tw_accounting_journals j ON j.id=s.journal_id;
GRANT SELECT ON tw_accounting_voucher_register TO authenticated;
CREATE FUNCTION tw_accounting_cost_fx(p_id uuid,p_company uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c tw_accounting_cost_invoices%ROWTYPE; base text; rate numeric; BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM tw_accounting_cost_invoices WHERE id=p_id AND company_id=p_company;IF NOT FOUND THEN RAISE EXCEPTION 'Cost invoice unavailable'; END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE id=p_company;
 rate:=CASE WHEN c.status='draft' THEN resolve_effective_exchange_rate(c.currency,base,c.document_date) ELSE c.exchange_rate END;
 RETURN jsonb_build_object('rate',rate::text,'base',base,'net',round(c.net*rate,2)::text,'tax',round(c.tax*rate,2)::text,'total',(round(c.net*rate,2)+round(c.tax*rate,2))::text);
END $$;
CREATE FUNCTION tw_accounting_statement(p_company uuid,p_from date,p_to date,p_account text DEFAULT NULL,p_kind text DEFAULT 'all',p_party uuid DEFAULT NULL,p_currency text DEFAULT NULL,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb; summaries jsonb;n bigint;BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_offset<0 OR p_offset>10000000 OR p_kind NOT IN ('all','client','vendor') THEN RAISE EXCEPTION 'Invalid statement filters'; END IF;
 WITH source AS(SELECT l.*,j.entry_date,j.voucher_number,j.reference,coalesce(j.transaction_currency,c.base_currency) currency FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id JOIN tw_accounting_companies c ON c.id=j.company_id WHERE j.company_id=p_company AND j.status='posted' AND j.entry_date<=p_to AND (p_account IS NULL OR l.account_code=p_account) AND (p_kind='all' OR p_kind='client' AND l.client_id IS NOT NULL AND (p_party IS NULL OR l.client_id=p_party) OR p_kind='vendor' AND l.vendor_id IS NOT NULL AND (p_party IS NULL OR l.vendor_id=p_party)) AND (p_currency IS NULL OR coalesce(j.transaction_currency,c.base_currency)=p_currency)),
 balances AS(SELECT *,sum(debit-credit) OVER(PARTITION BY account_code ORDER BY entry_date,voucher_number,journal_id,line_number ROWS UNBOUNDED PRECEDING) balance FROM source),
 rows AS(SELECT journal_id id,line_number line,account_code account,account_name name,entry_date date,voucher_number number,reference,description,coalesce(client_code,vendor_code) party,currency,debit::text,credit::text,foreign_debit::text,foreign_credit::text,balance::text FROM balances WHERE entry_date>=p_from ORDER BY account_code,entry_date,voucher_number,journal_id,line_number LIMIT 100 OFFSET p_offset)
 SELECT coalesce(jsonb_agg(rows),'[]') INTO result FROM rows;
 WITH source AS(SELECT l.*,j.entry_date FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id JOIN tw_accounting_companies c ON c.id=j.company_id WHERE j.company_id=p_company AND j.status='posted' AND j.entry_date<=p_to AND (p_account IS NULL OR l.account_code=p_account) AND (p_kind='all' OR p_kind='client' AND l.client_id IS NOT NULL AND (p_party IS NULL OR l.client_id=p_party) OR p_kind='vendor' AND l.vendor_id IS NOT NULL AND (p_party IS NULL OR l.vendor_id=p_party)) AND (p_currency IS NULL OR coalesce(j.transaction_currency,c.base_currency)=p_currency)),
 totals AS(SELECT account_code account,max(account_name) name,coalesce(sum(debit-credit) FILTER(WHERE entry_date<p_from),0)::text opening,coalesce(sum(debit) FILTER(WHERE entry_date>=p_from),0)::text debit,coalesce(sum(credit) FILTER(WHERE entry_date>=p_from),0)::text credit,sum(debit-credit)::text closing,count(*) FILTER(WHERE entry_date>=p_from) count FROM source GROUP BY account_code ORDER BY account_code)
 SELECT coalesce(jsonb_agg(totals),'[]'),coalesce(sum(count),0) INTO summaries,n FROM totals;
 RETURN jsonb_build_object('rows',result,'accounts',summaries,'count',n);
END $$;
REVOKE ALL ON FUNCTION tw_accounting_cost_fx(uuid,uuid),tw_accounting_statement(uuid,date,date,text,text,uuid,text,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_cost_fx(uuid,uuid),tw_accounting_statement(uuid,date,date,text,text,uuid,text,integer) TO authenticated;
COMMIT;
