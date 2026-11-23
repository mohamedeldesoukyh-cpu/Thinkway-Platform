-- Approved campaign reclassifications: preserve source invoices, VAT and cash.
-- Each batch is one JV; each assignment releases only its own tracked balance.
CREATE TABLE public.tw_accounting_live_deferrals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),
 assignment_id uuid NOT NULL REFERENCES campaign_lines(id),
 source_line_ids text[] NOT NULL CHECK(cardinality(source_line_ids)>0),
 journal_id uuid NOT NULL REFERENCES tw_accounting_journals(id),
 pnl_line_number integer NOT NULL,
 counter_line_number integer NOT NULL,
 FOREIGN KEY(journal_id,pnl_line_number) REFERENCES tw_accounting_journal_lines(journal_id,line_number),
 FOREIGN KEY(journal_id,counter_line_number) REFERENCES tw_accounting_journal_lines(journal_id,line_number),
 release_journal_id uuid REFERENCES tw_accounting_journals(id),
 live_date date,
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK ((release_journal_id IS NULL)=(live_date IS NULL))
);
CREATE INDEX ON tw_accounting_live_deferrals(assignment_id) WHERE release_journal_id IS NULL;
ALTER TABLE tw_accounting_live_deferrals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tw_accounting_live_deferrals FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON tw_accounting_live_deferrals TO authenticated;
CREATE POLICY accounting_live_deferrals_read ON tw_accounting_live_deferrals FOR SELECT TO authenticated
 USING(coalesce((tw_module_access()->>'accounting')::boolean,false));
CREATE TRIGGER accounting_live_deferral_audit AFTER INSERT OR UPDATE OR DELETE ON tw_accounting_live_deferrals
 FOR EACH ROW EXECUTE FUNCTION tw_accounting_audit_change();

CREATE FUNCTION tw_accounting_defer_campaign_lines(p_company uuid,p_date date,p_reference text,p_items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE jid uuid:=gen_random_uuid();item jsonb;ids text[];r tw_accounting_journal_lines%ROWTYPE;
 a campaign_lines%ROWTYPE;acct tw_accounting_accounts%ROWTYPE;counter tw_accounting_accounts%ROWTYPE;
 n integer:=0;cnt integer;amount numeric;native numeric;prior uuid;template jsonb;today date:=(now() AT TIME ZONE 'Africa/Cairo')::date;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 IF NOT FOUND OR p_date IS NULL OR p_date>today OR nullif(trim(p_reference),'') IS NULL OR jsonb_typeof(p_items)<>'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid deferral batch';END IF;
 SELECT id INTO prior FROM tw_accounting_journals WHERE company_id=p_company AND reference=p_reference AND automatic_source='campaign_deferral';
 IF prior IS NOT NULL THEN
  IF EXISTS(SELECT 1 FROM tw_accounting_journals WHERE id=prior AND status='posted' AND posting_mapping->'items'=p_items AND entry_date=p_date) THEN RETURN prior;END IF;
  RAISE EXCEPTION 'Deferral reference already used with different contents';
 END IF;
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,activation_date,reference,memo,automatic_source,created_by,transaction_currency,exchange_rate,exchange_rate_date,posting_mapping)
 SELECT jid,id,p_date,p_date,p_reference,'Prebilling and prepaid campaign costs / not-live creator lines / VAT unchanged','campaign_deferral',auth.uid(),base_currency,1,p_date,jsonb_build_object('items',p_items,'basis','assignment_went_live','vatUnchanged',true) FROM tw_accounting_companies WHERE id=p_company;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  SELECT * INTO STRICT a FROM campaign_lines WHERE id=(item->>'assignment')::uuid FOR UPDATE;
  IF a.status::text='cancelled' OR (coalesce(a.metadata->>'went_live','true')<>'false' AND nullif(a.metadata->>'went_live_date','') IS NOT NULL AND (a.metadata->>'went_live_date')::date<=today) THEN RAISE EXCEPTION 'Assignment % is cancelled or already live',a.document_number;END IF;
  SELECT array_agg(value) INTO ids FROM jsonb_array_elements_text(item->'sources');
  IF ids IS NULL OR cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids)x) OR EXISTS(SELECT 1 FROM tw_accounting_live_deferrals WHERE source_line_ids && ids) THEN RAISE EXCEPTION 'Source lines are missing, duplicated or already deferred';END IF;
  PERFORM 1 FROM tw_accounting_journals WHERE id IN(SELECT journal_id FROM tw_accounting_journal_lines WHERE journal_id::text||':'||line_number=ANY(ids)) ORDER BY id FOR UPDATE;
  SELECT * INTO STRICT r FROM tw_accounting_journal_lines WHERE journal_id::text||':'||line_number=ids[1];
  SELECT * INTO STRICT acct FROM tw_accounting_accounts WHERE company_id=p_company AND code=r.account_code;
  IF acct.account_type NOT IN('Revenue','Expense') THEN RAISE EXCEPTION 'Only revenue or expense can be deferred; VAT and settlement accounts are excluded';END IF;
  SELECT count(*) INTO cnt FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id
   WHERE l.journal_id::text||':'||l.line_number=ANY(ids) AND l.company_id=p_company AND j.status='posted' AND j.entry_date<=p_date
   AND (l.account_code,l.client_id,l.vendor_id,l.auxiliary_id,l.line_currency,l.line_rate) IS NOT DISTINCT FROM (r.account_code,r.client_id,r.vendor_id,r.auxiliary_id,r.line_currency,r.line_rate)
   AND ((acct.account_type='Revenue' AND l.credit>0 AND l.debit=0) OR (acct.account_type='Expense' AND l.debit>0 AND l.credit=0))
   AND (l.description ~ ('(^|[^A-Za-z0-9-])'||a.document_number||'([^A-Za-z0-9-]|$)')
     OR EXISTS(SELECT 1 FROM tw_accounting_cost_invoices c WHERE c.journal_id=j.id AND c.assignment_line_id=a.id));
  IF cnt<>cardinality(ids) THEN RAISE EXCEPTION 'Source posting does not match the assignment, currency or selected component';END IF;
  SELECT * INTO STRICT counter FROM tw_accounting_accounts WHERE company_id=p_company AND code=CASE WHEN acct.account_type='Revenue' THEN '221001' ELSE '133001' END AND active;
  IF counter.account_type<>(CASE WHEN acct.account_type='Revenue' THEN 'Liability' ELSE 'Asset' END) THEN RAISE EXCEPTION 'Invalid deferral account';END IF;
  SELECT sum(debit+credit),sum(foreign_debit+foreign_credit) INTO amount,native FROM tw_accounting_journal_lines WHERE journal_id::text||':'||line_number=ANY(ids);
  
  template:=to_jsonb(r)||jsonb_build_object('journal_id',jid,'entered_side',NULL,'entered_amount',NULL,'line_number',n+1,'description',left('Defer until creator line goes live / '||a.document_number||' / '||a.name,500),'debit',CASE WHEN acct.account_type='Revenue' THEN amount ELSE 0 END,'credit',CASE WHEN acct.account_type='Expense' THEN amount ELSE 0 END,'foreign_debit',CASE WHEN acct.account_type='Revenue' THEN native ELSE 0 END,'foreign_credit',CASE WHEN acct.account_type='Expense' THEN native ELSE 0 END);
  INSERT INTO tw_accounting_journal_lines SELECT (jsonb_populate_record(NULL::tw_accounting_journal_lines,template)).*;
  template:=template||jsonb_build_object('line_number',n+2,'account_code',counter.code,'account_name',counter.name,'auxiliary_id',NULL,'debit',CASE WHEN acct.account_type='Expense' THEN amount ELSE 0 END,'credit',CASE WHEN acct.account_type='Revenue' THEN amount ELSE 0 END,'foreign_debit',CASE WHEN acct.account_type='Expense' THEN native ELSE 0 END,'foreign_credit',CASE WHEN acct.account_type='Revenue' THEN native ELSE 0 END);
  INSERT INTO tw_accounting_journal_lines SELECT (jsonb_populate_record(NULL::tw_accounting_journal_lines,template)).*;
  INSERT INTO tw_accounting_live_deferrals(company_id,assignment_id,source_line_ids,journal_id,pnl_line_number,counter_line_number) VALUES(p_company,a.id,ids,jid,n+1,n+2);n:=n+2;
 END LOOP;
 PERFORM tw_accounting_finish_receipt_journal(jid);RETURN jid;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_defer_campaign_lines(uuid,date,text,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_defer_campaign_lines(uuid,date,text,jsonb) TO authenticated;

-- Trigger-only release: Media permission to mark the assignment live remains
-- authoritative. It cannot choose amounts/accounts or call this function directly.
CREATE FUNCTION tw_accounting_release_live_deferral() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE live date;batch record;d record;l record;jid uuid;n integer;posting_date date;template jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_live_deferrals WHERE assignment_id=NEW.id) THEN RETURN NEW;END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_live_deferrals WHERE assignment_id=NEW.id AND release_journal_id IS NOT NULL)
  AND ((NEW.metadata->>'went_live_date',NEW.metadata->>'went_live',NEW.status::text) IS DISTINCT FROM (OLD.metadata->>'went_live_date',OLD.metadata->>'went_live',OLD.status::text)) THEN
  IF NEW.status::text='cancelled' OR coalesce(NEW.metadata->>'went_live','true')='false' OR NEW.metadata->>'went_live_date' IS DISTINCT FROM OLD.metadata->>'went_live_date' THEN RAISE EXCEPTION 'This live date has released Accounting deferrals; review the linked JVs before changing it';END IF;
 END IF;
 IF NEW.status::text='cancelled' OR coalesce(NEW.metadata->>'went_live','true')='false' OR nullif(NEW.metadata->>'went_live_date','') IS NULL THEN RETURN NEW;END IF;
 live:=(NEW.metadata->>'went_live_date')::date;
 IF live>(now() AT TIME ZONE 'Africa/Cairo')::date THEN RAISE EXCEPTION 'A tracked deferral requires an actual went-live date, not a future date';END IF;
 FOR batch IN SELECT DISTINCT company_id,journal_id FROM tw_accounting_live_deferrals WHERE assignment_id=NEW.id AND release_journal_id IS NULL ORDER BY company_id,journal_id LOOP
  PERFORM 1 FROM tw_accounting_companies WHERE id=batch.company_id FOR UPDATE;
  IF NOT EXISTS(SELECT 1 FROM tw_accounting_live_deferrals WHERE assignment_id=NEW.id AND journal_id=batch.journal_id AND release_journal_id IS NULL) THEN CONTINUE;END IF;
  SELECT greatest(live,entry_date) INTO posting_date FROM tw_accounting_journals WHERE id=batch.journal_id AND status='posted';
  IF posting_date IS NULL THEN RAISE EXCEPTION 'The deferral JV must remain posted';END IF;
  jid:=gen_random_uuid();n:=0;
  INSERT INTO tw_accounting_journals(id,company_id,entry_date,activation_date,reference,memo,automatic_source,created_by,transaction_currency,exchange_rate,exchange_rate_date,posting_mapping)
  SELECT jid,id,posting_date,posting_date,NEW.document_number||' / release prebilling','Release prebilling / prepaid costs / '||NEW.document_number||' / live '||live,'campaign_deferral_release',auth.uid(),base_currency,1,posting_date,jsonb_build_object('deferralJournal',batch.journal_id,'assignment',NEW.id,'wentLiveDate',live,'vatUnchanged',true) FROM tw_accounting_companies WHERE id=batch.company_id;
  FOR d IN SELECT * FROM tw_accounting_live_deferrals WHERE assignment_id=NEW.id AND journal_id=batch.journal_id AND release_journal_id IS NULL ORDER BY id FOR UPDATE LOOP
   FOR l IN SELECT * FROM tw_accounting_journal_lines WHERE journal_id=d.journal_id AND line_number IN(d.pnl_line_number,d.counter_line_number) ORDER BY line_number LOOP
    n:=n+1;template:=to_jsonb(l)||jsonb_build_object('journal_id',jid,'line_number',n,'description',left('Went live / release deferral / '||NEW.document_number||' / '||NEW.name,500),'debit',l.credit,'credit',l.debit,'foreign_debit',l.foreign_credit,'foreign_credit',l.foreign_debit);
    INSERT INTO tw_accounting_journal_lines SELECT (jsonb_populate_record(NULL::tw_accounting_journal_lines,template)).*;
   END LOOP;
   UPDATE tw_accounting_live_deferrals SET release_journal_id=jid,live_date=live WHERE id=d.id;
  END LOOP;
  PERFORM tw_accounting_finish_receipt_journal(jid);
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_release_live_deferral() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER accounting_release_live_deferral AFTER UPDATE OF metadata,status ON campaign_lines
 FOR EACH ROW EXECUTE FUNCTION tw_accounting_release_live_deferral();

CREATE FUNCTION tw_accounting_live_deferral_dependency_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM OLD.status AND OLD.status='posted' AND EXISTS(
  SELECT 1 FROM tw_accounting_live_deferrals d WHERE d.journal_id=OLD.id OR d.release_journal_id=OLD.id OR EXISTS(SELECT 1 FROM tw_accounting_journal_lines l WHERE l.journal_id::text||':'||l.line_number=ANY(d.source_line_ids) AND l.journal_id=OLD.id))
 THEN RAISE EXCEPTION 'This JV is linked to tracked prebilling/prepaid costs; use an audited correcting entry';END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_live_deferral_dependency_guard() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER accounting_live_deferral_dependency BEFORE UPDATE OF status ON tw_accounting_journals
 FOR EACH ROW EXECUTE FUNCTION tw_accounting_live_deferral_dependency_guard();
