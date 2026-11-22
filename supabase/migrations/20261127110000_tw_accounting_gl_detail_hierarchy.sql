BEGIN;
-- Refuse to hide historical party-specific GL balances. Such installations require a reviewed reclassification first.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_lines l JOIN tw_accounting_accounts a ON a.company_id=l.company_id AND a.code=l.account_code WHERE a.client_id IS NOT NULL OR a.vendor_id IS NOT NULL) THEN RAISE EXCEPTION 'Legacy party GL transactions require reviewed reclassification before this migration';END IF;
END $$;
-- Existing GLs, aliases, journals and balances are retained. No financial records are rewritten.
CREATE OR REPLACE FUNCTION public.tw_accounting_auxiliary_line_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE a tw_accounting_accounts%ROWTYPE;x tw_accounting_auxiliaries%ROWTYPE;reversing boolean;BEGIN
 SELECT reversal_of IS NOT NULL INTO reversing FROM tw_accounting_journals WHERE id=NEW.journal_id;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=NEW.company_id AND code=NEW.account_code;
 IF a.kind='Group' THEN RAISE EXCEPTION 'Main accounts cannot receive journal lines';END IF;
 IF (a.client_id IS NOT NULL OR a.vendor_id IS NOT NULL) AND NOT coalesce(reversing,false) AND TG_OP='INSERT' THEN RAISE EXCEPTION 'Choose the GL account and select this Third Party in Auxiliary';END IF;
 IF a.kind='Control' AND a.subledger='Customer' AND (NEW.client_id IS NULL OR NEW.vendor_id IS NOT NULL) OR a.kind='Control' AND a.subledger='Supplier / creator' AND (NEW.vendor_id IS NULL OR NEW.client_id IS NOT NULL) THEN RAISE EXCEPTION 'The account requires its Third Party in Auxiliary';END IF;
 IF a.client_id IS NOT NULL AND NEW.client_id IS DISTINCT FROM a.client_id THEN RAISE EXCEPTION 'This account belongs to a different client'; END IF;
 IF a.vendor_id IS NOT NULL AND NEW.vendor_id IS DISTINCT FROM a.vendor_id THEN RAISE EXCEPTION 'This account belongs to a different vendor'; END IF;
 IF NOT a.has_auxiliary THEN IF NEW.auxiliary_id IS NOT NULL THEN RAISE EXCEPTION 'This account has no auxiliaries'; END IF;RETURN NEW;END IF;
 IF a.kind='Control' AND a.subledger IN('Customer','Supplier / creator') AND NOT(coalesce(reversing,false) AND NEW.auxiliary_id IS NOT NULL) THEN
 NEW.auxiliary_id:=tw_accounting_auxiliary_link(NEW.company_id,NEW.account_code,NEW.client_id,NEW.vendor_id);
 END IF;
 IF NEW.auxiliary_id IS NULL AND a.kind='Posting' THEN NEW.auxiliary_id:=nullif(coalesce(nullif(current_setting('tw.accounting_auxiliaries',true),''),'{}')::jsonb->>NEW.account_code,'')::uuid; END IF;
 SELECT * INTO x FROM tw_accounting_auxiliaries WHERE id=NEW.auxiliary_id AND company_id=NEW.company_id AND account_code=coalesce(a.auxiliary_source_code,NEW.account_code);
 IF NOT FOUND OR (NOT x.active AND NOT coalesce(reversing,false)) THEN RAISE EXCEPTION 'Select an active auxiliary under this account'; END IF;
 RETURN NEW;
END $function$
;

CREATE OR REPLACE FUNCTION public.tw_accounting_save_entry(p_id uuid, p_company uuid, p_date date, p_reference text, p_memo text, p_version integer, p_kind text, p_lines jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 IF NOT FOUND OR NOT a.active OR a.kind NOT IN('Posting','Control') OR a.client_id IS NOT NULL OR a.vendor_id IS NOT NULL THEN RAISE EXCEPTION 'Select an active GL account, not a main account or Third Party alias.'; END IF;
 IF a.subledger='Supplier / creator' AND nullif(l->>'vendorId','') IS NOT NULL AND NOT tw_accounting_worked_vendor(nullif(l->>'vendorId','')::uuid) THEN RAISE EXCEPTION 'Choose a vendor used in Media assignments';END IF;
 IF p_kind='expense' THEN
 IF d>0 AND a.account_type<>'Expense' THEN RAISE EXCEPTION 'Debit lines in Expenses must use expense accounts'; END IF;
 IF a.account_type='Expense' AND d>0 THEN expense_count:=expense_count+1; END IF;
 END IF;
 IF a.kind='Control' AND a.subledger='Customer' AND (nullif(l->>'clientId','') IS NULL OR nullif(l->>'vendorId','') IS NOT NULL) OR a.kind='Control' AND a.subledger='Supplier / creator' AND (nullif(l->>'vendorId','') IS NULL OR nullif(l->>'clientId','') IS NOT NULL) THEN RAISE EXCEPTION 'Select the required Third Party in Auxiliary'; END IF;
 IF (a.kind<>'Control' OR a.subledger NOT IN('Customer','Supplier / creator')) AND (nullif(l->>'clientId','') IS NOT NULL OR nullif(l->>'vendorId','') IS NOT NULL) THEN RAISE EXCEPTION 'This account uses auxiliaries, not Third Parties'; END IF;
 parent:=nullif(l->>'parentAccount','');
 IF parent IS NOT NULL AND NOT EXISTS(WITH RECURSIVE ancestors AS(SELECT code,parent_code,kind FROM tw_accounting_accounts WHERE company_id=p_company AND code=a.code UNION ALL SELECT x.code,x.parent_code,x.kind FROM tw_accounting_accounts x JOIN ancestors y ON x.code=y.parent_code WHERE x.company_id=p_company)SELECT 1 FROM ancestors WHERE code=parent AND kind='Group') THEN RAISE EXCEPTION 'Auxiliary account must belong to the selected parent account'; END IF;
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,line_currency,line_rate,parent_account,auxiliary_id,client_id,vendor_id,client_code,vendor_code) VALUES(p_id,n,p_company,a.code,a.name,left(coalesce(l->>'description',''),500),d,cr,fd,fc,currency,rate,parent,nullif(l->>'auxiliaryId','')::uuid,nullif(l->>'clientId','')::uuid,nullif(l->>'vendorId','')::uuid,(SELECT document_number FROM clients WHERE id=nullif(l->>'clientId','')::uuid),(SELECT document_number FROM influencers WHERE id=nullif(l->>'vendorId','')::uuid));
 sumd:=sumd+d;sumc:=sumc+cr;
 END LOOP;
 IF sumd<=0 OR sumd<>sumc THEN RAISE EXCEPTION 'Journal must balance in local currency before saving'; END IF;
 IF p_kind='expense' AND expense_count=0 THEN RAISE EXCEPTION 'An expense debit line is required'; END IF;
 UPDATE tw_accounting_journals SET transaction_currency=(SELECT CASE WHEN count(DISTINCT line_currency)=1 THEN min(line_currency) END FROM tw_accounting_journal_lines WHERE journal_id=p_id),exchange_rate=(SELECT CASE WHEN count(DISTINCT line_currency)=1 THEN min(line_rate) END FROM tw_accounting_journal_lines WHERE journal_id=p_id),exchange_rate_date=p_date WHERE id=p_id;
 RETURN p_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.tw_accounting_post_journal(p_id uuid, p_company uuid, p_version integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 IF (j.status<>'draft' AND NOT(j.status IN('pending','cancelled') AND j.resume_status='posted')) OR p_version IS NULL OR j.version<>p_version THEN RAISE EXCEPTION 'Journal changed. Reload before posting.' USING ERRCODE='40001'; END IF;
 SELECT extract(year FROM y.start_date)::integer INTO fiscal FROM tw_accounting_years y JOIN tw_accounting_periods p ON p.year_id=y.id
  WHERE y.company_id=p_company AND j.entry_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed;
 IF fiscal IS NULL THEN RAISE EXCEPTION 'Journal date must be in an open financial period'; END IF;
 SELECT count(*),sum(debit),sum(credit) INTO n,d,c FROM tw_accounting_journal_lines WHERE journal_id=p_id;
 IF n<2 OR n>200 OR d IS NULL OR d<=0 OR d<>c THEN RAISE EXCEPTION 'Journal must balance: total debits must equal total credits'; END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_lines l JOIN tw_accounting_accounts a ON a.company_id=l.company_id AND a.code=l.account_code
  WHERE l.journal_id=p_id AND (l.company_id<>p_company OR (a.kind NOT IN('Posting','Control') OR a.client_id IS NOT NULL OR a.vendor_id IS NOT NULL) OR (NOT a.active AND j.reversal_of IS NULL))) THEN RAISE EXCEPTION 'Journal contains an unavailable posting account'; END IF;
 UPDATE tw_accounting_journal_lines l SET account_name=a.name FROM tw_accounting_accounts a
  WHERE l.journal_id=p_id AND a.company_id=l.company_id AND a.code=l.account_code;
 IF j.voucher_number IS NULL THEN
 INSERT INTO tw_accounting_journal_sequences(company_id,fiscal_year,last_number) VALUES(p_company,fiscal,1)
 ON CONFLICT(company_id,fiscal_year) DO UPDATE SET last_number=tw_accounting_journal_sequences.last_number+1 RETURNING last_number INTO seq;
 END IF;
 UPDATE tw_accounting_journals SET status='posted',resume_status=NULL,voucher_number=coalesce(j.voucher_number,'JV-'||fiscal||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0')),posted_by=coalesce(j.posted_by,auth.uid()),posted_at=coalesce(j.posted_at,now()),updated_at=now(),version=version+1 WHERE id=p_id;
 RETURN p_id;
END $function$
;

CREATE OR REPLACE FUNCTION public.tw_accounting_reverse_journal(p_id uuid, p_company uuid, p_reversal uuid, p_date date, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,client_id,client_code,vendor_id,vendor_code,foreign_debit,foreign_credit,line_currency,line_rate,parent_account,auxiliary_id)
 SELECT p_reversal,line_number,company_id,account_code,account_name,description,credit,debit,client_id,client_code,vendor_id,vendor_code,foreign_credit,foreign_debit,line_currency,line_rate,parent_account,auxiliary_id FROM tw_accounting_journal_lines WHERE journal_id=p_id;
 PERFORM tw_accounting_post_journal(p_reversal,p_company,1);
 RETURN p_reversal;
END $function$
;

CREATE OR REPLACE FUNCTION public.tw_accounting_schedule_action(p_company uuid, p_action text, p_value jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_variable
DECLARE s tw_accounting_schedules%ROWTYPE;j tw_accounting_journals%ROWTYPE;id uuid:=(p_value->>'id')::uuid;result uuid;ls jsonb;l jsonb;rate numeric;base text;d numeric;cr numeric;nextday date;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE tw_accounting_companies.id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Company unavailable'; END IF;
 IF p_action='create' THEN
  SELECT * INTO j FROM tw_accounting_journals WHERE tw_accounting_journals.id=(p_value->>'source')::uuid AND company_id=p_company;
  IF NOT FOUND OR j.version IS DISTINCT FROM (p_value->>'sourceVersion')::integer OR j.status NOT IN('draft','posted') OR j.reversal_of IS NOT NULL OR j.source_invoice_id IS NOT NULL OR j.source_payment_id IS NOT NULL OR j.automatic_source IS NOT NULL OR j.workflow<>'general' OR j.control_locked THEN RAISE EXCEPTION 'Select an unlocked current ordinary manual journal'; END IF;
  IF p_value->>'kind'='reversal' AND (j.status<>'posted' OR EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=j.id)) THEN RAISE EXCEPTION 'Select an unreversed posted manual journal'; END IF;
  IF (p_value->>'date')::date<j.entry_date THEN RAISE EXCEPTION 'Schedule cannot start before its source journal'; END IF;
  SELECT jsonb_agg(jsonb_build_object('account',account_code,'clientId',client_id,'vendorId',vendor_id,'description',description,'auxiliaryId',auxiliary_id,'lineCurrency',coalesce(line_currency,base),'foreignDebit',coalesce(foreign_debit,debit)::text,'foreignCredit',coalesce(foreign_credit,credit)::text) ORDER BY line_number) INTO ls FROM tw_accounting_journal_lines WHERE journal_id=j.id;
  INSERT INTO tw_accounting_schedules(id,company_id,kind,source_id,name,anchor_date,next_date,end_date,interval_months,lines,entry_kind,memo,reference,created_by)
  VALUES(id,p_company,p_value->>'kind',j.id,trim(p_value->>'name'),(p_value->>'date')::date,(p_value->>'date')::date,nullif(p_value->>'end','')::date,coalesce((p_value->>'months')::integer,1),ls,j.entry_kind,j.memo,j.reference,auth.uid());
  RETURN id;
 END IF;
 SELECT * INTO s FROM tw_accounting_schedules WHERE tw_accounting_schedules.id=id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Schedule unavailable'; END IF;
 IF p_action='run' THEN
  SELECT journal_id INTO result FROM tw_accounting_schedule_runs WHERE schedule_id=id AND due_date=(p_value->>'date')::date;
  IF FOUND THEN RETURN result; END IF;
 END IF;
 IF s.version IS DISTINCT FROM (p_value->>'version')::integer THEN RAISE EXCEPTION 'Schedule changed. Refresh.' USING ERRCODE='40001'; END IF;
 IF p_action='toggle' THEN
  IF s.kind='reversal' AND s.occurrence>0 THEN RAISE EXCEPTION 'Completed reversals cannot be resumed'; END IF;
  UPDATE tw_accounting_schedules SET active=NOT active,version=version+1 WHERE tw_accounting_schedules.id=id;RETURN id;
 END IF;
 IF p_action IS DISTINCT FROM 'run' OR NOT s.active OR (p_value->>'date')::date IS DISTINCT FROM s.next_date OR s.next_date>(now() AT TIME ZONE 'Africa/Cairo')::date OR s.end_date IS NOT NULL AND s.next_date>s.end_date THEN RAISE EXCEPTION 'Select an active due occurrence'; END IF;
 result:=gen_random_uuid();
 IF s.kind='reversal' THEN
  result:=tw_accounting_reverse_journal(s.source_id,p_company,result,s.next_date,'Scheduled reversal: '||s.name);
 ELSE
  ls:='[]';
  FOR l IN SELECT value FROM jsonb_array_elements(s.lines) LOOP
   rate:=resolve_effective_exchange_rate(l->>'lineCurrency',base,s.next_date);
   d:=round((l->>'foreignDebit')::numeric*rate,2);cr:=round((l->>'foreignCredit')::numeric*rate,2);
   ls:=ls||jsonb_build_array(l||jsonb_build_object('lineRate',rate::text,'debit',d::text,'credit',cr::text));
  END LOOP;
  PERFORM tw_accounting_save_entry(result,p_company,s.next_date,s.reference,s.memo,NULL,s.entry_kind,ls);
 END IF;
 INSERT INTO tw_accounting_schedule_runs(schedule_id,due_date,journal_id,company_id) VALUES(id,s.next_date,result,p_company);
 nextday:=(s.anchor_date+make_interval(months=>s.interval_months*(s.occurrence+1)))::date;
 UPDATE tw_accounting_schedules SET occurrence=occurrence+1,next_date=nextday,active=(kind='recurring' AND (end_date IS NULL OR nextday<=end_date)),version=version+1 WHERE tw_accounting_schedules.id=id;
 RETURN result;
END $function$
;

CREATE OR REPLACE FUNCTION tw_accounting_statement_filtered(p_company uuid,p_from date,p_to date,p_account text DEFAULT NULL,p_kind text DEFAULT 'all',p_party uuid DEFAULT NULL,p_currency text DEFAULT NULL,p_offset integer DEFAULT 0,p_auxiliary uuid DEFAULT NULL,p_options jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE result jsonb;display text:=coalesce(p_options->>'display','local');account_status text:=coalesce(p_options->>'accountStatus','all');types text[];BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_offset<0 OR p_offset>10000000 OR p_kind NOT IN('all','client','vendor') OR display NOT IN('local','USD','foreign') OR account_status NOT IN('all','active','inactive') THEN RAISE EXCEPTION 'Select valid statement filters';END IF;
 IF p_account IS NOT NULL AND p_account !~ '^([0-9]{1,6})(,[0-9]{1,6}){0,19}$' THEN RAISE EXCEPTION 'Enter up to 20 valid account codes';END IF;
 SELECT array_agg(value) INTO types FROM jsonb_array_elements_text(coalesce(p_options->'types','[]'));
 IF EXISTS(SELECT 1 FROM unnest(types) t WHERE t NOT IN('journal','receipt','payment','invoice','cost','expense','transfer','opening')) THEN RAISE EXCEPTION 'Invalid transaction type';END IF;
 WITH RECURSIVE scope AS(SELECT code FROM tw_accounting_accounts WHERE company_id=p_company AND EXISTS(SELECT 1 FROM unnest(string_to_array(p_account,',')) prefix WHERE code LIKE prefix||'%') UNION SELECT a.code FROM tw_accounting_accounts a JOIN scope s ON a.parent_code=s.code WHERE a.company_id=p_company),source AS MATERIALIZED(
 SELECT l.journal_id,l.line_number,l.account_code,l.account_name,l.description,l.auxiliary_id,coalesce(l.auxiliary_id,l.client_id,l.vendor_id) detail_id,coalesce((SELECT number::text||' · '||name FROM tw_accounting_auxiliaries WHERE id=l.auxiliary_id),(SELECT coalesce(nullif(legal_name,''),name) FROM clients WHERE id=l.client_id),(SELECT coalesce(nullif(legal_name,''),display_name) FROM influencers WHERE id=l.vendor_id)) detail_name,l.client_code,l.vendor_code,l.foreign_debit,l.foreign_credit,j.entry_date,j.voucher_number,j.reference,
 coalesce(l.line_currency,j.transaction_currency,c.base_currency) currency,CASE display WHEN 'foreign' THEN coalesce(l.line_currency,j.transaction_currency,c.base_currency) WHEN 'USD' THEN 'USD' ELSE c.base_currency END report_currency,
 CASE display WHEN 'foreign' THEN coalesce(l.foreign_debit,l.debit) WHEN 'USD' THEN CASE WHEN coalesce(l.line_currency,j.transaction_currency,c.base_currency)='USD' THEN coalesce(l.foreign_debit,l.debit) ELSE round(l.debit/resolve_effective_exchange_rate('USD',c.base_currency,j.entry_date),2) END ELSE l.debit END debit,
 CASE display WHEN 'foreign' THEN coalesce(l.foreign_credit,l.credit) WHEN 'USD' THEN CASE WHEN coalesce(l.line_currency,j.transaction_currency,c.base_currency)='USD' THEN coalesce(l.foreign_credit,l.credit) ELSE round(l.credit/resolve_effective_exchange_rate('USD',c.base_currency,j.entry_date),2) END ELSE l.credit END credit
 FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id JOIN tw_accounting_companies c ON c.id=j.company_id JOIN tw_accounting_accounts a ON a.company_id=l.company_id AND a.code=l.account_code
 WHERE j.company_id=p_company AND j.status='posted' AND j.entry_date<=p_to AND (p_account IS NULL OR l.account_code IN(SELECT code FROM scope)) AND (p_auxiliary IS NULL OR l.auxiliary_id=p_auxiliary)
 AND (p_kind='all' OR p_kind='client' AND l.client_id IS NOT NULL AND (p_party IS NULL OR l.client_id=p_party) OR p_kind='vendor' AND l.vendor_id IS NOT NULL AND (p_party IS NULL OR l.vendor_id=p_party))
 AND (p_currency IS NULL OR coalesce(l.line_currency,j.transaction_currency,c.base_currency)=p_currency)
 AND (account_status='all' OR a.active=(account_status='active')) AND (coalesce((p_options->>'includeUnlocked')::boolean,true) OR j.control_locked)
 AND (NOT coalesce((p_options->>'excludeReversals')::boolean,false) OR j.reversal_of IS NULL)
 AND (types IS NULL OR CASE WHEN j.automatic_source LIKE 'receipt%' OR j.source_payment_id IS NOT NULL THEN 'receipt' WHEN j.automatic_source LIKE 'payment%' THEN 'payment' WHEN j.source_invoice_id IS NOT NULL THEN 'invoice' WHEN j.automatic_source LIKE 'cost%' THEN 'cost' WHEN j.workflow='transfer' THEN 'transfer' WHEN j.workflow='opening' THEN 'opening' WHEN j.entry_kind='expense' THEN 'expense' ELSE 'journal' END=ANY(types))),
 totals AS(SELECT account_code account,report_currency currency,max(account_name) name,coalesce(sum(debit-credit) FILTER(WHERE entry_date<p_from),0)::text opening,coalesce(sum(debit) FILTER(WHERE entry_date>=p_from),0)::text debit,coalesce(sum(credit) FILTER(WHERE entry_date>=p_from),0)::text credit,sum(debit-credit)::text closing,count(*) FILTER(WHERE entry_date>=p_from) count FROM source GROUP BY account_code,report_currency
 HAVING (NOT coalesce((p_options->>'skipZero')::boolean,false) OR sum(debit-credit)<>0) AND (NOT coalesce((p_options->>'skipInactivePeriod')::boolean,false) OR count(*) FILTER(WHERE entry_date>=p_from)>0)),
 auxiliary_totals AS(SELECT s.account_code account,s.report_currency currency,s.detail_id id,s.detail_name name,coalesce(sum(s.debit-s.credit) FILTER(WHERE s.entry_date<p_from),0)::text opening,coalesce(sum(s.debit) FILTER(WHERE s.entry_date>=p_from),0)::text debit,coalesce(sum(s.credit) FILTER(WHERE s.entry_date>=p_from),0)::text credit,sum(s.debit-s.credit)::text closing FROM source s JOIN totals t ON t.account=s.account_code AND t.currency=s.report_currency GROUP BY s.account_code,s.report_currency,s.detail_id,s.detail_name),
 balances AS(SELECT s.*,sum(s.debit-s.credit) OVER(PARTITION BY s.account_code,s.report_currency ORDER BY entry_date,voucher_number,journal_id,line_number ROWS UNBOUNDED PRECEDING) balance FROM source s JOIN totals t ON t.account=s.account_code AND t.currency=s.report_currency),
 rows AS(SELECT journal_id id,line_number line,account_code account,account_name name,entry_date date,voucher_number number,reference,description,b.detail_name auxiliary,coalesce(client_code,vendor_code) party,currency,report_currency,debit::text,credit::text,foreign_debit::text,foreign_credit::text,balance::text FROM balances b WHERE entry_date>=p_from ORDER BY report_currency,account_code,entry_date,voucher_number,journal_id,line_number LIMIT 100 OFFSET p_offset)
 SELECT jsonb_build_object('auxiliaries',coalesce((SELECT jsonb_agg(a) FROM auxiliary_totals a),'[]'),'rows',coalesce((SELECT jsonb_agg(r) FROM rows r),'[]'),'accounts',coalesce((SELECT jsonb_agg(t ORDER BY currency,account) FROM totals t),'[]'),'count',coalesce((SELECT sum(count) FROM totals),0),'currency',CASE display WHEN 'foreign' THEN coalesce(p_currency,'FC') WHEN 'USD' THEN 'USD' ELSE (SELECT base_currency FROM tw_accounting_companies WHERE id=p_company) END) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_statement_filtered(uuid,date,date,text,text,uuid,text,integer,uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_statement_filtered(uuid,date,date,text,text,uuid,text,integer,uuid,jsonb) TO authenticated;
-- Directory sync no longer generates a GL for each person or company.
CREATE OR REPLACE FUNCTION tw_accounting_sync_party(p_company uuid,p_kind text,p_party uuid) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result text;BEGIN
 IF p_kind='client' THEN
  IF NOT EXISTS(SELECT 1 FROM clients WHERE id=p_party) THEN RAISE EXCEPTION 'Client unavailable';END IF;
 ELSIF p_kind='vendor' THEN
  IF NOT tw_accounting_worked_vendor(p_party) THEN RETURN NULL;END IF;
 ELSE RAISE EXCEPTION 'Choose client or vendor';END IF;
 SELECT code INTO result FROM tw_accounting_accounts WHERE company_id=p_company AND active AND kind='Control' AND client_id IS NULL AND vendor_id IS NULL AND subledger=CASE WHEN p_kind='client' THEN 'Customer' ELSE 'Supplier / creator' END AND account_type=CASE WHEN p_kind='client' THEN 'Asset' ELSE 'Liability' END ORDER BY (code=CASE WHEN p_kind='client' THEN '121001' ELSE '211001' END) DESC,code LIMIT 1;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_sync_party(uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role;

-- Reuse existing directory identities and retained alias codes; no duplicate auxiliary records.
CREATE FUNCTION tw_accounting_party_lookup(p_company uuid,p_kind text,p_search text DEFAULT '',p_selected uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 IF p_kind NOT IN('client','vendor') OR length(p_search)>120 OR NOT EXISTS(SELECT 1 FROM tw_accounting_companies WHERE id=p_company) THEN RAISE EXCEPTION 'Invalid directory filters';END IF;
 WITH directory AS(
 SELECT c.id,c.document_number shared_code,coalesce(nullif(c.legal_name,''),c.name) name,c.legal_name,NULL::text username,c.name display_name FROM clients c WHERE p_kind='client'
 UNION ALL
 SELECT i.id,i.document_number,coalesce(nullif(i.legal_name,''),i.display_name,i.document_number),i.legal_name,(SELECT string_agg(DISTINCT coalesce(nullif(a.username::text,''),nullif(a.handle::text,'')),', ') FROM influencer_platform_accounts a WHERE a.influencer_id=i.id),i.display_name FROM influencers i WHERE p_kind='vendor' AND (tw_accounting_worked_vendor(i.id) OR (i.id=p_selected AND EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE company_id=p_company AND vendor_id=i.id)))
 ), labeled AS(SELECT d.*,coalesce((SELECT min(a.code) FROM tw_accounting_accounts a WHERE a.company_id=p_company AND ((p_kind='client' AND a.client_id=d.id) OR (p_kind='vendor' AND a.vendor_id=d.id))),d.shared_code) code FROM directory d)
 SELECT coalesce(jsonb_agg(r),'[]') INTO result FROM(SELECT * FROM labeled WHERE (p_selected IS NULL OR id=p_selected) AND concat_ws(' ',code,shared_code,name,username,display_name) ILIKE '%'||p_search||'%' ORDER BY name,id LIMIT 100)r;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_party_lookup(uuid,text,text,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_party_lookup(uuid,text,text,uuid) TO authenticated;

-- Keep the directory's account column pointing at a GL, not its old party alias.
DO $patch$ DECLARE definition text;old text;BEGIN
 SELECT pg_get_functiondef('tw_accounting_party_accounts(uuid,text,text,integer)'::regprocedure) INTO definition;
 old:='((p_kind=''client'' AND a.client_id=p.id AND a.account_type=''Asset'') OR(p_kind=''vendor'' AND a.vendor_id=p.id AND a.account_type=''Liability''))';
 IF position(old IN definition)=0 THEN RAISE EXCEPTION 'Unexpected party directory definition';END IF;
 definition:=replace(definition,old,'a.kind=''Control'' AND a.client_id IS NULL AND a.vendor_id IS NULL AND ((p_kind=''client'' AND a.subledger=''Customer'' AND a.account_type=''Asset'') OR(p_kind=''vendor'' AND a.subledger=''Supplier / creator'' AND a.account_type=''Liability''))');
 EXECUTE definition;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
