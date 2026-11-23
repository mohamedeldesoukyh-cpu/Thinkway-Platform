BEGIN;
ALTER TABLE tw_accounting_accounts ADD COLUMN directory_source_code text,ADD CONSTRAINT accounting_directory_source_fk FOREIGN KEY(company_id,directory_source_code) REFERENCES tw_accounting_accounts(company_id,code);
CREATE FUNCTION tw_accounting_account_directory(p_company uuid,p_account text) RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT coalesce(s.subledger,a.subledger) FROM tw_accounting_accounts a LEFT JOIN tw_accounting_accounts s ON s.company_id=a.company_id AND s.code=a.directory_source_code WHERE a.company_id=p_company AND a.code=p_account
$$;
REVOKE ALL ON FUNCTION tw_accounting_account_directory(uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_account_directory(uuid,text) TO authenticated;
CREATE FUNCTION tw_accounting_directory_account_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' AND NEW.code='313001' AND NEW.name='Partners’ Current Account' AND NEW.kind='Posting' THEN NEW.has_auxiliary:=true;END IF;
 IF TG_OP='INSERT' AND NEW.kind='Posting' AND NOT NEW.has_auxiliary AND NEW.directory_source_code IS NULL AND (NEW.code LIKE '41%' OR NEW.code LIKE '51%') AND EXISTS(SELECT 1 FROM tw_accounting_accounts WHERE company_id=NEW.company_id AND code=CASE WHEN NEW.code LIKE '41%' THEN '121001' ELSE '211001' END AND active AND kind='Control') THEN NEW.directory_source_code:=CASE WHEN NEW.code LIKE '41%' THEN '121001' ELSE '211001' END;END IF;
 IF NEW.directory_source_code IS NOT NULL THEN
  IF NEW.kind<>'Posting' OR NEW.has_auxiliary OR NEW.auxiliary_source_code IS NOT NULL OR NOT EXISTS(SELECT 1 FROM tw_accounting_accounts s WHERE s.company_id=NEW.company_id AND s.code=NEW.directory_source_code AND s.active AND s.kind='Control' AND s.subledger IN('Customer','Supplier / creator') AND s.client_id IS NULL AND s.vendor_id IS NULL) THEN RAISE EXCEPTION 'Choose an active client or vendor GL directory; component auxiliaries cannot be combined with this mode';END IF;
 END IF;
 IF TG_OP='UPDATE' AND NEW.directory_source_code IS DISTINCT FROM OLD.directory_source_code AND EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE company_id=OLD.company_id AND account_code=OLD.code) THEN RAISE EXCEPTION 'Accounts with transactions require reviewed reclassification before changing directory';END IF;
 IF TG_OP='UPDATE' AND (NEW.active,NEW.kind,NEW.subledger) IS DISTINCT FROM(OLD.active,OLD.kind,OLD.subledger) AND EXISTS(SELECT 1 FROM tw_accounting_accounts WHERE company_id=OLD.company_id AND directory_source_code=OLD.code) THEN RAISE EXCEPTION 'Other accounts use this directory; update their links first';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_directory_account_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER directory_account_guard BEFORE INSERT OR UPDATE ON tw_accounting_accounts FOR EACH ROW EXECUTE FUNCTION tw_accounting_directory_account_guard();
-- No posted data is reclassified by this setup update.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE account_code LIKE '41%' OR account_code LIKE '51%') THEN RAISE EXCEPTION 'Revenue/cost directory rollout requires reviewed existing journal reclassification';END IF;
END $$;
UPDATE tw_accounting_mappings m SET auxiliary_id=NULL,version=m.version+1 FROM tw_accounting_accounts a WHERE a.company_id=m.company_id AND a.code=m.account_code AND a.kind='Posting' AND (a.code LIKE '41%' OR a.code LIKE '51%');
UPDATE tw_accounting_auxiliaries x SET active=false,version=x.version+1 FROM tw_accounting_accounts a WHERE a.company_id=x.company_id AND a.code=x.account_code AND a.kind='Posting' AND (a.code LIKE '41%' OR a.code LIKE '51%');
UPDATE tw_accounting_accounts a SET has_auxiliary=false,auxiliary_source_code=NULL,directory_source_code=CASE WHEN a.code LIKE '41%' THEN '121001' ELSE '211001' END WHERE a.kind='Posting' AND (a.code LIKE '41%' OR a.code LIKE '51%') AND EXISTS(SELECT 1 FROM tw_accounting_accounts s WHERE s.company_id=a.company_id AND s.code=CASE WHEN a.code LIKE '41%' THEN '121001' ELSE '211001' END AND s.kind='Control' AND s.active);
-- Automatic entries carry a party from their source. Ambiguous assignment ownership is never guessed.
CREATE FUNCTION tw_accounting_assignment_vendor(p_assignment uuid) RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;n integer;BEGIN
 SELECT count(DISTINCT influencer_id),min(influencer_id::text)::uuid INTO n,result FROM campaign_influencers WHERE campaign_line_id=p_assignment;
 IF n<>1 THEN RAISE EXCEPTION 'Assignment % needs one identifiable vendor for cost accrual; review its vendor allocation',p_assignment;END IF;RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_assignment_vendor(uuid) FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION tw_accounting_directory_line_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a tw_accounting_accounts%ROWTYPE;j tw_accounting_journals%ROWTYPE;kind text;context jsonb;automatic boolean;BEGIN
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=NEW.company_id AND code=NEW.account_code;
 IF a.directory_source_code IS NULL THEN RETURN NEW;END IF;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=NEW.journal_id;
 kind:=tw_accounting_account_directory(NEW.company_id,NEW.account_code);
 automatic:=j.source_invoice_id IS NOT NULL OR j.automatic_source IS NOT NULL;
 context:=coalesce(nullif(current_setting('tw.accounting_directory_context',true),''),'{}')::jsonb;
 IF NEW.auxiliary_id IS NOT NULL THEN RAISE EXCEPTION 'Choose a client/vendor name, not a component auxiliary';END IF;
 IF kind='Customer' THEN
  IF NEW.vendor_id IS NOT NULL THEN RAISE EXCEPTION 'Choose a client for this revenue account';END IF;
  IF NEW.client_id IS NULL AND automatic THEN
   NEW.client_id:=coalesce(nullif(context->>'client','')::uuid,(SELECT client_id FROM invoices WHERE id=j.source_invoice_id),(SELECT client_id FROM tw_accounting_journal_lines WHERE journal_id=j.id AND client_id IS NOT NULL LIMIT 1),(SELECT nullif(snapshot->>'client','')::uuid FROM tw_accounting_media_postings WHERE company_id=j.company_id AND 'media_'||source_type=j.automatic_source AND snapshot->>'number'=j.reference LIMIT 1));
  END IF;
  IF NEW.client_id IS NULL OR NOT EXISTS(SELECT 1 FROM clients WHERE id=NEW.client_id) THEN RAISE EXCEPTION 'Select the client for this account';END IF;
  SELECT document_number INTO NEW.client_code FROM clients WHERE id=NEW.client_id;
 ELSE
  IF NEW.client_id IS NOT NULL THEN RAISE EXCEPTION 'Choose a vendor/creator for this cost account';END IF;
  IF NEW.vendor_id IS NULL AND automatic THEN
   NEW.vendor_id:=coalesce(nullif(context->>'vendor','')::uuid,(SELECT vendor_id FROM tw_accounting_cost_invoices WHERE company_id=j.company_id AND (journal_id=j.id OR number=j.reference) LIMIT 1),(SELECT nullif(snapshot->>'vendor','')::uuid FROM tw_accounting_media_postings WHERE company_id=j.company_id AND 'media_'||source_type=j.automatic_source AND snapshot->>'number'=j.reference LIMIT 1));
   IF NEW.vendor_id IS NULL AND nullif(context->>'assignment','') IS NOT NULL THEN NEW.vendor_id:=tw_accounting_assignment_vendor((context->>'assignment')::uuid);END IF;
  END IF;
  IF NEW.vendor_id IS NULL OR NOT tw_accounting_eligible_vendor(NEW.vendor_id) THEN RAISE EXCEPTION 'Select the vendor/creator for this account';END IF;
  SELECT document_number INTO NEW.vendor_code FROM influencers WHERE id=NEW.vendor_id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_directory_line_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER aaa_directory_line BEFORE INSERT OR UPDATE ON tw_accounting_journal_lines FOR EACH ROW EXECUTE FUNCTION tw_accounting_directory_line_guard();
DO $patch$ DECLARE d text;needle text;BEGIN
 SELECT pg_get_functiondef('tw_accounting_account_save(jsonb,integer,jsonb)'::regprocedure) INTO d;
 d:=replace(d,'auxiliary_source_code,active)','auxiliary_source_code,directory_source_code,active)');
 d:=replace(d,'a.auxiliary_source_code,a.active)','a.auxiliary_source_code,a.directory_source_code,a.active)');
 d:=replace(d,'auxiliary_source_code=a.auxiliary_source_code,active=','auxiliary_source_code=a.auxiliary_source_code,directory_source_code=a.directory_source_code,active=');EXECUTE d;
 SELECT pg_get_functiondef('tw_accounting_save_entry(uuid,uuid,date,text,text,integer,text,jsonb)'::regprocedure) INTO d;
 needle:='IF (a.kind<>''Control'' OR a.subledger NOT IN(''Customer'',''Supplier / creator'')) AND';
 IF position(needle IN d)=0 THEN RAISE EXCEPTION 'Unexpected journal validation';END IF;
 d:=replace(d,needle,'IF a.directory_source_code IS NULL AND (a.kind<>''Control'' OR a.subledger NOT IN(''Customer'',''Supplier / creator'')) AND');EXECUTE d;
 SELECT pg_get_functiondef('tw_accounting_apply_invoice_accrual(uuid,uuid,uuid,jsonb)'::regprocedure) INTO d;
 d:=replace(d,'n:=n+1;','PERFORM set_config(''tw.accounting_directory_context'',jsonb_build_object(''assignment'',x->>''assignment'')::text,true); n:=n+1;');
 d:=replace(d,' END LOOP;',' END LOOP; PERFORM set_config(''tw.accounting_directory_context'',''{}'',true);');EXECUTE d;
 SELECT pg_get_functiondef('tw_accounting_monthly_pair(uuid,jsonb,boolean,text)'::regprocedure) INTO d;
 d:=replace(d,' FOR idx IN 1..2 LOOP',' PERFORM set_config(''tw.accounting_directory_context'',p_item::text,true); FOR idx IN 1..2 LOOP');
 d:=replace(d,' END LOOP;',' END LOOP; PERFORM set_config(''tw.accounting_directory_context'',''{}'',true);');EXECUTE d;
 SELECT pg_get_functiondef('tw_accounting_media_post(uuid,text,uuid,text)'::regprocedure) INTO d;
 d:=replace(d,'tw_accounting_auto_line(j,1,revenue,raw->>''reason'',bn,0,net,0)','tw_accounting_auto_line(j,1,revenue,raw->>''reason'',bn,0,net,0,CASE WHEN client_note THEN party END,CASE WHEN NOT client_note THEN party END,partycode)');
 d:=replace(d,'tw_accounting_auto_line(j,1,revenue,raw->>''reason'',0,bn,0,net)','tw_accounting_auto_line(j,1,revenue,raw->>''reason'',0,bn,0,net,CASE WHEN client_note THEN party END,CASE WHEN NOT client_note THEN party END,partycode)');EXECUTE d;
 SELECT pg_get_functiondef('tw_accounting_cost_post(uuid,uuid,integer,numeric)'::regprocedure) INTO d;
 needle:='PERFORM tw_accounting_auto_line(j,1,c.expense_account,c.description,bn,0,c.net,0);';
 IF position(needle IN d)=0 THEN RAISE EXCEPTION 'Unexpected cost posting';END IF;
 d:=replace(d,needle,'PERFORM tw_accounting_auto_line(j,1,c.expense_account,c.description,bn,0,c.net,0,NULL,c.vendor_id,c.vendor_code);');EXECUTE d;
 SELECT pg_get_functiondef('tw_accounting_clear_cost_accrual(uuid,uuid,numeric)'::regprocedure) INTO d;
 d:=replace(d,' remaining:=abs(p_net);',' PERFORM set_config(''tw.accounting_directory_context'',jsonb_build_object(''vendor'',c.vendor_id)::text,true); remaining:=abs(p_net);');
 d:=replace(d,' END LOOP;',' END LOOP; PERFORM set_config(''tw.accounting_directory_context'',''{}'',true);');EXECUTE d;
 SELECT pg_get_functiondef('tw_accounting_statement_filtered(uuid,date,date,text,text,uuid,text,integer,uuid,jsonb)'::regprocedure) INTO d;
 d:=replace(d,'a.subledger','tw_accounting_account_directory(a.company_id,a.code)');EXECUTE d;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
