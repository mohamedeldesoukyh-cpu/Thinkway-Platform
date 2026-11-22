BEGIN;
ALTER TABLE tw_accounting_companies ADD COLUMN journal_approval_required boolean NOT NULL DEFAULT false;
ALTER TABLE tw_accounting_journals
 ADD COLUMN control_locked boolean NOT NULL DEFAULT false,
 ADD COLUMN control_reason text,
 ADD COLUMN approval_state text NOT NULL DEFAULT 'none' CHECK(approval_state IN ('none','submitted','approved','rejected')),
 ADD COLUMN approval_by uuid REFERENCES profiles(id),
 ADD COLUMN approval_hash text,
 ADD COLUMN control_editor uuid REFERENCES profiles(id);
UPDATE tw_accounting_journals SET control_editor=created_by;

CREATE FUNCTION tw_accounting_journal_fingerprint(p_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT md5(jsonb_build_object('company',j.company_id,'date',j.entry_date,'reference',j.reference,'memo',j.memo,'kind',j.entry_kind,
 'lines',(SELECT jsonb_agg(to_jsonb(l)-'account_name' ORDER BY l.line_number) FROM tw_accounting_journal_lines l WHERE l.journal_id=j.id))::text)
 FROM tw_accounting_journals j WHERE j.id=p_id
$$;

CREATE FUNCTION tw_accounting_control_company_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF (TG_OP='INSERT' AND NEW.journal_approval_required) OR (TG_OP='UPDATE' AND NEW.journal_approval_required IS DISTINCT FROM OLD.journal_approval_required) THEN
  IF NOT tw_accounting_can_manage() OR NOT coalesce((tw_module_access()->>'admin')::boolean,false) THEN RAISE EXCEPTION 'Administrator and verified MFA required to change approval policy' USING ERRCODE='42501'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tw_control_company BEFORE INSERT OR UPDATE ON tw_accounting_companies FOR EACH ROW EXECUTE FUNCTION tw_accounting_control_company_guard();

CREATE FUNCTION tw_accounting_control_header_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
 IF manual_entry AND OLD.status='draft' AND NEW.status='posted' AND (SELECT journal_approval_required FROM tw_accounting_companies WHERE id=OLD.company_id) THEN
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
CREATE TRIGGER a_tw_control_header BEFORE INSERT OR UPDATE OR DELETE ON tw_accounting_journals FOR EACH ROW EXECUTE FUNCTION tw_accounting_control_header_guard();

CREATE FUNCTION tw_accounting_control_line_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_accounting_journals%ROWTYPE; target uuid;
BEGIN
 target:=CASE WHEN TG_OP='DELETE' THEN OLD.journal_id ELSE NEW.journal_id END;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=target FOR UPDATE;
 IF j.control_locked THEN RAISE EXCEPTION 'Journal is locked. An administrator must unlock it before changing lines'; END IF;
 IF TG_OP='UPDATE' AND OLD.journal_id<>NEW.journal_id AND EXISTS(SELECT 1 FROM tw_accounting_journals WHERE id=OLD.journal_id AND control_locked) THEN RAISE EXCEPTION 'Source journal is locked'; END IF;
 -- Posting refreshes display names; this does not alter the approved accounting content.
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'account_name') IS NOT DISTINCT FROM (to_jsonb(OLD)-'account_name') THEN RETURN NEW; END IF;
 IF j.status='draft' AND j.source_invoice_id IS NULL AND j.source_payment_id IS NULL AND j.automatic_source IS NULL AND j.reversal_of IS NULL THEN
  UPDATE tw_accounting_journals SET approval_state='none',approval_by=NULL,approval_hash=NULL,control_editor=auth.uid(),control_reason=CASE WHEN approval_state<>'none' THEN 'Journal contents changed; approval cleared' ELSE control_reason END,
   version=version+CASE WHEN approval_state<>'none' THEN 1 ELSE 0 END
  WHERE id=target AND (approval_state<>'none' OR control_editor IS DISTINCT FROM auth.uid());
  IF j.approval_state<>'none' THEN
   INSERT INTO tw_accounting_audit(actor_id,table_name,operation,before_data,after_data) SELECT auth.uid(),'tw_accounting_journals','CONTROL_INVALIDATE',to_jsonb(j),to_jsonb(x) FROM tw_accounting_journals x WHERE id=target;
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;RETURN NEW;
END $$;
CREATE TRIGGER a_tw_control_line BEFORE INSERT OR UPDATE OR DELETE ON tw_accounting_journal_lines FOR EACH ROW EXECUTE FUNCTION tw_accounting_control_line_guard();

CREATE FUNCTION tw_accounting_control_action(p_company uuid,p_action text,p_entries jsonb,p_reason text) RETURNS integer
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
   IF j.control_locked OR j.status<>'draft' OR j.source_invoice_id IS NOT NULL OR j.source_payment_id IS NOT NULL OR j.automatic_source IS NOT NULL OR j.reversal_of IS NOT NULL THEN RAISE EXCEPTION 'Select an unlocked, manually authored draft'; END IF;
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

CREATE FUNCTION tw_accounting_approval_policy(p_company uuid,p_required boolean,p_version integer,p_reason text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c tw_accounting_companies%ROWTYPE;
BEGIN
 IF NOT tw_accounting_can_manage() OR NOT coalesce((tw_module_access()->>'admin')::boolean,false) THEN RAISE EXCEPTION 'Administrator and verified MFA required' USING ERRCODE='42501'; END IF;
 IF p_required IS NULL OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Approval policy and reason required'; END IF;
 SELECT * INTO c FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 IF NOT FOUND OR c.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Company changed. Reload' USING ERRCODE='40001'; END IF;
 UPDATE tw_accounting_companies SET journal_approval_required=p_required,version=version+1 WHERE id=p_company;
 INSERT INTO tw_accounting_audit(actor_id,table_name,operation,before_data,after_data)
 VALUES(auth.uid(),'tw_accounting_companies','CONTROL_POLICY',to_jsonb(c),jsonb_build_object('id',p_company,'journal_approval_required',p_required,'reason',trim(p_reason)));
END $$;

CREATE FUNCTION tw_accounting_control_history(p_company uuid,p_journal uuid DEFAULT NULL,p_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; n bigint;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 IF p_offset<0 OR p_offset>1000000 THEN RAISE EXCEPTION 'Invalid history page'; END IF;
 SELECT count(*) INTO n FROM tw_accounting_audit a WHERE a.operation LIKE 'CONTROL_%' AND
  (a.after_data->>'company_id'=p_company::text OR a.table_name='tw_accounting_companies' AND a.after_data->>'id'=p_company::text)
  AND (p_journal IS NULL OR a.table_name='tw_accounting_journals' AND a.after_data->>'id'=p_journal::text);
 SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM (
  SELECT a.id,a.occurred_at,a.operation,coalesce(p.full_name,p.email,a.actor_id::text) actor,a.actor_id,
   a.after_data->>'id' record_id,coalesce(a.after_data->>'voucher_number','Unnumbered draft') voucher,
   coalesce(a.after_data->>'control_reason',a.after_data->>'reason') reason,a.after_data->>'approval_state' approval,a.after_data->>'control_locked' locked
  FROM tw_accounting_audit a LEFT JOIN profiles p ON p.id=a.actor_id WHERE a.operation LIKE 'CONTROL_%' AND
   (a.after_data->>'company_id'=p_company::text OR a.table_name='tw_accounting_companies' AND a.after_data->>'id'=p_company::text)
   AND (p_journal IS NULL OR a.table_name='tw_accounting_journals' AND a.after_data->>'id'=p_journal::text)
  ORDER BY a.id DESC LIMIT 50 OFFSET p_offset
 ) x;
 RETURN jsonb_build_object('rows',result,'count',n);
END $$;
REVOKE ALL ON FUNCTION tw_accounting_journal_fingerprint(uuid),tw_accounting_control_company_guard(),tw_accounting_control_header_guard(),tw_accounting_control_line_guard(),tw_accounting_control_action(uuid,text,jsonb,text),tw_accounting_approval_policy(uuid,boolean,integer,text),tw_accounting_control_history(uuid,uuid,integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_control_action(uuid,text,jsonb,text),tw_accounting_approval_policy(uuid,boolean,integer,text),tw_accounting_control_history(uuid,uuid,integer) TO authenticated;
COMMIT;
