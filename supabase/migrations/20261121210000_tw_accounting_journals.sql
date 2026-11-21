BEGIN;
ALTER TABLE public.tw_accounting_periods
 ADD COLUMN is_closed boolean NOT NULL DEFAULT false,
 ADD COLUMN lock_reason text,
 ADD COLUMN changed_by uuid REFERENCES public.profiles(id),
 ADD COLUMN changed_at timestamptz,
 ADD COLUMN version integer NOT NULL DEFAULT 1;

CREATE TABLE public.tw_accounting_journals (
 id uuid PRIMARY KEY,
 company_id uuid NOT NULL REFERENCES public.tw_accounting_companies(id),
 entry_date date NOT NULL,
 reference text NOT NULL DEFAULT '' CHECK(length(reference)<=120),
 memo text NOT NULL CHECK(length(trim(memo)) BETWEEN 3 AND 1000),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','posted','cancelled')),
 voucher_number text,
 reversal_of uuid UNIQUE REFERENCES public.tw_accounting_journals(id),
 reversal_reason text,
 version integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 posted_by uuid REFERENCES public.profiles(id),
 posted_at timestamptz,
 UNIQUE(company_id,voucher_number),
 CHECK((status='posted')=(voucher_number IS NOT NULL AND posted_by IS NOT NULL AND posted_at IS NOT NULL)),
 CHECK(reversal_of IS NULL OR reversal_of<>id)
);
CREATE INDEX tw_journals_register ON public.tw_accounting_journals(company_id,entry_date DESC,created_at DESC,id);
CREATE TABLE public.tw_accounting_journal_lines (
 journal_id uuid NOT NULL REFERENCES public.tw_accounting_journals(id),
 line_number integer NOT NULL CHECK(line_number BETWEEN 1 AND 200),
 company_id uuid NOT NULL,
 account_code text NOT NULL,
 account_name text NOT NULL,
 description text NOT NULL DEFAULT '' CHECK(length(description)<=500),
 debit numeric(18,2) NOT NULL DEFAULT 0,
 credit numeric(18,2) NOT NULL DEFAULT 0,
 PRIMARY KEY(journal_id,line_number),
 FOREIGN KEY(company_id,account_code) REFERENCES public.tw_accounting_accounts(company_id,code),
 CHECK((debit>0 AND credit=0) OR (credit>0 AND debit=0))
);
CREATE INDEX tw_journal_account ON public.tw_accounting_journal_lines(company_id,account_code,journal_id);
CREATE TABLE public.tw_accounting_journal_sequences (
 company_id uuid NOT NULL REFERENCES public.tw_accounting_companies(id),
 fiscal_year integer NOT NULL,
 last_number bigint NOT NULL CHECK(last_number>0),
 PRIMARY KEY(company_id,fiscal_year)
);

-- All writes go through the functions below. No client or service-role direct
-- writes, including edits/deletes of posted documents or their lines.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['tw_accounting_journals','tw_accounting_journal_lines','tw_accounting_journal_sequences'] LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated,service_role',t);
  EXECUTE format('GRANT SELECT ON public.%I TO authenticated',t);
  EXECUTE format('CREATE POLICY accounting_read ON public.%I FOR SELECT TO authenticated USING ((SELECT (public.tw_module_access()->>''accounting'')::boolean))',t);
 END LOOP;
END $$;
CREATE TRIGGER tw_journal_audit AFTER INSERT OR UPDATE ON public.tw_accounting_journals FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_audit_change();
CREATE TRIGGER tw_journal_line_audit AFTER INSERT OR UPDATE ON public.tw_accounting_journal_lines FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_audit_change();

CREATE FUNCTION public.tw_accounting_save_journal(p_id uuid,p_company uuid,p_date date,p_reference text,p_memo text,p_version integer,p_lines jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
  IF j.company_id<>p_company OR j.status<>'draft' OR j.reversal_of IS NOT NULL THEN RAISE EXCEPTION 'Only an ordinary draft in this company can be edited'; END IF;
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

CREATE FUNCTION public.tw_accounting_post_journal(p_id uuid,p_company uuid,p_version integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_accounting_journals%ROWTYPE; fiscal integer; seq bigint; d numeric; c numeric; n integer;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Journal not found'; END IF;
 IF j.status='posted' THEN RETURN p_id; END IF; -- Retry never consumes another voucher number.
 IF j.status<>'draft' OR p_version IS NULL OR j.version<>p_version THEN RAISE EXCEPTION 'Journal changed. Reload before posting.' USING ERRCODE='40001'; END IF;
 SELECT extract(year FROM y.start_date)::integer INTO fiscal FROM tw_accounting_years y JOIN tw_accounting_periods p ON p.year_id=y.id
  WHERE y.company_id=p_company AND j.entry_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed;
 IF fiscal IS NULL THEN RAISE EXCEPTION 'Journal date must be in an open financial period'; END IF;
 SELECT count(*),sum(debit),sum(credit) INTO n,d,c FROM tw_accounting_journal_lines WHERE journal_id=p_id;
 IF n<2 OR n>200 OR d IS NULL OR d<=0 OR d<>c THEN RAISE EXCEPTION 'Journal must balance: total debits must equal total credits'; END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_lines l JOIN tw_accounting_accounts a ON a.company_id=l.company_id AND a.code=l.account_code
  WHERE l.journal_id=p_id AND (l.company_id<>p_company OR a.kind<>'Posting' OR (NOT a.active AND j.reversal_of IS NULL))) THEN RAISE EXCEPTION 'Journal contains an unavailable posting account'; END IF;
 UPDATE tw_accounting_journal_lines l SET account_name=a.name FROM tw_accounting_accounts a
  WHERE l.journal_id=p_id AND a.company_id=l.company_id AND a.code=l.account_code;
 INSERT INTO tw_accounting_journal_sequences(company_id,fiscal_year,last_number) VALUES(p_company,fiscal,1)
 ON CONFLICT(company_id,fiscal_year) DO UPDATE SET last_number=tw_accounting_journal_sequences.last_number+1 RETURNING last_number INTO seq;
 UPDATE tw_accounting_journals SET status='posted',voucher_number='JV-'||fiscal||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0'),posted_by=auth.uid(),posted_at=now(),updated_at=now(),version=version+1 WHERE id=p_id;
 RETURN p_id;
END $$;

CREATE FUNCTION public.tw_accounting_cancel_journal(p_id uuid,p_company uuid,p_version integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_accounting_journals%ROWTYPE;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND OR j.status<>'draft' OR p_version IS NULL OR j.version<>p_version THEN RAISE EXCEPTION 'Only the current draft can be cancelled' USING ERRCODE='40001'; END IF;
 UPDATE tw_accounting_journals SET status='cancelled',version=version+1,updated_at=now() WHERE id=p_id;
 RETURN p_id;
END $$;

CREATE FUNCTION public.tw_accounting_reverse_journal(p_id uuid,p_company uuid,p_reversal uuid,p_date date,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_accounting_journals%ROWTYPE; existing_id uuid;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND OR j.status<>'posted' OR j.reversal_of IS NOT NULL THEN RAISE EXCEPTION 'Select an original posted journal to reverse'; END IF;
 SELECT id INTO existing_id FROM tw_accounting_journals WHERE reversal_of=p_id;
 IF existing_id IS NOT NULL THEN RETURN existing_id; END IF;
 IF p_reversal IS NULL OR p_date IS NULL OR p_date<j.entry_date OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Enter a reversal reason and a date on or after the original entry'; END IF;
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,reversal_of,reversal_reason,created_by)
 VALUES(p_reversal,p_company,p_date,j.voucher_number,'Reversal of '||j.voucher_number||': '||trim(p_reason),p_id,trim(p_reason),auth.uid());
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit)
 SELECT p_reversal,line_number,company_id,account_code,account_name,description,credit,debit FROM tw_accounting_journal_lines WHERE journal_id=p_id;
 PERFORM tw_accounting_post_journal(p_reversal,p_company,1);
 RETURN p_reversal;
END $$;

CREATE FUNCTION public.tw_accounting_set_period(p_company uuid,p_period uuid,p_closed boolean,p_reason text,p_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 IF p_closed IS NULL OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'A period-change reason is required'; END IF;
 IF NOT p_closed AND NOT (tw_module_access()->>'admin')::boolean THEN RAISE EXCEPTION 'Only an administrator can reopen a period' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 UPDATE tw_accounting_periods p SET is_closed=p_closed,lock_reason=trim(p_reason),changed_by=auth.uid(),changed_at=now(),version=p.version+1
 FROM tw_accounting_years y WHERE y.id=p.year_id AND y.company_id=p_company AND p.id=p_period AND p.version=p_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Period changed. Reload before updating.' USING ERRCODE='40001'; END IF;
END $$;

-- Preserve classification and hierarchy once an account has posted activity.
CREATE FUNCTION public.tw_accounting_protect_used_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF (NEW.kind,NEW.account_type,NEW.normal_balance,NEW.parent_code) IS DISTINCT FROM (OLD.kind,OLD.account_type,OLD.normal_balance,OLD.parent_code)
 AND EXISTS(SELECT 1 FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id WHERE l.company_id=OLD.company_id AND l.account_code=OLD.code AND j.status='posted')
 THEN RAISE EXCEPTION 'An account with posted activity cannot change its classification, balance side or parent'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tw_account_protect_used BEFORE UPDATE ON public.tw_accounting_accounts FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_protect_used_account();

CREATE FUNCTION public.tw_accounting_trial_balance(p_company uuid,p_from date,p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Invalid report date range'; END IF;
 WITH balances AS (
 SELECT a.code,a.name,a.account_type,a.active,
 coalesce(sum(l.debit-l.credit) FILTER(WHERE j.entry_date<p_from),0) opening,
 coalesce(sum(l.debit) FILTER(WHERE j.entry_date BETWEEN p_from AND p_to),0) debit,
 coalesce(sum(l.credit) FILTER(WHERE j.entry_date BETWEEN p_from AND p_to),0) credit
 FROM tw_accounting_accounts a LEFT JOIN (tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id AND j.status='posted' AND j.entry_date<=p_to)
 ON l.company_id=a.company_id AND l.account_code=a.code WHERE a.company_id=p_company AND a.kind<>'Group'
 GROUP BY a.code,a.name,a.account_type,a.active)
 SELECT coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'type',account_type,'active',active,'opening',opening::text,'debit',debit::text,'credit',credit::text,'closing',(opening+debit-credit)::text) ORDER BY code),'[]'::jsonb) INTO result FROM balances;
 RETURN result;
END $$;

CREATE FUNCTION public.tw_accounting_ledger(p_company uuid,p_account text,p_from date,p_to date,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE opening numeric; debit numeric; credit numeric; n bigint; rows jsonb;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_offset IS NULL OR p_offset<0 THEN RAISE EXCEPTION 'Invalid report parameters'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_account AND kind<>'Group') THEN RAISE EXCEPTION 'Select a detail account'; END IF;
 SELECT coalesce(sum(l.debit-l.credit) FILTER(WHERE j.entry_date<p_from),0),coalesce(sum(l.debit) FILTER(WHERE j.entry_date BETWEEN p_from AND p_to),0),coalesce(sum(l.credit) FILTER(WHERE j.entry_date BETWEEN p_from AND p_to),0),count(*) FILTER(WHERE j.entry_date BETWEEN p_from AND p_to)
 INTO opening,debit,credit,n FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id
 WHERE l.company_id=p_company AND l.account_code=p_account AND j.status='posted' AND j.entry_date<=p_to;
 WITH entries AS (
 SELECT j.id,j.entry_date,j.voucher_number,j.memo,j.reference,j.reversal_of,l.line_number,l.description,l.debit,l.credit,
 opening+sum(l.debit-l.credit) OVER(ORDER BY j.entry_date,j.voucher_number,j.id,l.line_number ROWS UNBOUNDED PRECEDING) balance
 FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id
 WHERE l.company_id=p_company AND l.account_code=p_account AND j.status='posted' AND j.entry_date BETWEEN p_from AND p_to
 ORDER BY j.entry_date,j.voucher_number,j.id,l.line_number LIMIT 100 OFFSET p_offset)
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'date',entry_date,'number',voucher_number,'memo',memo,'reference',reference,'reversalOf',reversal_of,'line',line_number,'description',description,'debit',debit::text,'credit',credit::text,'balance',balance::text) ORDER BY entry_date,voucher_number,id,line_number),'[]'::jsonb) INTO rows FROM entries;
 RETURN jsonb_build_object('opening',opening::text,'debit',debit::text,'credit',credit::text,'closing',(opening+debit-credit)::text,'count',n,'rows',rows);
END $$;

REVOKE ALL ON FUNCTION public.tw_accounting_save_journal(uuid,uuid,date,text,text,integer,jsonb),public.tw_accounting_post_journal(uuid,uuid,integer),public.tw_accounting_cancel_journal(uuid,uuid,integer),public.tw_accounting_reverse_journal(uuid,uuid,uuid,date,text),public.tw_accounting_set_period(uuid,uuid,boolean,text,integer),public.tw_accounting_trial_balance(uuid,date,date),public.tw_accounting_ledger(uuid,text,date,date,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tw_accounting_save_journal(uuid,uuid,date,text,text,integer,jsonb),public.tw_accounting_post_journal(uuid,uuid,integer),public.tw_accounting_cancel_journal(uuid,uuid,integer),public.tw_accounting_reverse_journal(uuid,uuid,uuid,date,text),public.tw_accounting_set_period(uuid,uuid,boolean,text,integer),public.tw_accounting_trial_balance(uuid,date,date),public.tw_accounting_ledger(uuid,text,date,date,integer) TO authenticated;
COMMIT;
