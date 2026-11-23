BEGIN;
-- Staff identities use the existing audited detail identity, independently of a GL account.
ALTER TABLE tw_accounting_auxiliaries ALTER COLUMN account_code DROP NOT NULL;
ALTER TABLE tw_accounting_auxiliaries ADD COLUMN staff_number bigint CHECK(staff_number>0);
ALTER TABLE tw_accounting_auxiliaries ADD CONSTRAINT staff_directory_company_fk FOREIGN KEY(company_id) REFERENCES tw_accounting_companies(id);
CREATE UNIQUE INDEX tw_accounting_staff_number ON tw_accounting_auxiliaries(company_id,staff_number) WHERE staff_number IS NOT NULL;
-- Preserve every existing identity, name, auxiliary number and journal reference.
WITH staff AS(SELECT x.id,row_number() OVER(PARTITION BY x.company_id ORDER BY x.account_code,x.number,x.id) n FROM tw_accounting_auxiliaries x JOIN tw_accounting_accounts a ON a.company_id=x.company_id AND a.code=x.account_code WHERE a.subledger='Employee')
UPDATE tw_accounting_auxiliaries x SET staff_number=s.n FROM staff s WHERE s.id=x.id;
ALTER TABLE tw_accounting_auxiliaries ADD CONSTRAINT staff_directory_identity CHECK((account_code IS NOT NULL OR staff_number IS NOT NULL) AND (staff_number IS NULL OR client_id IS NULL AND vendor_id IS NULL));
CREATE FUNCTION tw_accounting_staff_identity() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.staff_number IS NULL AND EXISTS(SELECT 1 FROM tw_accounting_accounts WHERE company_id=NEW.company_id AND code=NEW.account_code AND subledger='Employee') THEN
  PERFORM 1 FROM tw_accounting_companies WHERE id=NEW.company_id FOR UPDATE;
  SELECT coalesce(max(staff_number),0)+1 INTO NEW.staff_number FROM tw_accounting_auxiliaries WHERE company_id=NEW.company_id;
 END IF;RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_staff_identity() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER staff_identity BEFORE INSERT ON tw_accounting_auxiliaries FOR EACH ROW EXECUTE FUNCTION tw_accounting_staff_identity();
CREATE FUNCTION tw_accounting_staff_save(p_company uuid,p_id uuid,p_version integer,p_name text,p_active boolean) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE n bigint;result uuid;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Company unavailable';END IF;
 IF length(trim(coalesce(p_name,''))) NOT BETWEEN 1 AND 150 OR p_active IS NULL THEN RAISE EXCEPTION 'Staff name and status required';END IF;
 IF p_id IS NULL THEN
  IF p_version IS NOT NULL THEN RAISE EXCEPTION 'Staff no longer exists' USING ERRCODE='40001';END IF;
  SELECT coalesce(max(staff_number),0)+1 INTO n FROM tw_accounting_auxiliaries WHERE company_id=p_company;
  INSERT INTO tw_accounting_auxiliaries(company_id,number,staff_number,name,active) VALUES(p_company,n,n,trim(p_name),p_active) RETURNING id INTO result;RETURN result;
 END IF;
 IF NOT p_active AND EXISTS(SELECT 1 FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id WHERE l.company_id=p_company AND l.auxiliary_id=p_id AND j.status='posted' GROUP BY l.account_code,l.line_currency HAVING sum(l.debit-l.credit)<>0 OR sum(coalesce(l.foreign_debit,l.debit)-coalesce(l.foreign_credit,l.credit))<>0) THEN RAISE EXCEPTION 'Cannot deactivate staff with a balance on any account or currency';END IF;
 UPDATE tw_accounting_auxiliaries SET name=trim(p_name),active=p_active,version=version+1 WHERE id=p_id AND company_id=p_company AND staff_number IS NOT NULL AND version=p_version RETURNING id INTO result;
 IF NOT FOUND THEN RAISE EXCEPTION 'Staff changed. Reload.' USING ERRCODE='40001';END IF;RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_staff_save(uuid,uuid,integer,text,boolean) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_staff_save(uuid,uuid,integer,text,boolean) TO authenticated;
DO $patch$ DECLARE d text;old text;BEGIN
 SELECT pg_get_functiondef('tw_accounting_auxiliary_line_guard()'::regprocedure) INTO d;
 old:='account_code=coalesce(a.auxiliary_source_code,NEW.account_code)';
 IF position(old IN d)=0 THEN RAISE EXCEPTION 'Unexpected auxiliary line guard';END IF;
 d:=replace(d,old,'(a.subledger=''Employee'' AND staff_number IS NOT NULL OR a.subledger IS DISTINCT FROM ''Employee'' AND account_code=coalesce(a.auxiliary_source_code,NEW.account_code))');
 EXECUTE d;
 SELECT pg_get_functiondef('tw_accounting_account_save(jsonb,integer,jsonb)'::regprocedure) INTO d;
 old:='a:=jsonb_populate_record(NULL::tw_accounting_accounts,p_value);';
 IF position(old IN d)=0 THEN RAISE EXCEPTION 'Unexpected account save';END IF;
 d:=replace(d,old,old||' IF a.kind=''Control'' AND a.subledger=''Employee'' THEN a.has_auxiliary:=true; IF jsonb_array_length(p_auxiliaries)>0 THEN RAISE EXCEPTION ''Add staff in Third Parties / Staff''; END IF; END IF;');EXECUTE d;
 SELECT pg_get_functiondef('tw_accounting_statement_filtered(uuid,date,date,text,text,uuid,text,integer,uuid,jsonb)'::regprocedure) INTO d;
 d:=replace(d,'ax.account_code=coalesce(a.auxiliary_source_code,a.code)','(a.subledger=''Employee'' AND ax.staff_number IS NOT NULL OR a.subledger IS DISTINCT FROM ''Employee'' AND ax.account_code=coalesce(a.auxiliary_source_code,a.code))');
 d:=replace(d,' AND x.account_code=coalesce(a.auxiliary_source_code,a.code)',' AND (a.subledger=''Employee'' AND x.staff_number IS NOT NULL OR a.subledger IS DISTINCT FROM ''Employee'' AND x.account_code=coalesce(a.auxiliary_source_code,a.code))');
 d:=replace(d,'SELECT number::text','SELECT coalesce(staff_number,number)::text');d:=replace(d,'x.number::text','coalesce(x.staff_number,x.number)::text');
 d:=replace(d,'CASE WHEN a.subledger IN(''Customer'',''Supplier / creator'') THEN','CASE WHEN a.subledger IN(''Customer'',''Supplier / creator'',''Employee'') THEN');
 d:=replace(d,'AND p_auxiliary IS NULL ELSE','AND (a.subledger=''Employee'' OR p_auxiliary IS NULL) ELSE');
 EXECUTE d;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
