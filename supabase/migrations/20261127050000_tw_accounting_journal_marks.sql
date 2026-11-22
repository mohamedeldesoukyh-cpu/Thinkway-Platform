BEGIN;
ALTER TABLE tw_accounting_journals ADD COLUMN resume_status text CHECK(resume_status IN('draft','posted'));
ALTER TABLE tw_accounting_journals DROP CONSTRAINT tw_journal_number_state,DROP CONSTRAINT tw_pending_source;
ALTER TABLE tw_accounting_journals ADD CONSTRAINT tw_journal_number_state CHECK(
 (voucher_number IS NOT NULL AND posted_by IS NOT NULL AND posted_at IS NOT NULL AND (status IN('posted','pending') OR status='cancelled' AND resume_status='posted')) OR
 (voucher_number IS NULL AND posted_by IS NULL AND posted_at IS NULL AND (status IN('draft','cancelled') OR status='pending' AND resume_status='draft'))),
 ADD CONSTRAINT tw_pending_source CHECK(status<>'pending' OR source_invoice_id IS NOT NULL AND reversal_of IS NULL OR resume_status IS NOT NULL),
 ADD CONSTRAINT tw_journal_resume_state CHECK(resume_status IS NULL OR status IN('pending','cancelled') AND source_invoice_id IS NULL AND source_payment_id IS NULL AND automatic_source IS NULL AND reversal_of IS NULL);
CREATE FUNCTION tw_accounting_journal_mark(p_company uuid,p_id uuid,p_version integer,p_mark text,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_accounting_journals%ROWTYPE;previous jsonb;target text;BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 IF p_mark IS NULL OR p_mark NOT IN('pending','cancelled','clear') OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Choose a status and enter a reason';END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND OR j.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Journal changed. Reload before changing status' USING ERRCODE='40001';END IF;
 IF j.control_locked THEN RAISE EXCEPTION 'Journal is locked. Unlock it first';END IF;
 IF j.source_invoice_id IS NOT NULL OR j.source_payment_id IS NOT NULL OR j.automatic_source IS NOT NULL THEN RAISE EXCEPTION 'Change automatic journals through their source document';END IF;
 IF j.reversal_of IS NOT NULL OR EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=j.id) THEN RAISE EXCEPTION 'Reversed journals retain their original status and reversal history';END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_years y JOIN tw_accounting_periods p ON p.year_id=y.id WHERE y.company_id=p_company AND j.entry_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed) THEN RAISE EXCEPTION 'Journal date must be in an open financial period';END IF;
 previous:=to_jsonb(j);
 IF p_mark='clear' THEN
  target:=coalesce(j.resume_status,CASE WHEN j.status='cancelled' AND j.voucher_number IS NULL THEN 'draft' END);
  IF target IS NULL THEN RAISE EXCEPTION 'Journal has no removable status mark';END IF;
  IF target='posted' THEN PERFORM tw_accounting_post_journal(j.id,p_company,j.version);
  ELSE UPDATE tw_accounting_journals SET status='draft',resume_status=NULL,version=version+1,updated_at=now() WHERE id=j.id;END IF;
 ELSE
  IF j.status=p_mark THEN RAISE EXCEPTION 'Journal already has this mark';END IF;
  target:=coalesce(j.resume_status,CASE WHEN j.status='cancelled' AND j.voucher_number IS NULL THEN 'draft' ELSE j.status END);
  IF target NOT IN('draft','posted') THEN RAISE EXCEPTION 'Journal status cannot be changed here';END IF;
  UPDATE tw_accounting_journals SET status=p_mark,resume_status=target,version=version+1,updated_at=now() WHERE id=j.id;
 END IF;
 UPDATE tw_accounting_journals SET control_reason=trim(p_reason) WHERE id=j.id;
 INSERT INTO tw_accounting_audit(actor_id,table_name,operation,before_data,after_data) SELECT auth.uid(),'tw_accounting_journals','CONTROL_MARK_'||upper(p_mark),previous,to_jsonb(x) FROM tw_accounting_journals x WHERE id=j.id;
 RETURN j.id;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_journal_mark(uuid,uuid,integer,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_journal_mark(uuid,uuid,integer,text,text) TO authenticated;

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
  WHERE l.journal_id=p_id AND (l.company_id<>p_company OR (a.kind<>'Posting' AND NOT (a.kind='Control' AND a.subledger='Customer' AND j.reversal_of IS NOT NULL AND EXISTS(SELECT 1 FROM tw_accounting_invoice_submissions s JOIN tw_accounting_journal_lines original ON original.journal_id=s.journal_id AND original.line_number=l.line_number WHERE s.journal_id=j.reversal_of AND s.invoice_id=j.source_invoice_id AND s.company_id=p_company AND original.account_code=l.account_code AND original.client_id=l.client_id AND original.client_code=l.client_code AND original.debit=l.credit AND original.credit=l.debit))) OR (NOT a.active AND j.reversal_of IS NULL))) THEN RAISE EXCEPTION 'Journal contains an unavailable posting account'; END IF;
 UPDATE tw_accounting_journal_lines l SET account_name=a.name FROM tw_accounting_accounts a
  WHERE l.journal_id=p_id AND a.company_id=l.company_id AND a.code=l.account_code;
 IF j.voucher_number IS NULL THEN
 INSERT INTO tw_accounting_journal_sequences(company_id,fiscal_year,last_number) VALUES(p_company,fiscal,1)
 ON CONFLICT(company_id,fiscal_year) DO UPDATE SET last_number=tw_accounting_journal_sequences.last_number+1 RETURNING last_number INTO seq;
 END IF;
 UPDATE tw_accounting_journals SET status='posted',resume_status=NULL,voucher_number=coalesce(j.voucher_number,'JV-'||fiscal||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0')),posted_by=coalesce(j.posted_by,auth.uid()),posted_at=coalesce(j.posted_at,now()),updated_at=now(),version=version+1 WHERE id=p_id;
 RETURN p_id;
END $function$;

CREATE OR REPLACE FUNCTION tw_accounting_control_header_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE manual_entry boolean; metadata text[]:=ARRAY['control_locked','control_reason','approval_state','approval_by','approval_hash','control_editor','version','updated_at'];
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.control_locked THEN RAISE EXCEPTION 'Journal is locked. An administrator must unlock it first'; END IF;
  RETURN OLD;
 END IF;
 IF TG_OP='INSERT' THEN
  NEW.control_editor:=NEW.created_by;
  IF NEW.reversal_of IS NOT NULL AND EXISTS(SELECT 1 FROM tw_accounting_journals WHERE id=NEW.reversal_of AND control_locked) THEN RAISE EXCEPTION 'Original journal is locked. Unlock it before reversal'; END IF;
  RETURN NEW;
 END IF;
 IF OLD.control_locked AND (to_jsonb(NEW)-metadata) IS DISTINCT FROM (to_jsonb(OLD)-metadata) THEN RAISE EXCEPTION 'Journal is locked. An administrator must unlock it first'; END IF;
 manual_entry:=OLD.source_invoice_id IS NULL AND OLD.source_payment_id IS NULL AND OLD.automatic_source IS NULL AND OLD.reversal_of IS NULL;
 IF manual_entry AND OLD.status IN('draft','pending','cancelled') AND NEW.status='posted' AND (SELECT journal_approval_required FROM tw_accounting_companies WHERE id=OLD.company_id) THEN
  IF OLD.control_locked OR OLD.approval_state<>'approved' OR OLD.approval_by IS NULL OR OLD.approval_by=OLD.created_by OR OLD.approval_by=OLD.control_editor OR OLD.approval_hash IS DISTINCT FROM tw_accounting_journal_fingerprint(OLD.id) THEN
   RAISE EXCEPTION 'This company requires approval by a different accountant for the current journal contents';
  END IF;
 END IF;
 IF OLD.status='draft' AND (NEW.entry_date,NEW.reference,NEW.memo,NEW.entry_kind) IS DISTINCT FROM (OLD.entry_date,OLD.reference,OLD.memo,OLD.entry_kind) THEN
  NEW.approval_state:='none';NEW.approval_by:=NULL;NEW.approval_hash:=NULL;NEW.control_editor:=auth.uid();
  IF OLD.approval_state<>'none' THEN
   NEW.control_reason:='Journal contents changed; approval cleared';
   INSERT INTO tw_accounting_audit(actor_id,table_name,operation,before_data,after_data) VALUES(auth.uid(),'tw_accounting_journals','CONTROL_INVALIDATE',to_jsonb(OLD),to_jsonb(NEW));
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION tw_accounting_control_action(p_company uuid,p_action text,p_entries jsonb,p_reason text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_accounting_journals%ROWTYPE; item jsonb; n integer:=0; before_row jsonb; next_state text;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 IF p_action IS NULL OR p_action NOT IN ('lock','unlock','submit','approve','reject','withdraw') OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 OR jsonb_typeof(p_entries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_entries) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Select journals, an action and a reason'; END IF;
 IF p_action='unlock' AND NOT coalesce((tw_module_access()->>'admin')::boolean,false) THEN RAISE EXCEPTION 'Only an administrator may unlock journals' USING ERRCODE='42501'; END IF;
 IF p_action NOT IN ('lock','unlock') AND jsonb_array_length(p_entries)<>1 THEN RAISE EXCEPTION 'Review approvals one journal at a time'; END IF;
 IF (SELECT count(DISTINCT x->>'id') FROM jsonb_array_elements(p_entries) x)<>jsonb_array_length(p_entries) THEN RAISE EXCEPTION 'Duplicate journals in selection'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Company unavailable'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_entries) ORDER BY value->>'id' LOOP
  SELECT * INTO j FROM tw_accounting_journals WHERE id=(item->>'id')::uuid AND company_id=p_company FOR UPDATE;
  IF NOT FOUND OR j.version IS DISTINCT FROM (item->>'version')::integer THEN RAISE EXCEPTION 'Journal changed. Reload and review the selection' USING ERRCODE='40001'; END IF;
  before_row:=to_jsonb(j);
  IF p_action IN ('lock','unlock') THEN
   IF j.control_locked=(p_action='lock') THEN RAISE EXCEPTION 'Selection contains a journal already in the requested lock state. Refresh'; END IF;
   UPDATE tw_accounting_journals SET control_locked=(p_action='lock'),control_reason=trim(p_reason),version=version+1,updated_at=now() WHERE id=j.id;
  ELSE
   IF j.control_locked OR (j.status<>'draft' AND j.resume_status IS NULL) OR j.source_invoice_id IS NOT NULL OR j.source_payment_id IS NOT NULL OR j.automatic_source IS NOT NULL OR j.reversal_of IS NOT NULL THEN RAISE EXCEPTION 'Select an unlocked, manually authored draft or marked journal'; END IF;
   IF NOT (SELECT journal_approval_required FROM tw_accounting_companies WHERE id=p_company) THEN RAISE EXCEPTION 'Journal approvals are not enabled for this company'; END IF;
   IF p_action='submit' AND j.approval_state NOT IN ('none','rejected') THEN RAISE EXCEPTION 'Draft already submitted or approved'; END IF;
   IF p_action IN ('approve','reject') AND (j.approval_state<>'submitted' OR auth.uid() IN (j.created_by,j.control_editor)) THEN RAISE EXCEPTION 'A different accountant must review a submitted draft'; END IF;
   IF p_action='withdraw' AND j.approval_state NOT IN ('submitted','approved') THEN RAISE EXCEPTION 'Only submitted or approved drafts may be withdrawn'; END IF;
   IF p_action IN ('submit','approve') AND NOT EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE journal_id=j.id GROUP BY journal_id HAVING count(*) BETWEEN 2 AND 200 AND sum(debit)>0 AND sum(debit)=sum(credit)) THEN RAISE EXCEPTION 'Journal must balance before approval'; END IF;
   next_state:=CASE p_action WHEN 'submit' THEN 'submitted' WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'none' END;
   UPDATE tw_accounting_journals SET approval_state=next_state,approval_by=CASE WHEN p_action='approve' THEN auth.uid() END,
    approval_hash=CASE WHEN p_action='approve' THEN tw_accounting_journal_fingerprint(j.id) END,control_reason=trim(p_reason),version=version+1,updated_at=now() WHERE id=j.id;
  END IF;
  INSERT INTO tw_accounting_audit(actor_id,table_name,operation,before_data,after_data)
   SELECT auth.uid(),'tw_accounting_journals','CONTROL_'||upper(p_action),before_row,to_jsonb(x) FROM tw_accounting_journals x WHERE id=j.id;
  n:=n+1;
 END LOOP;
 RETURN n;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
