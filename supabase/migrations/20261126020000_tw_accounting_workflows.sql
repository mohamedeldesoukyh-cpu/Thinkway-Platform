BEGIN;
ALTER TABLE tw_accounting_journals ADD COLUMN workflow text NOT NULL DEFAULT 'general' CHECK(workflow IN('general','transfer','opening'));

CREATE FUNCTION tw_accounting_check_workflow(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_accounting_journals%ROWTYPE;n integer;
BEGIN
 SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id;
 IF j.workflow='general' THEN RETURN; END IF;
 IF j.workflow='opening' THEN
  IF NOT EXISTS(SELECT 1 FROM tw_accounting_years WHERE company_id=j.company_id AND start_date=j.entry_date) THEN RAISE EXCEPTION 'Opening balances must use the first day of a financial year'; END IF;
  IF EXISTS(SELECT 1 FROM tw_accounting_journal_lines l JOIN tw_accounting_accounts a ON a.company_id=l.company_id AND a.code=l.account_code WHERE l.journal_id=j.id AND a.account_type NOT IN('Asset','Liability','Equity')) THEN RAISE EXCEPTION 'Opening balances use balance sheet accounts only'; END IF;
 ELSE
  SELECT count(*) INTO n FROM tw_accounting_journal_lines WHERE journal_id=j.id;
  IF n<>2 OR (SELECT count(DISTINCT (account_code,auxiliary_id)) FROM tw_accounting_journal_lines WHERE journal_id=j.id)<>2 OR (SELECT count(DISTINCT line_currency) FROM tw_accounting_journal_lines WHERE journal_id=j.id)<>1 THEN RAISE EXCEPTION 'A transfer needs two different account/auxiliary destinations in one currency'; END IF;
 END IF;
END $$;
CREATE FUNCTION tw_accounting_workflow_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status='posted' AND OLD.status IS DISTINCT FROM 'posted' THEN PERFORM tw_accounting_check_workflow(NEW.id); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tw_workflow_post BEFORE UPDATE ON tw_accounting_journals FOR EACH ROW EXECUTE FUNCTION tw_accounting_workflow_guard();
CREATE FUNCTION tw_accounting_save_workflow(p_value jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE id uuid:=(p_value->>'id')::uuid;c uuid:=(p_value->>'company')::uuid;w text;existing text;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=c FOR UPDATE;
 SELECT workflow INTO existing FROM tw_accounting_journals WHERE tw_accounting_journals.id=id AND company_id=c;
 w:=coalesce(existing,p_value->>'workflow','general');
 IF w NOT IN('general','opening','transfer') THEN RAISE EXCEPTION 'Invalid workflow'; END IF;
 PERFORM tw_accounting_save_entry(id,c,(p_value->>'date')::date,p_value->>'reference',p_value->>'memo',(p_value->>'version')::integer,coalesce(p_value->>'kind','manual'),p_value->'lines');
 UPDATE tw_accounting_journals SET workflow=w WHERE tw_accounting_journals.id=id;
 PERFORM tw_accounting_check_workflow(id);
 RETURN id;
END $$;

CREATE TABLE tw_accounting_schedules(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),
 kind text NOT NULL CHECK(kind IN('recurring','reversal')),source_id uuid NOT NULL REFERENCES tw_accounting_journals(id),
 name text NOT NULL CHECK(length(name) BETWEEN 3 AND 120),anchor_date date NOT NULL,next_date date NOT NULL,end_date date,
 interval_months integer NOT NULL DEFAULT 1 CHECK(interval_months BETWEEN 1 AND 12),occurrence integer NOT NULL DEFAULT 0,
 lines jsonb NOT NULL,entry_kind text NOT NULL,memo text NOT NULL,reference text NOT NULL,
 active boolean NOT NULL DEFAULT true,version integer NOT NULL DEFAULT 1,created_by uuid NOT NULL REFERENCES profiles(id),created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(end_date IS NULL OR end_date>=anchor_date)
);
CREATE UNIQUE INDEX tw_schedule_reversal_unique ON tw_accounting_schedules(source_id) WHERE kind='reversal';
CREATE TABLE tw_accounting_schedule_runs(
 schedule_id uuid NOT NULL REFERENCES tw_accounting_schedules(id),due_date date NOT NULL,journal_id uuid NOT NULL REFERENCES tw_accounting_journals(id),
 company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(schedule_id,due_date)
);
ALTER TABLE tw_accounting_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tw_accounting_schedule_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY accounting_read ON tw_accounting_schedules FOR SELECT TO authenticated USING((SELECT (tw_module_access()->>'accounting')::boolean));
CREATE POLICY accounting_read ON tw_accounting_schedule_runs FOR SELECT TO authenticated USING((SELECT (tw_module_access()->>'accounting')::boolean));
REVOKE ALL ON tw_accounting_schedules,tw_accounting_schedule_runs FROM anon,authenticated,service_role;
GRANT SELECT ON tw_accounting_schedules,tw_accounting_schedule_runs TO authenticated;
CREATE TRIGGER tw_schedule_audit AFTER INSERT OR UPDATE ON tw_accounting_schedules FOR EACH ROW EXECUTE FUNCTION tw_accounting_audit_change();
CREATE TRIGGER tw_schedule_run_audit AFTER INSERT ON tw_accounting_schedule_runs FOR EACH ROW EXECUTE FUNCTION tw_accounting_audit_change();

CREATE FUNCTION tw_accounting_schedule_action(p_company uuid,p_action text,p_value jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
  SELECT jsonb_agg(jsonb_build_object('account',account_code,'description',description,'auxiliaryId',auxiliary_id,'lineCurrency',coalesce(line_currency,base),'foreignDebit',coalesce(foreign_debit,debit)::text,'foreignCredit',coalesce(foreign_credit,credit)::text) ORDER BY line_number) INTO ls FROM tw_accounting_journal_lines WHERE journal_id=j.id;
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
END $$;
REVOKE ALL ON FUNCTION tw_accounting_check_workflow(uuid),tw_accounting_workflow_guard(),tw_accounting_save_workflow(jsonb),tw_accounting_schedule_action(uuid,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_save_workflow(jsonb),tw_accounting_schedule_action(uuid,text,jsonb) TO authenticated;
COMMIT;
