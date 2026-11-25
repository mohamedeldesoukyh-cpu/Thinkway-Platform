-- Background publication discovery has no auth.uid(). Attribute automatic releases
-- to the original deferral authorizer and explicitly record that provenance.
-- Do not impersonate a user or loosen posting, period, balance, or access guards.
BEGIN;
CREATE OR REPLACE FUNCTION tw_accounting_release_live_deferral() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE live date;batch record;d record;l record;jid uuid;n integer;posting_date date;template jsonb;release_actor uuid;
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
  SELECT greatest(live,entry_date),coalesce(auth.uid(),created_by) INTO posting_date,release_actor FROM tw_accounting_journals WHERE id=batch.journal_id AND status='posted';
  IF posting_date IS NULL THEN RAISE EXCEPTION 'The deferral JV must remain posted';END IF;
  jid:=gen_random_uuid();n:=0;
  INSERT INTO tw_accounting_journals(id,company_id,entry_date,activation_date,reference,memo,automatic_source,created_by,transaction_currency,exchange_rate,exchange_rate_date,posting_mapping)
  SELECT jid,id,posting_date,posting_date,NEW.document_number||' / release prebilling','Release prebilling / prepaid costs / '||NEW.document_number||' / live '||live,'campaign_deferral_release',release_actor,base_currency,1,posting_date,jsonb_build_object('deferralJournal',batch.journal_id,'assignment',NEW.id,'wentLiveDate',live,'vatUnchanged',true,'automaticRelease',auth.uid() IS NULL,'attributionBasis',CASE WHEN auth.uid() IS NULL THEN 'original_deferral_authorizer' ELSE 'authenticated_actor' END) FROM tw_accounting_companies WHERE id=batch.company_id;
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

CREATE OR REPLACE FUNCTION tw_accounting_directory_line_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
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
  -- A trigger-created reversal preserves the vendor already validated on the
  -- approved deferral. Background workers have no Accounting UI permissions.
  IF NEW.vendor_id IS NULL OR (NOT tw_accounting_eligible_vendor(NEW.vendor_id) AND NOT (
   pg_trigger_depth()>1 AND j.automatic_source='campaign_deferral_release' AND EXISTS(
    SELECT 1 FROM tw_accounting_live_deferrals d
    JOIN tw_accounting_journals original ON original.id=d.journal_id AND original.status='posted'
    JOIN tw_accounting_journal_lines src ON src.journal_id=d.journal_id AND src.line_number IN(d.pnl_line_number,d.counter_line_number)
    WHERE d.company_id=NEW.company_id AND d.journal_id::text=j.posting_mapping->>'deferralJournal'
      AND d.assignment_id::text=j.posting_mapping->>'assignment'
      AND src.vendor_id=NEW.vendor_id AND src.account_code=NEW.account_code
      AND (src.credit,src.debit,src.foreign_credit,src.foreign_debit,src.line_currency,src.line_rate)
        IS NOT DISTINCT FROM (NEW.debit,NEW.credit,NEW.foreign_debit,NEW.foreign_credit,NEW.line_currency,NEW.line_rate)
   ))) THEN RAISE EXCEPTION 'Select the vendor/creator for this account';END IF;
  SELECT document_number INTO NEW.vendor_code FROM influencers WHERE id=NEW.vendor_id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_directory_line_guard() FROM PUBLIC,anon,authenticated,service_role;

CREATE OR REPLACE FUNCTION public.tw_accounting_finish_receipt_journal(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_accounting_journals%ROWTYPE; fiscal integer; seq bigint;
BEGIN
 SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id;
 SELECT extract(year FROM y.start_date)::integer INTO fiscal FROM tw_accounting_years y JOIN tw_accounting_periods p ON p.year_id=y.id WHERE y.company_id=j.company_id AND j.entry_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed;
 IF fiscal IS NULL THEN RAISE EXCEPTION 'Choose an open receipt posting period'; END IF;
 IF (SELECT coalesce(sum(debit),0)<=0 OR sum(debit-credit)<>0 FROM tw_accounting_journal_lines WHERE journal_id=p_id) THEN RAISE EXCEPTION 'Receipt journal does not balance'; END IF;
 INSERT INTO tw_accounting_journal_sequences(company_id,fiscal_year,last_number) VALUES(j.company_id,fiscal,1)
 ON CONFLICT(company_id,fiscal_year) DO UPDATE SET last_number=tw_accounting_journal_sequences.last_number+1 RETURNING last_number INTO seq;
 UPDATE tw_accounting_journals SET status='posted',voucher_number='JV-'||fiscal||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0'),posted_by=coalesce(auth.uid(),CASE WHEN j.automatic_source='campaign_deferral_release' AND j.posting_mapping->>'automaticRelease'='true' THEN j.created_by END),posted_at=now(),version=version+1 WHERE id=p_id;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
