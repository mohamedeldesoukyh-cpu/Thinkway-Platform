BEGIN;
ALTER TABLE tw_accounting_accounts ADD COLUMN auxiliary_source_code text,ADD CONSTRAINT tw_accounting_auxiliary_source_fk FOREIGN KEY(company_id,auxiliary_source_code) REFERENCES tw_accounting_accounts(company_id,code),ADD CONSTRAINT tw_accounting_auxiliary_source_not_self CHECK(auxiliary_source_code IS NULL OR auxiliary_source_code<>code);
CREATE OR REPLACE FUNCTION tw_accounting_auxiliary_account_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE source tw_accounting_accounts%ROWTYPE;
BEGIN
 PERFORM 1 FROM tw_accounting_companies WHERE id=NEW.company_id FOR UPDATE;
 IF NEW.auxiliary_source_code IS NOT NULL THEN
  IF NOT NEW.has_auxiliary OR NEW.code=NEW.auxiliary_source_code THEN RAISE EXCEPTION 'Choose another account that owns an auxiliary list';END IF;
  SELECT * INTO source FROM tw_accounting_accounts WHERE company_id=NEW.company_id AND code=NEW.auxiliary_source_code;
  IF NOT FOUND OR NOT source.active OR NOT source.has_auxiliary OR source.auxiliary_source_code IS NOT NULL OR source.kind<>NEW.kind OR source.subledger IS DISTINCT FROM NEW.subledger THEN RAISE EXCEPTION 'The source must be an active compatible account owning its auxiliary list; shared chains are not allowed';END IF;
  IF EXISTS(SELECT 1 FROM tw_accounting_auxiliaries WHERE company_id=NEW.company_id AND account_code=NEW.code) THEN RAISE EXCEPTION 'This account owns auxiliary records. Keep its own list or use another account for sharing';END IF;
 END IF;
 IF TG_OP='UPDATE' AND (NEW.has_auxiliary,NEW.auxiliary_source_code,NEW.active,NEW.kind,NEW.subledger) IS DISTINCT FROM (OLD.has_auxiliary,OLD.auxiliary_source_code,OLD.active,OLD.kind,OLD.subledger) AND EXISTS(SELECT 1 FROM tw_accounting_accounts WHERE company_id=OLD.company_id AND auxiliary_source_code=OLD.code) THEN RAISE EXCEPTION 'Other GL accounts share this auxiliary list. Update their configuration first';END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=NEW.company_id FOR UPDATE;
 IF NEW.kind='Control' AND NEW.subledger IN('Customer','Supplier / creator') AND NEW.has_auxiliary THEN RAISE EXCEPTION 'Client and vendor accounts cannot have auxiliaries'; END IF;
 IF NEW.client_id IS NOT NULL AND (NEW.kind<>'Control' OR NEW.subledger<>'Customer') OR NEW.vendor_id IS NOT NULL AND (NEW.kind<>'Control' OR NEW.subledger<>'Supplier / creator') THEN RAISE EXCEPTION 'Choose the matching client or vendor account type'; END IF;
 IF TG_OP='UPDATE' AND (NEW.client_id,NEW.vendor_id) IS DISTINCT FROM (OLD.client_id,OLD.vendor_id) AND EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE company_id=OLD.company_id AND account_code=OLD.code) THEN RAISE EXCEPTION 'Move all transactions out before changing the linked client or vendor'; END IF;
 IF NEW.kind NOT IN('Posting','Control') AND NEW.has_auxiliary THEN RAISE EXCEPTION 'Only detail accounts can have auxiliaries'; END IF;
 IF TG_OP='UPDATE' AND (NEW.has_auxiliary,NEW.subledger,NEW.auxiliary_source_code) IS DISTINCT FROM(OLD.has_auxiliary,OLD.subledger,OLD.auxiliary_source_code) THEN
 PERFORM 1 FROM tw_accounting_companies WHERE id=OLD.company_id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE company_id=OLD.company_id AND account_code=OLD.code) THEN RAISE EXCEPTION 'Move all transactions out of this account before changing auxiliary settings'; END IF;
 IF NEW.subledger IS DISTINCT FROM OLD.subledger AND EXISTS(SELECT 1 FROM tw_accounting_auxiliaries WHERE company_id=OLD.company_id AND account_code=OLD.code) THEN RAISE EXCEPTION 'Existing auxiliaries keep their client/vendor directory type; use a new account for a different directory'; END IF;
 END IF;RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION tw_accounting_auxiliary_line_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a tw_accounting_accounts%ROWTYPE;x tw_accounting_auxiliaries%ROWTYPE;reversing boolean;BEGIN
 SELECT reversal_of IS NOT NULL INTO reversing FROM tw_accounting_journals WHERE id=NEW.journal_id;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=NEW.company_id AND code=NEW.account_code;
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
END $$;
CREATE OR REPLACE FUNCTION tw_accounting_auxiliary_link(p_company uuid,p_account text,p_client uuid DEFAULT NULL,p_vendor uuid DEFAULT NULL,p_name text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a tw_accounting_accounts%ROWTYPE;aux uuid;n bigint;label text;BEGIN
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_account;
 IF NOT FOUND OR NOT a.active OR NOT a.has_auxiliary THEN RAISE EXCEPTION 'Select an active account with auxiliaries'; END IF;
 IF a.auxiliary_source_code IS NOT NULL THEN p_account:=a.auxiliary_source_code;SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_account;END IF;
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
CREATE OR REPLACE FUNCTION tw_accounting_auxiliary_save(p_company uuid,p_account text,p_id uuid,p_version integer,p_name text,p_active boolean,p_client uuid DEFAULT NULL,p_vendor uuid DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 p_account:=coalesce((SELECT auxiliary_source_code FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_account),p_account);
 IF p_id IS NULL THEN RETURN tw_accounting_auxiliary_link(p_company,p_account,p_client,p_vendor,p_name); END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 IF p_active IS NULL OR length(trim(coalesce(p_name,''))) NOT BETWEEN 1 AND 150 THEN RAISE EXCEPTION 'Auxiliary name and status required'; END IF;
 UPDATE tw_accounting_auxiliaries SET name=trim(p_name),active=p_active,version=version+1 WHERE id=p_id AND company_id=p_company AND account_code=p_account AND version=p_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Auxiliary changed. Reload.' USING ERRCODE='40001'; END IF;RETURN p_id;
END $$;
CREATE OR REPLACE FUNCTION tw_accounting_auxiliary_save_numbered(p_company uuid,p_account text,p_id uuid,p_version integer,p_name text,p_active boolean,p_client uuid,p_vendor uuid,p_number bigint) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a tw_accounting_accounts%ROWTYPE; existing tw_accounting_auxiliaries%ROWTYPE; label text; n bigint; result uuid;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_account;
 IF NOT FOUND OR NOT a.active OR NOT a.has_auxiliary THEN RAISE EXCEPTION 'Select an active account with auxiliaries';END IF;
 p_account:=coalesce(a.auxiliary_source_code,p_account);
 IF p_number IS NOT NULL AND (p_number<1 OR p_number>2147483647) THEN RAISE EXCEPTION 'Auxiliary number must be a whole number between 1 and 2147483647'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO existing FROM tw_accounting_auxiliaries WHERE id=p_id AND company_id=p_company AND account_code=p_account;
  IF p_number IS NOT NULL AND p_number IS DISTINCT FROM existing.number THEN RAISE EXCEPTION 'Choose the auxiliary number before adding it; saved numbers cannot be changed'; END IF;
  RETURN tw_accounting_auxiliary_save(p_company,p_account,p_id,p_version,p_name,p_active,p_client,p_vendor);
 END IF;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_account;
 IF NOT FOUND OR NOT a.active OR NOT a.has_auxiliary THEN RAISE EXCEPTION 'Select an active account with auxiliaries'; END IF;
 IF a.kind='Control' AND a.subledger='Customer' THEN
  SELECT name INTO label FROM clients WHERE id=p_client;
  IF label IS NULL OR p_vendor IS NOT NULL THEN RAISE EXCEPTION 'Client required for this auxiliary'; END IF;
  SELECT * INTO existing FROM tw_accounting_auxiliaries WHERE company_id=p_company AND account_code=p_account AND client_id=p_client;
 ELSIF a.kind='Control' AND a.subledger='Supplier / creator' THEN
  SELECT coalesce(legal_name,display_name,document_number) INTO label FROM influencers WHERE id=p_vendor;
  IF label IS NULL OR p_client IS NOT NULL THEN RAISE EXCEPTION 'Vendor required for this auxiliary'; END IF;
  SELECT * INTO existing FROM tw_accounting_auxiliaries WHERE company_id=p_company AND account_code=p_account AND vendor_id=p_vendor;
 ELSE
  IF p_client IS NOT NULL OR p_vendor IS NOT NULL OR length(trim(coalesce(p_name,''))) NOT BETWEEN 1 AND 150 THEN RAISE EXCEPTION 'Enter the auxiliary name'; END IF;
  label:=trim(p_name);
 END IF;
 IF existing.id IS NOT NULL THEN RAISE EXCEPTION 'This client or vendor already has auxiliary % under this account',existing.number; END IF;
 IF p_number IS NOT NULL AND EXISTS(SELECT 1 FROM tw_accounting_auxiliaries WHERE company_id=p_company AND account_code=p_account AND number=p_number) THEN RAISE EXCEPTION 'Auxiliary number % is already used under this account',p_number; END IF;
 INSERT INTO tw_accounting_auxiliary_sequences AS s VALUES(p_company,p_account,coalesce(p_number,1)) ON CONFLICT(company_id,account_code) DO UPDATE SET last_number=CASE WHEN p_number IS NULL THEN s.last_number+1 ELSE greatest(s.last_number,p_number) END RETURNING last_number INTO n;
 INSERT INTO tw_accounting_auxiliaries(company_id,account_code,number,name,client_id,vendor_id) VALUES(p_company,p_account,coalesce(p_number,n),label,p_client,p_vendor) RETURNING id INTO result;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION tw_accounting_move_accounts(p_id uuid,p_company uuid,p_source text,p_destination text,p_auxiliary uuid,p_all boolean,p_lines jsonb,p_expected_count integer,p_reason text,p_snapshot text DEFAULT NULL) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
 IF dst.has_auxiliary AND dst.kind='Posting' AND NOT EXISTS(SELECT 1 FROM tw_accounting_auxiliaries WHERE id=p_auxiliary AND company_id=p_company AND account_code=coalesce(dst.auxiliary_source_code,p_destination) AND active AND client_id IS NULL AND vendor_id IS NULL) THEN RAISE EXCEPTION 'Choose the destination auxiliary'; END IF;
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
CREATE OR REPLACE FUNCTION tw_accounting_mapping_save(p_company uuid,p_key text,p_account text,p_auxiliary uuid,p_version integer) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE d tw_accounting_mapping_definitions%ROWTYPE;a tw_accounting_accounts%ROWTYPE;v integer;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO d FROM tw_accounting_mapping_definitions WHERE key=p_key;IF NOT FOUND THEN RAISE EXCEPTION 'Unknown mapping'; END IF;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_account;
 IF NOT FOUND OR NOT a.active OR (a.account_type,a.normal_balance,a.kind) IS DISTINCT FROM (d.account_type,d.normal_balance,d.kind) OR a.subledger IS DISTINCT FROM d.subledger THEN RAISE EXCEPTION 'Choose an active account matching this mapping type and balance'; END IF;
 IF a.client_id IS NOT NULL OR a.vendor_id IS NOT NULL THEN RAISE EXCEPTION 'Use a general default account here; client/vendor-specific accounts are selected by their direct link'; END IF;
 IF a.has_auxiliary AND NOT EXISTS(SELECT 1 FROM tw_accounting_auxiliaries WHERE id=p_auxiliary AND company_id=p_company AND account_code=coalesce(a.auxiliary_source_code,p_account) AND active) OR NOT a.has_auxiliary AND p_auxiliary IS NOT NULL THEN RAISE EXCEPTION 'Choose a valid auxiliary for the mapped account'; END IF;
 SELECT version INTO v FROM tw_accounting_mappings WHERE company_id=p_company AND key=p_key;
 IF coalesce(v,0) IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Mapping changed. Reload before saving.' USING ERRCODE='40001'; END IF;
 INSERT INTO tw_accounting_mappings VALUES(p_company,p_key,p_account,p_auxiliary,1) ON CONFLICT(company_id,key) DO UPDATE SET account_code=excluded.account_code,auxiliary_id=excluded.auxiliary_id,version=tw_accounting_mappings.version+1;
END $$;
COMMIT;
