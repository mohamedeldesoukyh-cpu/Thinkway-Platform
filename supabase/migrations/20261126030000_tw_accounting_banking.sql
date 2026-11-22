BEGIN;
CREATE TABLE tw_accounting_banks(
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),name text NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 120),
 account_code text NOT NULL,auxiliary_id uuid REFERENCES tw_accounting_auxiliaries(id),currency text NOT NULL,bank_reference text NOT NULL DEFAULT '' CHECK(length(bank_reference)<=120),
 active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,
 FOREIGN KEY(company_id,account_code) REFERENCES tw_accounting_accounts(company_id,code)
);
CREATE UNIQUE INDEX tw_bank_gl_unique ON tw_accounting_banks(company_id,account_code,coalesce(auxiliary_id,'00000000-0000-0000-0000-000000000000'::uuid),currency);
CREATE TABLE tw_accounting_bank_statements(
 id uuid PRIMARY KEY,company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),bank_id uuid NOT NULL REFERENCES tw_accounting_banks(id),
 reference text NOT NULL CHECK(length(trim(reference)) BETWEEN 1 AND 120),from_date date NOT NULL,to_date date NOT NULL,
 opening numeric(18,2) NOT NULL,closing numeric(18,2) NOT NULL,content_hash text NOT NULL,status text NOT NULL DEFAULT 'open' CHECK(status IN('open','closed','void')),
 version integer NOT NULL DEFAULT 1,created_by uuid NOT NULL REFERENCES profiles(id),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(from_date<=to_date)
);
CREATE UNIQUE INDEX tw_bank_statement_reference ON tw_accounting_bank_statements(bank_id,reference) WHERE status<>'void';
CREATE UNIQUE INDEX tw_bank_statement_hash ON tw_accounting_bank_statements(bank_id,content_hash) WHERE status<>'void';
CREATE TABLE tw_accounting_bank_matches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),statement_id uuid NOT NULL REFERENCES tw_accounting_bank_statements(id),
 reason text NOT NULL CHECK(length(trim(reason)) BETWEEN 3 AND 500),created_by uuid NOT NULL REFERENCES profiles(id),created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE tw_accounting_bank_rows(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),statement_id uuid NOT NULL REFERENCES tw_accounting_bank_statements(id),
 row_number integer NOT NULL,entry_date date NOT NULL,reference text NOT NULL,description text NOT NULL,amount numeric(18,2) NOT NULL CHECK(amount<>0),
 match_id uuid REFERENCES tw_accounting_bank_matches(id),UNIQUE(statement_id,row_number)
);
CREATE INDEX tw_bank_rows_match ON tw_accounting_bank_rows(match_id);
CREATE TABLE tw_accounting_bank_match_lines(
 match_id uuid NOT NULL REFERENCES tw_accounting_bank_matches(id),company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),journal_id uuid NOT NULL,line_number integer NOT NULL,
 PRIMARY KEY(journal_id,line_number),FOREIGN KEY(journal_id,line_number) REFERENCES tw_accounting_journal_lines(journal_id,line_number)
);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['tw_accounting_banks','tw_accounting_bank_statements','tw_accounting_bank_matches','tw_accounting_bank_rows','tw_accounting_bank_match_lines'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('GRANT SELECT ON %I TO authenticated',t);
  EXECUTE format('CREATE POLICY accounting_read ON %I FOR SELECT TO authenticated USING ((SELECT (tw_module_access()->>''accounting'')::boolean))',t);
  EXECUTE format('CREATE TRIGGER bank_audit AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION tw_accounting_audit_change()',t);
 END LOOP;
END $$;
CREATE FUNCTION tw_accounting_bank_line_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM tw_accounting_bank_match_lines WHERE journal_id=OLD.journal_id AND line_number=OLD.line_number) AND
 (TG_OP='DELETE' OR (NEW.company_id,NEW.account_code,NEW.auxiliary_id,NEW.debit,NEW.credit,NEW.foreign_debit,NEW.foreign_credit,NEW.line_currency,NEW.line_rate) IS DISTINCT FROM (OLD.company_id,OLD.account_code,OLD.auxiliary_id,OLD.debit,OLD.credit,OLD.foreign_debit,OLD.foreign_credit,OLD.line_currency,OLD.line_rate)) THEN RAISE EXCEPTION 'Undo bank reconciliation before changing a matched journal line'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END $$;
CREATE TRIGGER tw_bank_line_guard BEFORE UPDATE OR DELETE ON tw_accounting_journal_lines FOR EACH ROW EXECUTE FUNCTION tw_accounting_bank_line_guard();
CREATE FUNCTION tw_accounting_bank_header_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF (NEW.entry_date,NEW.status,NEW.transaction_currency,NEW.company_id) IS DISTINCT FROM (OLD.entry_date,OLD.status,OLD.transaction_currency,OLD.company_id) AND EXISTS(SELECT 1 FROM tw_accounting_bank_match_lines WHERE journal_id=OLD.id) THEN RAISE EXCEPTION 'Undo bank reconciliation before changing a matched journal'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER tw_bank_header_guard BEFORE UPDATE ON tw_accounting_journals FOR EACH ROW EXECUTE FUNCTION tw_accounting_bank_header_guard();

CREATE FUNCTION tw_accounting_bank_ledger(p_bank uuid,p_to date) RETURNS TABLE(journal uuid,line integer,date date,number text,description text,amount numeric,debit numeric,credit numeric,matched uuid,cleared_date date)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT j.id,l.line_number,j.entry_date,j.voucher_number,l.description,
 CASE WHEN b.currency=c.base_currency THEN l.debit-l.credit ELSE coalesce(l.foreign_debit,0)-coalesce(l.foreign_credit,0) END,l.debit,l.credit,m.match_id,(SELECT max(br.entry_date) FROM tw_accounting_bank_rows br WHERE br.match_id=m.match_id)
 FROM tw_accounting_banks b JOIN tw_accounting_companies c ON c.id=b.company_id
 JOIN tw_accounting_journal_lines l ON l.company_id=b.company_id AND l.account_code=b.account_code AND l.auxiliary_id IS NOT DISTINCT FROM b.auxiliary_id
 JOIN tw_accounting_journals j ON j.id=l.journal_id LEFT JOIN tw_accounting_bank_match_lines m ON m.journal_id=l.journal_id AND m.line_number=l.line_number
 WHERE b.id=p_bank AND j.status='posted' AND j.entry_date<=p_to AND coalesce(l.line_currency,j.transaction_currency,c.base_currency)=b.currency;
$$;
CREATE FUNCTION tw_accounting_bank_action(p_company uuid,p_action text,p_value jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE id uuid:=(p_value->>'id')::uuid;b tw_accounting_banks%ROWTYPE;s tw_accounting_bank_statements%ROWTYPE;a tw_accounting_accounts%ROWTYPE;
 x jsonb;ls jsonb;n integer:=0;amount numeric;total numeric:=0;bank_total numeric;ledger_total numeric;g uuid;ids uuid[];currency text;aux uuid;reason text:=trim(coalesce(p_value->>'reason',''));
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE tw_accounting_companies.id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Company unavailable'; END IF;
 IF p_action='bank-save' THEN
  SELECT * INTO b FROM tw_accounting_banks WHERE tw_accounting_banks.id=id FOR UPDATE;
  IF FOUND AND (b.company_id<>p_company OR b.version IS DISTINCT FROM (p_value->>'version')::integer) THEN RAISE EXCEPTION 'Bank account changed. Reload.' USING ERRCODE='40001'; END IF;
  SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_value->>'account';
  currency:=p_value->>'currency';aux:=nullif(p_value->>'auxiliary','')::uuid;
  IF NOT FOUND OR NOT a.active OR a.kind<>'Posting' OR a.account_type<>'Asset' OR a.code NOT LIKE '11%' THEN RAISE EXCEPTION 'Choose an active cash/bank posting account'; END IF;
  IF NOT EXISTS(SELECT 1 FROM tw_accounting_companies WHERE tw_accounting_companies.id=p_company AND currency=ANY(currencies)) THEN RAISE EXCEPTION 'Choose an enabled currency'; END IF;
  IF a.has_auxiliary THEN
   IF NOT EXISTS(SELECT 1 FROM tw_accounting_auxiliaries WHERE tw_accounting_auxiliaries.id=aux AND company_id=p_company AND account_code=coalesce(a.auxiliary_source_code,a.code) AND active) THEN RAISE EXCEPTION 'Choose an active auxiliary from this account'; END IF;
  ELSIF aux IS NOT NULL THEN RAISE EXCEPTION 'This account has no auxiliaries'; END IF;
  IF b.id IS NOT NULL AND (b.account_code,b.auxiliary_id,b.currency) IS DISTINCT FROM (a.code,aux,currency) AND EXISTS(SELECT 1 FROM tw_accounting_bank_statements WHERE bank_id=id) THEN RAISE EXCEPTION 'A bank profile with statements keeps its GL, auxiliary and currency'; END IF;
  IF b.id IS NULL THEN
   INSERT INTO tw_accounting_banks(id,company_id,name,account_code,auxiliary_id,currency,bank_reference,active) VALUES(id,p_company,trim(p_value->>'name'),a.code,aux,currency,coalesce(p_value->>'reference',''),coalesce((p_value->>'active')::boolean,true));
  ELSE UPDATE tw_accounting_banks SET name=trim(p_value->>'name'),account_code=a.code,auxiliary_id=aux,currency=currency,bank_reference=coalesce(p_value->>'reference',''),active=(p_value->>'active')::boolean,version=version+1 WHERE tw_accounting_banks.id=id; END IF;
  RETURN id;
 END IF;
 IF p_action='import' THEN
  SELECT * INTO b FROM tw_accounting_banks WHERE tw_accounting_banks.id=(p_value->>'bank')::uuid AND company_id=p_company AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Select an active bank account'; END IF;
  IF EXISTS(SELECT 1 FROM tw_accounting_bank_statements WHERE bank_id=b.id AND status<>'void' AND from_date<=(p_value->>'to')::date AND to_date>=(p_value->>'from')::date) THEN RAISE EXCEPTION 'A statement already covers these dates. Void an incorrect import before replacing it'; END IF;
  IF (p_value->>'opening')::numeric<>round((p_value->>'opening')::numeric,2) OR (p_value->>'closing')::numeric<>round((p_value->>'closing')::numeric,2) THEN RAISE EXCEPTION 'Balances must have at most two decimal places'; END IF;
  ls:=p_value->'rows';
  IF jsonb_typeof(ls) IS DISTINCT FROM 'array' OR jsonb_array_length(ls) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Import 1–2000 statement rows'; END IF;
  FOR x IN SELECT value FROM jsonb_array_elements(ls) LOOP
   IF coalesce(x->>'amount','') !~ '^-?[0-9]{1,12}(\.[0-9]{1,2})?$' OR (x->>'amount')::numeric=0 OR (x->>'date')::date NOT BETWEEN (p_value->>'from')::date AND (p_value->>'to')::date THEN RAISE EXCEPTION 'Check statement dates and signed amounts'; END IF;
   total:=total+(x->>'amount')::numeric;
  END LOOP;
  IF (p_value->>'opening')::numeric+total IS DISTINCT FROM (p_value->>'closing')::numeric THEN RAISE EXCEPTION 'Opening balance plus statement movements must equal closing balance'; END IF;
  INSERT INTO tw_accounting_bank_statements(id,company_id,bank_id,reference,from_date,to_date,opening,closing,content_hash,created_by)
  VALUES(id,p_company,b.id,trim(p_value->>'reference'),(p_value->>'from')::date,(p_value->>'to')::date,(p_value->>'opening')::numeric,(p_value->>'closing')::numeric,md5(jsonb_build_array(p_value->>'from',p_value->>'to',p_value->>'opening',p_value->>'closing',ls)::text),auth.uid());
  FOR x IN SELECT value FROM jsonb_array_elements(ls) LOOP
   n:=n+1;INSERT INTO tw_accounting_bank_rows(company_id,statement_id,row_number,entry_date,reference,description,amount) VALUES(p_company,id,n,(x->>'date')::date,left(coalesce(x->>'reference',''),120),left(coalesce(x->>'description',''),500),(x->>'amount')::numeric);
  END LOOP;RETURN id;
 END IF;
 SELECT * INTO s FROM tw_accounting_bank_statements WHERE tw_accounting_bank_statements.id=id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Statement unavailable'; END IF;
 IF s.version IS DISTINCT FROM (p_value->>'version')::integer THEN RAISE EXCEPTION 'Statement changed. Reload.' USING ERRCODE='40001'; END IF;
 IF length(reason) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Enter a reconciliation action reason'; END IF;
 IF s.status='void' THEN RAISE EXCEPTION 'This statement was voided'; END IF;
 IF p_action='reopen' THEN
  IF NOT coalesce((tw_module_access()->>'admin')::boolean,false) THEN RAISE EXCEPTION 'Administrator required to reopen reconciliation' USING ERRCODE='42501'; END IF;
  UPDATE tw_accounting_bank_statements SET status='open',version=version+1 WHERE tw_accounting_bank_statements.id=id;
 ELSIF s.status='closed' THEN RAISE EXCEPTION 'Reopen the reconciliation first';
 ELSIF p_action='void' THEN
  IF EXISTS(SELECT 1 FROM tw_accounting_bank_rows WHERE statement_id=id AND match_id IS NOT NULL) THEN RAISE EXCEPTION 'Undo matches before voiding an import'; END IF;
  UPDATE tw_accounting_bank_statements SET status='void',version=version+1 WHERE tw_accounting_bank_statements.id=id;
 ELSIF p_action='match' THEN
  IF jsonb_typeof(p_value->'rows') IS DISTINCT FROM 'array' OR jsonb_typeof(p_value->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_value->'rows') NOT BETWEEN 1 AND 100 OR jsonb_array_length(p_value->'lines') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Select 1–100 statement rows and GL lines'; END IF;
  SELECT array_agg(value::uuid) INTO ids FROM jsonb_array_elements_text(p_value->'rows');
  SELECT count(*),sum(r.amount) INTO n,bank_total FROM tw_accounting_bank_rows r WHERE r.id=ANY(ids) AND statement_id=id AND match_id IS NULL;
  IF n<>cardinality(ids) THEN RAISE EXCEPTION 'Statement selection changed or contains duplicates'; END IF;
  SELECT count(*),sum(l.amount) INTO n,ledger_total FROM tw_accounting_bank_ledger(s.bank_id,s.to_date) l WHERE l.matched IS NULL AND EXISTS(SELECT 1 FROM jsonb_array_elements(p_value->'lines') chosen WHERE (chosen->>'journal')::uuid=l.journal AND (chosen->>'line')::integer=l.line);
  IF n<>jsonb_array_length(p_value->'lines') OR bank_total IS DISTINCT FROM ledger_total THEN RAISE EXCEPTION 'Selected statement and GL amounts must match in bank currency'; END IF;
  INSERT INTO tw_accounting_bank_matches(company_id,statement_id,reason,created_by) VALUES(p_company,id,reason,auth.uid()) RETURNING tw_accounting_bank_matches.id INTO g;
  UPDATE tw_accounting_bank_rows SET match_id=g WHERE tw_accounting_bank_rows.id=ANY(ids);
  INSERT INTO tw_accounting_bank_match_lines(match_id,company_id,journal_id,line_number) SELECT g,p_company,(chosen->>'journal')::uuid,(chosen->>'line')::integer FROM jsonb_array_elements(p_value->'lines') chosen;
  UPDATE tw_accounting_bank_statements SET version=version+1 WHERE tw_accounting_bank_statements.id=id;
 ELSIF p_action='unmatch' THEN
  g:=(p_value->>'match')::uuid;
  IF NOT EXISTS(SELECT 1 FROM tw_accounting_bank_matches WHERE tw_accounting_bank_matches.id=g AND statement_id=id) THEN RAISE EXCEPTION 'Match unavailable'; END IF;
  DELETE FROM tw_accounting_bank_match_lines WHERE match_id=g;
  UPDATE tw_accounting_bank_rows SET match_id=NULL WHERE match_id=g;
  DELETE FROM tw_accounting_bank_matches WHERE tw_accounting_bank_matches.id=g;
  UPDATE tw_accounting_bank_statements SET version=version+1 WHERE tw_accounting_bank_statements.id=id;
 ELSIF p_action='close' THEN
  IF EXISTS(SELECT 1 FROM tw_accounting_bank_rows WHERE statement_id=id AND match_id IS NULL) THEN RAISE EXCEPTION 'Match every statement row before closing'; END IF;
  SELECT coalesce(sum(l.amount),0),coalesce(sum(l.amount) FILTER(WHERE l.matched IS NULL OR l.cleared_date>s.to_date),0) INTO ledger_total,bank_total FROM tw_accounting_bank_ledger(s.bank_id,s.to_date) l;
  IF s.closing+bank_total<>ledger_total THEN RAISE EXCEPTION 'Adjusted bank closing does not equal the GL balance. Review opening balances and outstanding items'; END IF;
  UPDATE tw_accounting_bank_statements SET status='closed',version=version+1 WHERE tw_accounting_bank_statements.id=id;
 ELSE RAISE EXCEPTION 'Unknown bank operation'; END IF;
 INSERT INTO tw_accounting_audit(actor_id,table_name,operation,after_data) VALUES(auth.uid(),'tw_accounting_bank_statements','BANK_'||upper(p_action),jsonb_build_object('company_id',p_company,'id',id,'reason',reason,'match',g));
 RETURN id;
END $$;
CREATE FUNCTION tw_accounting_bank_report(p_company uuid,p_bank uuid,p_statement uuid DEFAULT NULL,p_to date DEFAULT NULL,p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE b tw_accounting_banks%ROWTYPE;s tw_accounting_bank_statements%ROWTYPE;rows jsonb;ledger jsonb;matches jsonb;balance numeric;outstanding numeric;n integer;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO b FROM tw_accounting_banks WHERE id=p_bank AND company_id=p_company;IF NOT FOUND THEN RAISE EXCEPTION 'Bank unavailable'; END IF;
 IF p_statement IS NOT NULL THEN SELECT * INTO s FROM tw_accounting_bank_statements WHERE id=p_statement AND bank_id=b.id AND company_id=p_company;IF NOT FOUND THEN RAISE EXCEPTION 'Statement unavailable'; END IF;p_to:=s.to_date; END IF;
 IF p_to IS NULL OR p_offset<0 OR p_offset>10000000 THEN RAISE EXCEPTION 'Choose a valid end date and page'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(r)||jsonb_build_object('amount',r.amount::text) ORDER BY row_number),'[]') INTO rows FROM tw_accounting_bank_rows r WHERE statement_id=s.id;
 SELECT coalesce(jsonb_agg(x),'[]') INTO ledger FROM(SELECT l.journal,l.line,l.date,l.number,l.description,l.amount::text,l.debit::text,l.credit::text,l.matched,l.cleared_date FROM tw_accounting_bank_ledger(b.id,p_to) l WHERE s.id IS NULL OR l.matched IS NULL OR EXISTS(SELECT 1 FROM tw_accounting_bank_matches m WHERE m.id=l.matched AND m.statement_id=s.id) ORDER BY l.date DESC,l.number,l.line LIMIT 100 OFFSET p_offset)x;
 SELECT count(*),coalesce(sum(l.amount),0),coalesce(sum(l.amount) FILTER(WHERE l.matched IS NULL OR l.cleared_date>p_to),0) INTO n,balance,outstanding FROM tw_accounting_bank_ledger(b.id,p_to) l;
 SELECT count(*) INTO n FROM tw_accounting_bank_ledger(b.id,p_to) l WHERE s.id IS NULL OR l.matched IS NULL OR EXISTS(SELECT 1 FROM tw_accounting_bank_matches m WHERE m.id=l.matched AND m.statement_id=s.id);
 SELECT coalesce(jsonb_agg(m ORDER BY created_at),'[]') INTO matches FROM tw_accounting_bank_matches m WHERE statement_id=s.id;
 RETURN jsonb_build_object('bank',b,'statement',CASE WHEN s.id IS NULL THEN NULL ELSE to_jsonb(s)||jsonb_build_object('opening',s.opening::text,'closing',s.closing::text) END,'rows',rows,'ledger',ledger,'matches',matches,'balance',balance::text,'outstanding',outstanding::text,'count',n);
END $$;
REVOKE ALL ON FUNCTION tw_accounting_bank_line_guard(),tw_accounting_bank_header_guard(),tw_accounting_bank_ledger(uuid,date),tw_accounting_bank_action(uuid,text,jsonb),tw_accounting_bank_report(uuid,uuid,uuid,date,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_bank_ledger(uuid,date),tw_accounting_bank_action(uuid,text,jsonb),tw_accounting_bank_report(uuid,uuid,uuid,date,integer) TO authenticated;
COMMIT;
