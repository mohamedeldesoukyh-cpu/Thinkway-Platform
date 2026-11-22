BEGIN;

CREATE TABLE tw_accounting_year_closings(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),year_id uuid NOT NULL REFERENCES tw_accounting_years(id),
 retained_account text NOT NULL,reason text NOT NULL,status text NOT NULL CHECK(status IN('closed','reopened')),journal_ids uuid[] NOT NULL DEFAULT '{}',period_snapshot jsonb NOT NULL,
 created_by uuid NOT NULL REFERENCES profiles(id),created_at timestamptz NOT NULL DEFAULT now(),reopened_by uuid REFERENCES profiles(id),reopened_at timestamptz,reopen_reason text,
 FOREIGN KEY(company_id,retained_account) REFERENCES tw_accounting_accounts(company_id,code));
CREATE UNIQUE INDEX tw_one_active_close ON tw_accounting_year_closings(year_id) WHERE status='closed';
ALTER TABLE tw_accounting_year_closings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tw_accounting_year_closings FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON tw_accounting_year_closings TO authenticated;
CREATE POLICY accounting_read ON tw_accounting_year_closings FOR SELECT TO authenticated USING((SELECT (tw_module_access()->>'accounting')::boolean));
CREATE TRIGGER accounting_audit AFTER INSERT OR UPDATE ON tw_accounting_year_closings FOR EACH ROW EXECUTE FUNCTION tw_accounting_audit_change();
CREATE FUNCTION tw_accounting_closing_lines(p_company uuid,p_year uuid) RETURNS TABLE(account text,name text,auxiliary uuid,client uuid,vendor uuid,client_code text,vendor_code text,currency text,rate numeric,balance numeric,foreign_balance numeric)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT a.code,a.name,l.auxiliary_id,l.client_id,l.vendor_id,min(l.client_code),min(l.vendor_code),coalesce(l.line_currency,j.transaction_currency,c.base_currency),coalesce(l.line_rate,j.exchange_rate,1),sum(l.debit-l.credit),sum(coalesce(l.foreign_debit,l.debit)-coalesce(l.foreign_credit,l.credit))
 FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id JOIN tw_accounting_accounts a ON a.company_id=l.company_id AND a.code=l.account_code JOIN tw_accounting_companies c ON c.id=j.company_id JOIN tw_accounting_years y ON y.company_id=c.id AND y.id=p_year
 WHERE j.company_id=p_company AND j.status='posted' AND j.entry_date BETWEEN y.start_date AND y.end_date AND a.account_type IN('Revenue','Expense')
 GROUP BY a.code,a.name,l.auxiliary_id,l.client_id,l.vendor_id,coalesce(l.line_currency,j.transaction_currency,c.base_currency),coalesce(l.line_rate,j.exchange_rate,1)
 HAVING sum(l.debit-l.credit)<>0 OR sum(coalesce(l.foreign_debit,l.debit)-coalesce(l.foreign_credit,l.credit))<>0
 ORDER BY a.code,l.auxiliary_id,l.client_id,l.vendor_id,coalesce(l.line_currency,j.transaction_currency,c.base_currency),coalesce(l.line_rate,j.exchange_rate,1)
$$;
REVOKE ALL ON FUNCTION tw_accounting_closing_lines(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION tw_accounting_closing_preview(p_company uuid,p_year uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE y tw_accounting_years%ROWTYPE;rows jsonb;result jsonb;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 SELECT * INTO y FROM tw_accounting_years WHERE id=p_year AND company_id=p_company;IF NOT FOUND THEN RAISE EXCEPTION 'Fiscal year unavailable';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('account',account,'name',name,'auxiliary',auxiliary,'client',client,'vendor',vendor,'client_code',client_code,'vendor_code',vendor_code,'currency',currency,'rate',rate::text,'balance',balance::text,'foreign_balance',foreign_balance::text)),'[]') INTO rows FROM tw_accounting_closing_lines(p_company,p_year);
 result:=jsonb_build_object('rows',rows,'ended',y.end_date<(now() AT TIME ZONE 'Africa/Cairo')::date,
 'pending',(SELECT count(*) FROM tw_accounting_journals WHERE company_id=p_company AND entry_date BETWEEN y.start_date AND y.end_date AND status IN('draft','pending')),
 'openStatements',(SELECT count(*) FROM tw_accounting_bank_statements WHERE company_id=p_company AND to_date<=y.end_date AND status='open'),
 'history',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY created_at DESC),'[]') FROM tw_accounting_year_closings x WHERE company_id=p_company AND year_id=p_year));
 RETURN result||jsonb_build_object('snapshot',md5(result::text));
END $$;
-- Closed years protect all postings and reclassifications, as well as period reopening.
CREATE FUNCTION tw_accounting_closed_year_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid;day date;
BEGIN
 IF TG_TABLE_NAME='tw_accounting_periods' THEN
  IF OLD.is_closed AND NOT NEW.is_closed AND EXISTS(SELECT 1 FROM tw_accounting_year_closings WHERE year_id=OLD.year_id AND status='closed') THEN RAISE EXCEPTION 'Reopen the fiscal year before reopening its periods';END IF;RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='tw_accounting_journal_lines' THEN
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'account_name') IS NOT DISTINCT FROM (to_jsonb(OLD)-'account_name') THEN RETURN NEW;END IF;
  SELECT company_id,entry_date INTO cid,day FROM tw_accounting_journals WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.journal_id ELSE NEW.journal_id END;
 ELSE
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['version','updated_at','control_locked','control_reason','approval_state','approval_by','approval_hash','control_editor']) IS NOT DISTINCT FROM (to_jsonb(OLD)-ARRAY['version','updated_at','control_locked','control_reason','approval_state','approval_by','approval_hash','control_editor']) THEN RETURN NEW;END IF;
  cid:=CASE WHEN TG_OP='INSERT' THEN NEW.company_id ELSE OLD.company_id END;day:=CASE WHEN TG_OP='INSERT' THEN NEW.entry_date ELSE OLD.entry_date END;
 END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=cid FOR UPDATE;
 IF EXISTS(SELECT 1 FROM tw_accounting_year_closings x JOIN tw_accounting_years y ON y.id=x.year_id WHERE x.company_id=cid AND x.status='closed' AND day BETWEEN y.start_date AND y.end_date) THEN RAISE EXCEPTION 'Fiscal year is closed';END IF;
 IF TG_TABLE_NAME='tw_accounting_journals' AND TG_OP='UPDATE' THEN
  IF EXISTS(SELECT 1 FROM tw_accounting_year_closings x JOIN tw_accounting_years y ON y.id=x.year_id WHERE x.company_id=NEW.company_id AND x.status='closed' AND NEW.entry_date BETWEEN y.start_date AND y.end_date) THEN RAISE EXCEPTION 'Destination fiscal year is closed';END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
CREATE TRIGGER tw_closed_year_header BEFORE INSERT OR UPDATE OR DELETE ON tw_accounting_journals FOR EACH ROW EXECUTE FUNCTION tw_accounting_closed_year_guard();
CREATE TRIGGER tw_closed_year_line BEFORE INSERT OR UPDATE OR DELETE ON tw_accounting_journal_lines FOR EACH ROW EXECUTE FUNCTION tw_accounting_closed_year_guard();
CREATE TRIGGER tw_closed_year_period BEFORE UPDATE ON tw_accounting_periods FOR EACH ROW EXECUTE FUNCTION tw_accounting_closed_year_guard();
CREATE FUNCTION tw_accounting_year_action(p_company uuid,p_year uuid,p_action text,p_retained text,p_reason text,p_snapshot text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE y tw_accounting_years%ROWTYPE;closed tw_accounting_year_closings%ROWTYPE;preview jsonb;item jsonb;periods jsonb;ids uuid[]:='{}';j uuid;original uuid;r uuid;result uuid:=gen_random_uuid();n integer:=0;balance numeric:=0;b numeric;f numeric;base text;retained_name text;
BEGIN
 IF NOT tw_accounting_can_manage() OR NOT coalesce((tw_module_access()->>'admin')::boolean,false) THEN RAISE EXCEPTION 'Administrator and verified MFA required' USING ERRCODE='42501';END IF;
 IF p_action IS NULL OR p_action NOT IN('close','reopen') OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Choose close/reopen and enter a reason';END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO y FROM tw_accounting_years WHERE id=p_year AND company_id=p_company FOR UPDATE;IF NOT FOUND THEN RAISE EXCEPTION 'Fiscal year unavailable';END IF;
 preview:=tw_accounting_closing_preview(p_company,p_year);IF p_snapshot IS DISTINCT FROM preview->>'snapshot' THEN RAISE EXCEPTION 'Closing preview changed; review again' USING ERRCODE='40001';END IF;
 SELECT * INTO closed FROM tw_accounting_year_closings WHERE year_id=p_year AND status='closed';
 IF p_action='reopen' THEN
  IF closed.id IS NULL THEN RAISE EXCEPTION 'Year is not closed';END IF;
  IF EXISTS(SELECT 1 FROM tw_accounting_year_closings x JOIN tw_accounting_years z ON z.id=x.year_id WHERE x.company_id=p_company AND x.status='closed' AND z.start_date>y.start_date) THEN RAISE EXCEPTION 'Reopen later fiscal years first';END IF;
  UPDATE tw_accounting_year_closings SET status='reopened',reopened_by=auth.uid(),reopened_at=now(),reopen_reason=trim(p_reason) WHERE id=closed.id;
  UPDATE tw_accounting_periods SET is_closed=false,version=version+1 WHERE year_id=p_year AND period_number=12;
  FOREACH original IN ARRAY closed.journal_ids LOOP
   r:=gen_random_uuid();INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,automatic_source,reversal_of,reversal_reason) VALUES(r,p_company,y.end_date,'YEAR-REOPEN','Fiscal year reopen: '||trim(p_reason),auth.uid(),'fiscal_reopen',original,trim(p_reason));
   INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,line_currency,line_rate,auxiliary_id,client_id,vendor_id,client_code,vendor_code)
   SELECT r,line_number,company_id,account_code,account_name,description,credit,debit,foreign_credit,foreign_debit,line_currency,line_rate,auxiliary_id,client_id,vendor_id,client_code,vendor_code FROM tw_accounting_journal_lines WHERE journal_id=original;
   PERFORM tw_accounting_finish_receipt_journal(r);
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(closed.period_snapshot) LOOP
   UPDATE tw_accounting_periods SET is_closed=(item->>'is_closed')::boolean,lock_reason=item->>'lock_reason',changed_at=now(),changed_by=auth.uid(),version=version+1 WHERE id=(item->>'id')::uuid;
  END LOOP;RETURN closed.id;
 END IF;
 IF closed.id IS NOT NULL THEN RAISE EXCEPTION 'Year is already closed';END IF;
 IF NOT (preview->>'ended')::boolean THEN RAISE EXCEPTION 'Fiscal year must end before closing';END IF;
 IF (preview->>'pending')::integer>0 OR (preview->>'openStatements')::integer>0 THEN RAISE EXCEPTION 'Resolve pending journals and open bank statements before closing';END IF;
 SELECT name INTO retained_name FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_retained AND account_type='Equity' AND kind='Posting' AND active AND NOT has_auxiliary;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active retained earnings equity account without auxiliaries';END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_years z WHERE z.company_id=p_company AND z.end_date<y.start_date AND NOT EXISTS(SELECT 1 FROM tw_accounting_year_closings x WHERE x.year_id=z.id AND x.status='closed') AND EXISTS(SELECT 1 FROM tw_accounting_journals WHERE company_id=p_company AND entry_date BETWEEN z.start_date AND z.end_date AND status='posted')) THEN RAISE EXCEPTION 'Close earlier active fiscal years first';END IF;
 IF (SELECT count(*) FROM tw_accounting_periods WHERE year_id=p_year)<>12 THEN RAISE EXCEPTION 'Fiscal year requires twelve periods';END IF;
 SELECT jsonb_agg(to_jsonb(p) ORDER BY period_number) INTO periods FROM tw_accounting_periods p WHERE year_id=p_year;
 UPDATE tw_accounting_periods SET is_closed=false,version=version+1 WHERE year_id=p_year AND period_number=12;
 FOR item IN SELECT value FROM jsonb_array_elements(preview->'rows') LOOP
  b:=(item->>'balance')::numeric;f:=(item->>'foreign_balance')::numeric;
  IF b=0 OR f=0 OR sign(b)<>sign(f) THEN RAISE EXCEPTION 'Review zero or opposing local/foreign balances before closing';END IF;
  IF n=0 THEN j:=gen_random_uuid();ids:=array_append(ids,j);INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,automatic_source) VALUES(j,p_company,y.end_date,'YEAR-CLOSE','Fiscal year close: '||trim(p_reason),auth.uid(),'fiscal_close');END IF;
  n:=n+1;balance:=balance-b;
  INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,line_currency,line_rate,auxiliary_id,client_id,vendor_id,client_code,vendor_code)
  VALUES(j,n,p_company,item->>'account',item->>'name','Fiscal year closing',greatest(-b,0),greatest(b,0),greatest(-f,0),greatest(f,0),item->>'currency',(item->>'rate')::numeric,(item->>'auxiliary')::uuid,(item->>'client')::uuid,(item->>'vendor')::uuid,item->>'client_code',item->>'vendor_code');
  IF n=198 THEN
   IF balance<>0 THEN INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,line_currency,line_rate) VALUES(j,n+1,p_company,p_retained,retained_name,'Transfer to retained earnings',greatest(-balance,0),greatest(balance,0),greatest(-balance,0),greatest(balance,0),base,1);END IF;
   PERFORM tw_accounting_finish_receipt_journal(j);n:=0;balance:=0;
  END IF;
 END LOOP;
 IF n>0 THEN
  IF balance<>0 THEN INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,line_currency,line_rate) VALUES(j,n+1,p_company,p_retained,retained_name,'Transfer to retained earnings',greatest(-balance,0),greatest(balance,0),greatest(-balance,0),greatest(balance,0),base,1);END IF;
  PERFORM tw_accounting_finish_receipt_journal(j);
 END IF;
 UPDATE tw_accounting_periods SET is_closed=true,lock_reason='Fiscal year close: '||trim(p_reason),changed_at=now(),changed_by=auth.uid(),version=version+1 WHERE year_id=p_year;
 INSERT INTO tw_accounting_year_closings(id,company_id,year_id,retained_account,reason,status,journal_ids,period_snapshot,created_by) VALUES(result,p_company,p_year,p_retained,trim(p_reason),'closed',ids,periods,auth.uid());
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_closing_preview(uuid,uuid),tw_accounting_year_action(uuid,uuid,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tw_accounting_closing_preview(uuid,uuid),tw_accounting_year_action(uuid,uuid,text,text,text,text) TO authenticated;


CREATE FUNCTION tw_accounting_audit_report(p_company uuid,p_from date,p_to date,p_search text DEFAULT '',p_offset integer DEFAULT 0) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT coalesce((tw_module_access()->>'manage')::boolean,false) THEN RAISE EXCEPTION 'Accounting management access required' USING ERRCODE='42501';END IF;
 IF p_from>p_to OR p_from IS NULL OR p_to IS NULL OR length(p_search)>120 OR p_offset<0 OR p_offset>100000 THEN RAISE EXCEPTION 'Check audit filters';END IF;
 WITH entries AS(SELECT a.* FROM tw_accounting_audit a WHERE (a.occurred_at AT TIME ZONE 'Africa/Cairo')::date BETWEEN p_from AND p_to
 AND (coalesce(a.after_data->>'company_id',a.before_data->>'company_id')=p_company::text
 OR (a.table_name='tw_accounting_companies' AND coalesce(a.after_data->>'id',a.before_data->>'id')=p_company::text)
 OR (a.table_name='tw_accounting_periods' AND coalesce(a.after_data->>'year_id',a.before_data->>'year_id') IN(SELECT id::text FROM tw_accounting_years WHERE company_id=p_company)))
 AND concat_ws(' ',a.table_name,a.operation,a.after_data->>'reason',a.after_data->>'memo',a.after_data->>'reference',a.after_data->>'voucher_number') ILIKE '%'||p_search||'%')
 SELECT jsonb_build_object('count',(SELECT count(*) FROM entries),'rows',(SELECT coalesce(jsonb_agg(x ORDER BY x.id DESC),'[]') FROM(SELECT * FROM entries ORDER BY id DESC OFFSET p_offset LIMIT 50)x)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_audit_report(uuid,date,date,text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tw_accounting_audit_report(uuid,date,date,text,integer) TO authenticated;


-- Read-only aggregation over existing journals; no duplicated balances or document numbers.
CREATE OR REPLACE FUNCTION tw_accounting_financial_report(p_company uuid,p_from date,p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Check report dates';END IF;
 WITH lines AS (
 SELECT l.*,j.entry_date,j.workflow,j.automatic_source FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id
 WHERE j.company_id=p_company AND j.status='posted' AND j.entry_date<=p_to
 ), balances AS (
 SELECT a.code,a.name,a.account_type,
 coalesce(sum(l.debit-l.credit) FILTER(WHERE l.entry_date<p_from),0) opening,
 coalesce(sum(l.debit) FILTER(WHERE l.entry_date>=p_from AND coalesce(l.automatic_source,'') NOT IN('fiscal_close','fiscal_reopen')),0) debit,
 coalesce(sum(l.credit) FILTER(WHERE l.entry_date>=p_from AND coalesce(l.automatic_source,'') NOT IN('fiscal_close','fiscal_reopen')),0) credit,
 coalesce(sum(l.debit-l.credit),0) closing
 FROM tw_accounting_accounts a LEFT JOIN lines l ON l.account_code=a.code WHERE a.company_id=p_company AND a.kind<>'Group' GROUP BY a.code,a.name,a.account_type
 ), cash AS (
 SELECT l.journal_id,sum(l.debit-l.credit) amount,bool_or(l.workflow='opening') opening
 FROM lines l WHERE l.entry_date>=p_from AND l.account_code LIKE '11%' GROUP BY l.journal_id
 ), flows AS (
 SELECT c.*,CASE WHEN c.opening THEN 'Opening balances'
 WHEN count(DISTINCT CASE WHEN a.account_type='Equity' OR a.code='243001' THEN 'Financing' WHEN a.code LIKE '15%' THEN 'Investing' ELSE 'Operating' END)=1
 THEN min(CASE WHEN a.account_type='Equity' OR a.code='243001' THEN 'Financing' WHEN a.code LIKE '15%' THEN 'Investing' ELSE 'Operating' END)
 ELSE 'Unclassified / mixed' END category
 FROM cash c LEFT JOIN lines l ON l.journal_id=c.journal_id AND l.account_code NOT LIKE '11%' LEFT JOIN tw_accounting_accounts a ON a.company_id=p_company AND a.code=l.account_code
 GROUP BY c.journal_id,c.amount,c.opening
 ) SELECT jsonb_build_object('accounts',(SELECT coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'type',account_type,'opening',opening::text,'debit',debit::text,'credit',credit::text,'closing',closing::text) ORDER BY code),'[]') FROM balances),
 'cash',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT category,sum(amount)::text amount FROM flows GROUP BY category ORDER BY category)x)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_financial_report(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tw_accounting_financial_report(uuid,date,date) TO authenticated;

COMMIT;
