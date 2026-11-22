BEGIN;
CREATE OR REPLACE FUNCTION tw_accounting_closing_preview(p_company uuid,p_year uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE y tw_accounting_years%ROWTYPE;rows jsonb;result jsonb;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 SELECT * INTO y FROM tw_accounting_years WHERE id=p_year AND company_id=p_company;IF NOT FOUND THEN RAISE EXCEPTION 'Fiscal year unavailable';END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('account',account,'name',name,'auxiliary',auxiliary,'client',client,'vendor',vendor,'client_code',client_code,'vendor_code',vendor_code,'currency',currency,'rate',rate::text,'balance',balance::text,'foreign_balance',foreign_balance::text)),'[]') INTO rows FROM tw_accounting_closing_lines(p_company,p_year);
 result:=jsonb_build_object('rows',rows,'ended',y.end_date<(now() AT TIME ZONE 'Africa/Cairo')::date,
 'unlocked',(SELECT count(*) FROM tw_accounting_journals WHERE company_id=p_company AND entry_date BETWEEN y.start_date AND y.end_date AND NOT control_locked),
 'pending',(SELECT count(*) FROM tw_accounting_journals WHERE company_id=p_company AND entry_date BETWEEN y.start_date AND y.end_date AND status IN('draft','pending')),
 'openStatements',(SELECT count(*) FROM tw_accounting_bank_statements WHERE company_id=p_company AND to_date<=y.end_date AND status='open'),
 'history',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY created_at DESC),'[]') FROM tw_accounting_year_closings x WHERE company_id=p_company AND year_id=p_year));
 RETURN result||jsonb_build_object('snapshot',md5(result::text));
END $$;

CREATE OR REPLACE FUNCTION tw_accounting_year_action(p_company uuid,p_year uuid,p_action text,p_retained text,p_reason text,p_snapshot text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
   UPDATE tw_accounting_journals SET control_locked=false,control_reason=trim(p_reason),version=version+1 WHERE id=original AND control_locked;
   r:=gen_random_uuid();INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,automatic_source,reversal_of,reversal_reason) VALUES(r,p_company,y.end_date,'YEAR-REOPEN','Fiscal year reopen: '||trim(p_reason),auth.uid(),'fiscal_reopen',original,trim(p_reason));
   INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,line_currency,line_rate,auxiliary_id,client_id,vendor_id,client_code,vendor_code)
   SELECT r,line_number,company_id,account_code,account_name,description,credit,debit,foreign_credit,foreign_debit,line_currency,line_rate,auxiliary_id,client_id,vendor_id,client_code,vendor_code FROM tw_accounting_journal_lines WHERE journal_id=original;
   PERFORM tw_accounting_finish_receipt_journal(r);
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(closed.period_snapshot) LOOP
   UPDATE tw_accounting_periods SET is_closed=(item->>'is_closed')::boolean,lock_reason=item->>'lock_reason',changed_at=now(),changed_by=auth.uid(),version=version+1 WHERE id=(item->>'id')::uuid;
  END LOOP;RETURN closed.id;
 END IF;
 IF (preview->>'unlocked')::integer>0 THEN RAISE EXCEPTION 'Lock all transactions before closing the fiscal year';END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_closing_lines(p_company,p_year) AS line GROUP BY line.account,line.auxiliary,line.client,line.vendor HAVING sum(line.balance)<>0) THEN RAISE EXCEPTION 'Close remaining P&L balances using Close P&L Accounts, post the reviewed JV and lock it before closing the year';END IF;
 IF closed.id IS NOT NULL THEN RAISE EXCEPTION 'Year is already closed';END IF;
 IF NOT (preview->>'ended')::boolean THEN RAISE EXCEPTION 'Fiscal year must end before closing';END IF;
 IF (preview->>'pending')::integer>0 OR (preview->>'openStatements')::integer>0 THEN RAISE EXCEPTION 'Resolve pending journals and open bank statements before closing';END IF;
 SELECT name INTO retained_name FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_retained AND account_type='Equity' AND kind='Posting' AND active AND NOT has_auxiliary;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an active retained earnings equity account without auxiliaries';END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_years z WHERE z.company_id=p_company AND z.end_date<y.start_date AND NOT EXISTS(SELECT 1 FROM tw_accounting_year_closings x WHERE x.year_id=z.id AND x.status='closed') AND EXISTS(SELECT 1 FROM tw_accounting_journals WHERE company_id=p_company AND entry_date BETWEEN z.start_date AND z.end_date AND status='posted')) THEN RAISE EXCEPTION 'Close earlier active fiscal years first';END IF;
 IF (SELECT count(*) FROM tw_accounting_periods WHERE year_id=p_year)<>12 THEN RAISE EXCEPTION 'Fiscal year requires twelve periods';END IF;
 SELECT jsonb_agg(to_jsonb(p) ORDER BY period_number) INTO periods FROM tw_accounting_periods p WHERE year_id=p_year;
 UPDATE tw_accounting_periods SET is_closed=false,version=version+1 WHERE year_id=p_year AND period_number=12;
 UPDATE tw_accounting_periods SET is_closed=true,lock_reason='Fiscal year close: '||trim(p_reason),changed_at=now(),changed_by=auth.uid(),version=version+1 WHERE year_id=p_year;
 INSERT INTO tw_accounting_year_closings(id,company_id,year_id,retained_account,reason,status,journal_ids,period_snapshot,created_by) VALUES(result,p_company,p_year,p_retained,trim(p_reason),'closed',ids,periods,auth.uid());
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION tw_accounting_closed_year_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE cid uuid;day date;
BEGIN
 IF TG_TABLE_NAME='tw_accounting_periods' THEN
  IF OLD.is_closed AND NOT NEW.is_closed AND EXISTS(SELECT 1 FROM tw_accounting_year_closings WHERE year_id=OLD.year_id AND status='closed') THEN RAISE EXCEPTION 'Reopen the fiscal year before reopening its periods';END IF;RETURN NEW;
 END IF;
 IF TG_TABLE_NAME='tw_accounting_journal_lines' THEN
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)-'account_name') IS NOT DISTINCT FROM (to_jsonb(OLD)-'account_name') THEN RETURN NEW;END IF;
  SELECT company_id,entry_date INTO cid,day FROM tw_accounting_journals WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.journal_id ELSE NEW.journal_id END;
 ELSE
  IF TG_OP='UPDATE' AND OLD.control_locked AND NOT NEW.control_locked THEN
   PERFORM 1 FROM tw_accounting_companies WHERE id=OLD.company_id FOR UPDATE;
   IF EXISTS(SELECT 1 FROM tw_accounting_year_closings x JOIN tw_accounting_years y ON y.id=x.year_id WHERE x.company_id=OLD.company_id AND x.status='closed' AND OLD.entry_date BETWEEN y.start_date AND y.end_date) THEN RAISE EXCEPTION 'Reopen the fiscal year before unlocking its transactions';END IF;
  END IF;
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


ALTER TABLE tw_accounting_journals DROP CONSTRAINT tw_accounting_journals_workflow_check;
ALTER TABLE tw_accounting_journals ADD CONSTRAINT tw_accounting_journals_workflow_check CHECK(workflow IN('general','transfer','opening','closing'));
DO $patch$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('tw_accounting_save_workflow(jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'w NOT IN(''general'',''opening'',''transfer'')','w NOT IN(''general'',''opening'',''transfer'',''closing'')');
 EXECUTE definition;
 SELECT pg_get_functiondef('tw_accounting_check_workflow(uuid)'::regprocedure) INTO definition;
 definition:=replace(definition,'IF j.workflow=''general'' THEN RETURN; END IF;',
 'IF j.workflow=''general'' THEN RETURN; END IF;
 IF j.workflow=''closing'' THEN
  IF j.reversal_of IS NULL AND NOT EXISTS(SELECT 1 FROM tw_accounting_years WHERE company_id=j.company_id AND end_date=j.entry_date) THEN RAISE EXCEPTION ''P&L closing JV must use the fiscal year-end date''; END IF;
  IF NOT EXISTS(SELECT 1 FROM tw_accounting_journal_lines l JOIN tw_accounting_accounts a ON a.company_id=l.company_id AND a.code=l.account_code WHERE l.journal_id=j.id AND a.account_type IN(''Revenue'',''Expense'')) THEN RAISE EXCEPTION ''Closing JV requires P&L accounts''; END IF;
  RETURN;
 END IF;');
 EXECUTE definition;
 SELECT pg_get_functiondef('tw_accounting_reverse_journal(uuid,uuid,uuid,date,text)'::regprocedure) INTO definition;
 -- Reversal keeps its closing classification so P&L performance excludes both sides.
 definition:=replace(definition,'VALUES(p_reversal,p_company,p_date,j.voucher_number', 'VALUES(p_reversal,p_company,p_date,j.voucher_number');
 definition:=replace(definition,'entry_kind,source_invoice_id,transaction_currency','entry_kind,workflow,source_invoice_id,transaction_currency');
 definition:=replace(definition,'j.entry_kind,j.source_invoice_id,j.transaction_currency','j.entry_kind,CASE WHEN j.workflow=''closing'' THEN ''closing'' ELSE ''general'' END,j.source_invoice_id,j.transaction_currency');
 EXECUTE definition;
 SELECT pg_get_functiondef('tw_accounting_financial_report(uuid,date,date)'::regprocedure) INTO definition;
 definition:=replace(definition,'j.workflow,j.automatic_source','j.workflow,CASE WHEN j.workflow=''closing'' THEN ''fiscal_close'' ELSE j.automatic_source END automatic_source');
 EXECUTE definition;
 SELECT pg_get_functiondef('tw_accounting_statement_filtered(uuid,date,date,text,text,uuid,text,integer,uuid,jsonb)'::regprocedure) INTO definition;
 definition:=replace(definition,'j.status=''posted''','j.status=''posted'' AND (coalesce(p_options->>''excludeClosing'',''false'')<>''true'' OR j.workflow<>''closing'')');
 EXECUTE definition;
END $patch$;

NOTIFY pgrst, 'reload schema';
COMMIT;

