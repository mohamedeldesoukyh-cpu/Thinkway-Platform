BEGIN;
-- debit/credit remain company-base amounts for all existing financial reports.
ALTER TABLE public.tw_accounting_journals
 ADD COLUMN transaction_currency text,
 ADD COLUMN exchange_rate numeric(24,8) CHECK(exchange_rate>0),
 ADD COLUMN exchange_rate_date date,
 ADD COLUMN unposted_at timestamptz,
 ADD COLUMN unposted_by uuid REFERENCES public.profiles(id),
 ADD COLUMN unpost_reason text;
ALTER TABLE public.tw_accounting_journal_lines
 ADD COLUMN foreign_debit numeric(18,2), ADD COLUMN foreign_credit numeric(18,2),
 ADD CONSTRAINT tw_line_foreign_amounts CHECK ((foreign_debit IS NULL AND foreign_credit IS NULL) OR
 (foreign_debit IS NOT NULL AND foreign_credit IS NOT NULL AND ((foreign_debit>0 AND foreign_credit=0) OR (foreign_credit>0 AND foreign_debit=0))));
UPDATE public.tw_accounting_journals j SET transaction_currency=c.base_currency,exchange_rate=1,exchange_rate_date=j.entry_date
 FROM public.tw_accounting_companies c WHERE c.id=j.company_id AND j.source_invoice_id IS NOT NULL;
UPDATE public.tw_accounting_journal_lines l SET foreign_debit=l.debit,foreign_credit=l.credit
 FROM public.tw_accounting_journals j WHERE j.id=l.journal_id AND j.source_invoice_id IS NOT NULL;
ALTER TABLE public.tw_accounting_journals DROP CONSTRAINT tw_accounting_journals_status_check,
 DROP CONSTRAINT tw_accounting_journals_check,
 ADD CONSTRAINT tw_accounting_journals_status_check CHECK(status IN ('draft','posted','cancelled','pending')),
 ADD CONSTRAINT tw_journal_number_state CHECK(
 (status IN ('posted','pending') AND voucher_number IS NOT NULL AND posted_by IS NOT NULL AND posted_at IS NOT NULL)
 OR (status IN ('draft','cancelled') AND voucher_number IS NULL AND posted_by IS NULL AND posted_at IS NULL)),
 ADD CONSTRAINT tw_pending_source CHECK(status<>'pending' OR (source_invoice_id IS NOT NULL AND reversal_of IS NULL));
ALTER TABLE public.tw_accounting_invoice_submissions DROP CONSTRAINT tw_accounting_invoice_submissions_status_check,
 DROP CONSTRAINT tw_accounting_invoice_submissions_check,
 ADD CONSTRAINT tw_invoice_status CHECK(status IN ('submitted','withdrawn','posted','pending')),
 ADD CONSTRAINT tw_invoice_journal_state CHECK(status NOT IN ('posted','pending') OR journal_id IS NOT NULL);

-- Authorization checked again by invoice and line triggers, not just the UI.
CREATE FUNCTION public.tw_accounting_invoice_correction_allowed(p_invoice uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(auth.jwt()->>'aal','')='aal2' AND has_permission('finance.regenerate')
 AND tw_accounting_media_invoice_access(p_invoice,true)
 AND EXISTS(SELECT 1 FROM tw_accounting_invoice_submissions s JOIN tw_accounting_journals j ON j.id=s.journal_id
 JOIN invoices i ON i.id=s.invoice_id WHERE s.invoice_id=p_invoice AND s.status='pending' AND j.status='pending'
 AND i.status::text NOT IN ('paid','partial','void') AND coalesce(i.amount_paid,0)=0
 AND NOT EXISTS(SELECT 1 FROM finance_documents f WHERE f.source_table='invoices' AND f.source_id=i.id AND (f.posted_at IS NOT NULL OR f.posting_batch_id IS NOT NULL))
 AND NOT EXISTS(SELECT 1 FROM client_credit_notes WHERE invoice_id=i.id AND status::text NOT IN ('cancelled','void'))
 AND NOT EXISTS(SELECT 1 FROM client_debit_notes WHERE invoice_id=i.id AND status::text NOT IN ('cancelled','void')));
$$;
REVOKE ALL ON FUNCTION public.tw_accounting_invoice_correction_allowed(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_accounting_invoice_correction_allowed(uuid) TO authenticated;

CREATE FUNCTION public.tw_accounting_invoice_fx(p_invoice uuid,p_company uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s tw_accounting_invoice_submissions%ROWTYPE; base text; rate numeric;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM tw_accounting_invoice_submissions WHERE invoice_id=p_invoice AND company_id=p_company;
 IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE id=p_company;
 IF s.status IN ('posted','pending') THEN
  RETURN (SELECT jsonb_build_object('currency',transaction_currency,'base',base,'rate',exchange_rate::text,'date',exchange_rate_date) FROM tw_accounting_journals WHERE id=s.journal_id);
 END IF;
 rate:=resolve_effective_exchange_rate(s.source->>'currency',base,(s.source->>'date')::date);
 RETURN jsonb_build_object('currency',s.source->>'currency','base',base,'rate',rate::text,'date',s.source->>'date');
END $$;
REVOKE ALL ON FUNCTION public.tw_accounting_invoice_fx(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_accounting_invoice_fx(uuid,uuid) TO authenticated;

CREATE FUNCTION public.tw_accounting_unpost_invoice(p_invoice uuid,p_company uuid,p_version integer,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s tw_accounting_invoice_submissions%ROWTYPE; i invoices%ROWTYPE; j tw_accounting_journals%ROWTYPE;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM invoices WHERE id=p_invoice FOR UPDATE;
 SELECT * INTO s FROM tw_accounting_invoice_submissions WHERE invoice_id=p_invoice AND company_id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Submission not found'; END IF;
 IF s.status='pending' AND s.version=p_version+1 THEN RETURN s.journal_id; END IF;
 IF s.status<>'posted' OR p_version IS NULL OR s.version<>p_version THEN RAISE EXCEPTION 'Submission changed. Reload before unposting.' USING ERRCODE='40001'; END IF;
 IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Enter an unposting reason'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=s.journal_id FOR UPDATE;
 IF j.status<>'posted' OR EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=j.id) THEN RAISE EXCEPTION 'A reversed journal cannot be unposted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_periods p JOIN tw_accounting_years y ON y.id=p.year_id WHERE y.company_id=p_company AND j.entry_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed)
 THEN RAISE EXCEPTION 'The original posting period is closed'; END IF;
 IF coalesce(i.amount_paid,0)<>0 OR i.status::text IN ('paid','partial','void') THEN RAISE EXCEPTION 'Resolve payments or cancellation before correcting this invoice'; END IF;
 IF EXISTS(SELECT 1 FROM finance_documents f WHERE f.source_table='invoices' AND f.source_id=i.id AND (f.posted_at IS NOT NULL OR f.posting_batch_id IS NOT NULL))
 THEN RAISE EXCEPTION 'Resolve external ERP posting before unposting'; END IF;
 IF EXISTS(SELECT 1 FROM client_credit_notes WHERE invoice_id=i.id AND status::text NOT IN ('cancelled','void'))
 OR EXISTS(SELECT 1 FROM client_debit_notes WHERE invoice_id=i.id AND status::text NOT IN ('cancelled','void'))
 THEN RAISE EXCEPTION 'Resolve linked credit/debit notes before correcting this invoice'; END IF;
 UPDATE tw_accounting_journals SET status='pending',unposted_at=now(),unposted_by=auth.uid(),unpost_reason=trim(p_reason),version=version+1,updated_at=now() WHERE id=j.id;
 UPDATE tw_accounting_invoice_submissions SET status='pending',version=version+1 WHERE invoice_id=p_invoice;
 RETURN j.id;
END $$;
REVOKE ALL ON FUNCTION public.tw_accounting_unpost_invoice(uuid,uuid,integer,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_accounting_unpost_invoice(uuid,uuid,integer,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tw_accounting_submit_invoice(p_invoice uuid,p_company uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i invoices%ROWTYPE; s tw_accounting_invoice_submissions%ROWTYPE; customer clients%ROWTYPE; base text;
BEGIN
 IF NOT tw_accounting_media_invoice_access(p_invoice,true) OR coalesce(auth.jwt()->>'aal','')<>'aal2' THEN RAISE EXCEPTION 'Invoice write access and verified MFA required' USING ERRCODE='42501'; END IF;
 -- Source row first: invoice edits and all bridge mutations share this lock order.
 SELECT * INTO i FROM invoices WHERE id=p_invoice FOR UPDATE;
 SELECT * INTO s FROM tw_accounting_invoice_submissions WHERE invoice_id=p_invoice FOR UPDATE;
 IF FOUND AND s.status NOT IN ('withdrawn','pending') THEN
  IF s.company_id<>p_company THEN RAISE EXCEPTION 'Invoice is already assigned to another accounting company'; END IF;
  RETURN p_invoice;
 END IF;
 IF s.journal_id IS NOT NULL AND (s.company_id<>p_company OR NOT tw_accounting_invoice_correction_allowed(p_invoice)) THEN RAISE EXCEPTION 'Correction access required for the original accounting company'; END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE id=p_company;
 IF NOT FOUND THEN RAISE EXCEPTION 'Accounting company not found'; END IF;
 IF i.status::text='void' OR i.regeneration_status::text IS DISTINCT FROM 'active' OR i.issue_date IS NULL
 OR (i.amounts_finalized_at IS NULL AND i.status::text='draft') THEN RAISE EXCEPTION 'Only finalized, active issued invoices can be submitted'; END IF;
 PERFORM resolve_effective_exchange_rate(trim(i.currency),base,i.issue_date);
 IF i.subtotal IS NULL OR i.tax_amount IS NULL OR i.total IS NULL OR i.subtotal<=0 OR i.tax_amount<0
 OR i.total<>i.subtotal+i.tax_amount OR i.subtotal<>round(i.subtotal,2) OR i.tax_amount<>round(i.tax_amount,2)
 THEN RAISE EXCEPTION 'Invoice amounts must be positive, reconcile, and use at most two decimal places'; END IF;
 IF i.revenue_before_vat IS DISTINCT FROM i.subtotal OR i.revenue_vat_amount IS DISTINCT FROM i.tax_amount OR i.revenue_after_vat IS DISTINCT FROM i.total
 THEN RAISE EXCEPTION 'Invoice financial totals disagree. Reconcile the source before submitting.'; END IF;
 SELECT * INTO customer FROM clients WHERE id=i.client_id;
 IF customer.id IS NULL OR nullif(trim(customer.document_number),'') IS NULL THEN RAISE EXCEPTION 'The client needs an existing Thinkway client code'; END IF;
 INSERT INTO tw_accounting_invoice_submissions(invoice_id,company_id,client_id,client_code,client_name,source,status,submitted_by)
 VALUES(i.id,p_company,i.client_id,customer.document_number,customer.name,tw_accounting_invoice_snapshot(i),'submitted',auth.uid())
 ON CONFLICT(invoice_id) DO UPDATE SET company_id=excluded.company_id,client_id=excluded.client_id,client_code=excluded.client_code,
 client_name=excluded.client_name,source=excluded.source,status='submitted',version=tw_accounting_invoice_submissions.version+1,
 submitted_by=auth.uid(),submitted_at=now();
 RETURN p_invoice;
END $$;
CREATE OR REPLACE FUNCTION public.tw_accounting_withdraw_invoice(p_invoice uuid,p_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (tw_accounting_can_manage() OR (tw_accounting_media_invoice_access(p_invoice,true) AND coalesce(auth.jwt()->>'aal','')='aal2'))
 THEN RAISE EXCEPTION 'Management access and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM invoices WHERE id=p_invoice FOR UPDATE;
 UPDATE tw_accounting_invoice_submissions SET status=CASE WHEN journal_id IS NULL THEN 'withdrawn' ELSE 'pending' END,version=version+1 WHERE invoice_id=p_invoice AND status='submitted' AND version=p_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Submission changed or is already posted. Reload.' USING ERRCODE='40001'; END IF;
END $$;
DROP FUNCTION public.tw_accounting_post_invoice(uuid,uuid,integer,date,text,text,text);
CREATE OR REPLACE FUNCTION public.tw_accounting_post_invoice(p_invoice uuid,p_company uuid,p_version integer,p_date date,p_receivable text,p_revenue text,p_vat text,p_expected_rate numeric DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s tw_accounting_invoice_submissions%ROWTYPE; i invoices%ROWTYPE; a tw_accounting_accounts%ROWTYPE;
 jid uuid:=gen_random_uuid(); fiscal integer; seq bigint; base text; rate numeric; local_net numeric; local_tax numeric; existing tw_accounting_journals%ROWTYPE;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM invoices WHERE id=p_invoice FOR UPDATE;
 SELECT * INTO s FROM tw_accounting_invoice_submissions WHERE invoice_id=p_invoice FOR UPDATE;
 IF NOT FOUND OR s.company_id<>p_company THEN RAISE EXCEPTION 'Submission not found in this company'; END IF;
 IF s.status='posted' THEN RETURN s.journal_id; END IF;
 IF s.status<>'submitted' OR p_version IS NULL OR p_version<>s.version THEN RAISE EXCEPTION 'Submission changed. Reload before posting.' USING ERRCODE='40001'; END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 IF tw_accounting_invoice_snapshot(i) IS DISTINCT FROM s.source OR i.status::text='void' OR i.regeneration_status::text IS DISTINCT FROM 'active'
 THEN RAISE EXCEPTION 'Source invoice changed or is unavailable. Withdraw and review it in Media.'; END IF;
 rate:=resolve_effective_exchange_rate(trim(i.currency),base,i.issue_date);
 IF p_expected_rate IS NOT NULL AND p_expected_rate IS DISTINCT FROM rate THEN RAISE EXCEPTION 'Exchange rate changed. Reload the invoice preview.' USING ERRCODE='40001'; END IF;
 local_net:=round(i.subtotal*rate,2); local_tax:=round(i.tax_amount*rate,2);
 IF local_net<=0 OR (i.tax_amount>0 AND local_tax<=0) THEN RAISE EXCEPTION 'Converted invoice line is below one base-currency cent'; END IF;
 SELECT extract(year FROM y.start_date)::integer INTO fiscal FROM tw_accounting_years y JOIN tw_accounting_periods p ON p.year_id=y.id
 WHERE y.company_id=p_company AND p_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed;
 IF fiscal IS NULL OR p_date<i.issue_date THEN RAISE EXCEPTION 'Choose an open posting date on or after the invoice date'; END IF;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_receivable;
 IF NOT FOUND OR NOT a.active OR a.kind<>'Control' OR a.subledger<>'Customer' OR a.account_type<>'Asset' OR a.normal_balance<>'Debit'
 THEN RAISE EXCEPTION 'Select an active customer receivable control account'; END IF;
 IF s.journal_id IS NOT NULL THEN
  SELECT * INTO existing FROM tw_accounting_journals WHERE id=s.journal_id FOR UPDATE;
  IF existing.status<>'pending' OR existing.company_id<>p_company OR existing.source_invoice_id<>i.id THEN RAISE EXCEPTION 'Original journal is not pending'; END IF;
  IF NOT EXISTS(SELECT 1 FROM tw_accounting_periods p JOIN tw_accounting_years y ON y.id=p.year_id WHERE y.company_id=p_company AND existing.entry_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed)
  THEN RAISE EXCEPTION 'The original posting period is closed'; END IF;
  IF split_part(existing.voucher_number,'-',2)::integer<>fiscal THEN RAISE EXCEPTION 'Repost within the original fiscal year to retain the voucher number'; END IF;
  jid:=existing.id;
  INSERT INTO tw_accounting_audit(actor_id,table_name,operation,before_data,after_data)
   SELECT auth.uid(),'tw_accounting_journal_lines','REPLACE_PENDING',jsonb_build_object('journal_id',jid,'lines',jsonb_agg(to_jsonb(l))),jsonb_build_object('journal_id',jid) FROM tw_accounting_journal_lines l WHERE journal_id=jid;
  DELETE FROM tw_accounting_journal_lines WHERE journal_id=jid;
  UPDATE tw_accounting_journals SET entry_date=p_date,transaction_currency=trim(i.currency),exchange_rate=rate,exchange_rate_date=i.issue_date WHERE id=jid;
 ELSE
  INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,source_invoice_id,transaction_currency,exchange_rate,exchange_rate_date)
  VALUES(jid,p_company,p_date,left(i.document_number,120),'Invoice '||i.document_number||' · '||left(s.client_name,500),auth.uid(),i.id,trim(i.currency),rate,i.issue_date);
 END IF;
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,client_id,client_code,foreign_debit,foreign_credit)
 VALUES(jid,1,p_company,a.code,a.name,left(s.client_code||' · '||s.client_name,500),local_net+local_tax,0,s.client_id,s.client_code,i.total,0);
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_revenue;
 IF NOT FOUND OR NOT a.active OR a.kind<>'Posting' OR a.account_type<>'Revenue' OR a.normal_balance<>'Credit'
 THEN RAISE EXCEPTION 'Select an active revenue posting account'; END IF;
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit)
 VALUES(jid,2,p_company,a.code,a.name,'Invoice revenue',0,local_net,0,i.subtotal);
 IF i.tax_amount>0 THEN
  SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_vat;
  IF NOT FOUND OR NOT a.active OR a.kind<>'Posting' OR a.account_type<>'Liability' OR a.normal_balance<>'Credit'
  THEN RAISE EXCEPTION 'Select an active output VAT liability posting account'; END IF;
  INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit)
  VALUES(jid,3,p_company,a.code,a.name,'Invoice output VAT',0,local_tax,0,i.tax_amount);
 END IF;
 IF (SELECT sum(debit-credit) FROM tw_accounting_journal_lines WHERE journal_id=jid)<>0 THEN RAISE EXCEPTION 'Invoice journal does not balance'; END IF;
 IF s.journal_id IS NULL THEN
 INSERT INTO tw_accounting_journal_sequences(company_id,fiscal_year,last_number) VALUES(p_company,fiscal,1)
 ON CONFLICT(company_id,fiscal_year) DO UPDATE SET last_number=tw_accounting_journal_sequences.last_number+1 RETURNING last_number INTO seq;
 UPDATE tw_accounting_journals SET status='posted',voucher_number='JV-'||fiscal||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0'),posted_by=auth.uid(),posted_at=now(),version=version+1 WHERE id=jid;
 ELSE
 UPDATE tw_accounting_journals SET status='posted',posted_by=auth.uid(),posted_at=now(),updated_at=now(),version=version+1 WHERE id=jid;
 END IF;
 UPDATE tw_accounting_invoice_submissions SET status='posted',journal_id=jid,version=version+1 WHERE invoice_id=p_invoice;
 RETURN jid;
END $$;
REVOKE ALL ON FUNCTION public.tw_accounting_post_invoice(uuid,uuid,integer,date,text,text,text,numeric) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_accounting_post_invoice(uuid,uuid,integer,date,text,text,text,numeric) TO authenticated;
CREATE OR REPLACE FUNCTION public.tw_accounting_guard_source_invoice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s tw_accounting_invoice_submissions%ROWTYPE; reversed boolean;
BEGIN
 SELECT * INTO s FROM tw_accounting_invoice_submissions WHERE invoice_id=OLD.id;
 IF NOT FOUND OR s.status='withdrawn' THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'An accounting source invoice must be retained'; END IF;
 IF s.status='pending' AND NEW.status::text<>'void' AND tw_accounting_invoice_correction_allowed(OLD.id) THEN RETURN NEW; END IF;
 IF tw_accounting_invoice_snapshot(NEW) IS DISTINCT FROM tw_accounting_invoice_snapshot(OLD)
 THEN RAISE EXCEPTION 'Invoice is submitted to Accounting. Withdraw before posting; posted financial values cannot be edited.'; END IF;
 SELECT EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=s.journal_id AND status='posted') INTO reversed;
 IF NOT reversed AND ((NEW.status::text='void' AND OLD.status::text<>'void') OR NEW.regeneration_status IS DISTINCT FROM OLD.regeneration_status)
 THEN RAISE EXCEPTION 'Withdraw the accounting submission or reverse its journal before cancelling the invoice'; END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.guard_issued_invoice_amounts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE k text; reassignment boolean:=false;
BEGIN
 IF OLD.amounts_finalized_at IS NOT NULL OR OLD.status::text <> 'draft' THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Issued invoices cannot be deleted; retain the invoice and use a credit/debit note.'; END IF;
  IF NEW.amounts_finalized_at IS DISTINCT FROM OLD.amounts_finalized_at THEN RAISE EXCEPTION 'Issued invoice amount protection cannot be removed or changed.'; END IF;
  IF pg_trigger_depth()>1 THEN
   SELECT EXISTS(SELECT 1 FROM public.brand_client_reassignments a
    WHERE a.transaction_id=txid_current() AND a.actor_id=auth.uid() AND a.previous_client_id=OLD.client_id AND a.client_id=NEW.client_id
    AND EXISTS(SELECT 1 FROM public.campaign_headers h WHERE h.brand_id=a.brand_id AND (h.id=OLD.campaign_header_id
      OR h.id IN(SELECT campaign_header_id FROM public.invoice_line_items WHERE invoice_id=OLD.id)
      OR h.id IN(SELECT campaign_header_id FROM public.invoice_line_items_operational WHERE invoice_id=OLD.id)
      OR h.id IN(SELECT campaign_header_id FROM public.invoice_lines WHERE invoice_id=OLD.id)))) INTO reassignment;
  END IF;
  FOREACH k IN ARRAY ARRAY['subtotal','tax_amount','total','revenue_before_vat','revenue_vat_amount','revenue_after_vat','currency','client_id','campaign_header_id','document_number','issue_date','billing_country_code'] LOOP
   IF k IN ('subtotal','tax_amount','total','revenue_before_vat','revenue_vat_amount','revenue_after_vat') AND public.tw_accounting_invoice_correction_allowed(OLD.id) THEN CONTINUE; END IF;
   IF k='client_id' AND reassignment THEN CONTINUE; END IF;
   IF to_jsonb(NEW)->k IS DISTINCT FROM to_jsonb(OLD)->k THEN RAISE EXCEPTION 'Issued invoice financial values cannot be changed. Use a credit/debit note.'; END IF;
  END LOOP;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.status::text <> 'draft' AND NEW.amounts_finalized_at IS NULL THEN NEW.amounts_finalized_at:=now(); END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.guard_issued_invoice_lines()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE old_parent uuid; new_parent uuid; parent record;
BEGIN
  IF TG_OP <> 'INSERT' THEN old_parent := OLD.invoice_id; END IF;
  IF TG_OP <> 'DELETE' THEN new_parent := NEW.invoice_id; END IF;
  -- Lock both parents in deterministic order: moving a line cannot evade the
  -- protection, and finalization cannot race a line write.
  FOR parent IN SELECT id, amounts_finalized_at, status FROM public.invoices
    WHERE id = old_parent OR id = new_parent ORDER BY id FOR UPDATE LOOP
    IF (parent.amounts_finalized_at IS NOT NULL OR parent.status::text <> 'draft') AND NOT public.tw_accounting_invoice_correction_allowed(parent.id) THEN
      RAISE EXCEPTION 'Issued invoice lines cannot be added, changed or removed. Create a new invoice or credit/debit note.';
    END IF;
  END LOOP;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.tw_accounting_save_journal(p_id uuid,p_company uuid,p_date date,p_reference text,p_memo text,p_version integer,p_lines jsonb) RETURNS uuid
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
  IF j.company_id<>p_company OR j.status<>'draft' OR j.source_invoice_id IS NOT NULL OR j.reversal_of IS NOT NULL THEN RAISE EXCEPTION 'Only an ordinary draft in this company can be edited'; END IF;
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
CREATE OR REPLACE FUNCTION public.tw_accounting_cancel_journal(p_id uuid,p_company uuid,p_version integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_accounting_journals%ROWTYPE;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND OR j.status<>'draft' OR j.source_invoice_id IS NOT NULL OR p_version IS NULL OR j.version<>p_version THEN RAISE EXCEPTION 'Only the current draft can be cancelled' USING ERRCODE='40001'; END IF;
 UPDATE tw_accounting_journals SET status='cancelled',version=version+1,updated_at=now() WHERE id=p_id;
 RETURN p_id;
END $$;
CREATE OR REPLACE FUNCTION public.tw_accounting_post_journal(p_id uuid,p_company uuid,p_version integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_accounting_journals%ROWTYPE; fiscal integer; seq bigint; d numeric; c numeric; n integer;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Journal not found'; END IF;
 IF j.source_invoice_id IS NOT NULL AND j.reversal_of IS NULL THEN RAISE EXCEPTION 'Automatic journals must be posted through their source invoice'; END IF;
 IF j.status='posted' THEN RETURN p_id; END IF; -- Retry never consumes another voucher number.
 IF j.status<>'draft' OR p_version IS NULL OR j.version<>p_version THEN RAISE EXCEPTION 'Journal changed. Reload before posting.' USING ERRCODE='40001'; END IF;
 SELECT extract(year FROM y.start_date)::integer INTO fiscal FROM tw_accounting_years y JOIN tw_accounting_periods p ON p.year_id=y.id
  WHERE y.company_id=p_company AND j.entry_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed;
 IF fiscal IS NULL THEN RAISE EXCEPTION 'Journal date must be in an open financial period'; END IF;
 SELECT count(*),sum(debit),sum(credit) INTO n,d,c FROM tw_accounting_journal_lines WHERE journal_id=p_id;
 IF n<2 OR n>200 OR d IS NULL OR d<=0 OR d<>c THEN RAISE EXCEPTION 'Journal must balance: total debits must equal total credits'; END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_lines l JOIN tw_accounting_accounts a ON a.company_id=l.company_id AND a.code=l.account_code
  WHERE l.journal_id=p_id AND (l.company_id<>p_company OR (a.kind<>'Posting' AND NOT (a.kind='Control' AND a.subledger='Customer' AND j.reversal_of IS NOT NULL AND EXISTS(SELECT 1 FROM tw_accounting_invoice_submissions s JOIN tw_accounting_journal_lines original ON original.journal_id=s.journal_id AND original.line_number=l.line_number WHERE s.journal_id=j.reversal_of AND s.invoice_id=j.source_invoice_id AND s.company_id=p_company AND original.account_code=l.account_code AND original.client_id=l.client_id AND original.client_code=l.client_code AND original.debit=l.credit AND original.credit=l.debit))) OR (NOT a.active AND j.reversal_of IS NULL))) THEN RAISE EXCEPTION 'Journal contains an unavailable posting account'; END IF;
 UPDATE tw_accounting_journal_lines l SET account_name=a.name FROM tw_accounting_accounts a
  WHERE l.journal_id=p_id AND a.company_id=l.company_id AND a.code=l.account_code;
 INSERT INTO tw_accounting_journal_sequences(company_id,fiscal_year,last_number) VALUES(p_company,fiscal,1)
 ON CONFLICT(company_id,fiscal_year) DO UPDATE SET last_number=tw_accounting_journal_sequences.last_number+1 RETURNING last_number INTO seq;
 UPDATE tw_accounting_journals SET status='posted',voucher_number='JV-'||fiscal||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0'),posted_by=auth.uid(),posted_at=now(),updated_at=now(),version=version+1 WHERE id=p_id;
 RETURN p_id;
END $$;
CREATE OR REPLACE FUNCTION public.tw_accounting_reverse_journal(p_id uuid,p_company uuid,p_reversal uuid,p_date date,p_reason text) RETURNS uuid
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
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,reversal_of,reversal_reason,created_by,source_invoice_id,transaction_currency,exchange_rate,exchange_rate_date)
 VALUES(p_reversal,p_company,p_date,j.voucher_number,'Reversal of '||j.voucher_number||': '||trim(p_reason),p_id,trim(p_reason),auth.uid(),j.source_invoice_id,j.transaction_currency,j.exchange_rate,j.exchange_rate_date);
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,client_id,client_code,foreign_debit,foreign_credit)
 SELECT p_reversal,line_number,company_id,account_code,account_name,description,credit,debit,client_id,client_code,foreign_credit,foreign_debit FROM tw_accounting_journal_lines WHERE journal_id=p_id;
 PERFORM tw_accounting_post_journal(p_reversal,p_company,1);
 RETURN p_reversal;
END $$;
CREATE OR REPLACE FUNCTION public.tw_accounting_media_invoice(p_invoice uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT tw_accounting_media_invoice_access(p_invoice) THEN RAISE EXCEPTION 'Invoice access required' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('submission',(
 SELECT jsonb_build_object('company',s.company_id,'companyName',c.name,'status',CASE WHEN r.id IS NOT NULL THEN 'reversed' ELSE s.status END,
 'version',s.version,'journal',s.journal_id,'voucher',j.voucher_number,'reversal',r.voucher_number)
 FROM tw_accounting_invoice_submissions s JOIN tw_accounting_companies c ON c.id=s.company_id
 LEFT JOIN tw_accounting_journals j ON j.id=s.journal_id LEFT JOIN tw_accounting_journals r ON r.reversal_of=j.id WHERE s.invoice_id=p_invoice),
 'companies',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'currency',base_currency) ORDER BY name),'[]'::jsonb) FROM tw_accounting_companies),
 'canCorrect',tw_accounting_invoice_correction_allowed(p_invoice),'canSubmit',tw_accounting_media_invoice_access(p_invoice,true)) INTO result;
 RETURN result;
END $$;
CREATE OR REPLACE FUNCTION public.tw_accounting_protect_used_account() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM 1 FROM tw_accounting_companies WHERE id=OLD.company_id FOR UPDATE;
 IF (NEW.kind,NEW.account_type,NEW.normal_balance,NEW.parent_code) IS DISTINCT FROM (OLD.kind,OLD.account_type,OLD.normal_balance,OLD.parent_code)
 AND EXISTS(SELECT 1 FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id WHERE l.company_id=OLD.company_id AND l.account_code=OLD.code AND j.status IN ('posted','pending'))
 THEN RAISE EXCEPTION 'An account with posted activity cannot change its classification, balance side or parent'; END IF;
 RETURN NEW;
END $$;
-- Keep the existing finance registry aligned with authorized invoice corrections.
CREATE FUNCTION public.tw_accounting_sync_corrected_invoice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF tw_accounting_invoice_correction_allowed(NEW.id) AND
 (NEW.subtotal,NEW.tax_amount,NEW.total,NEW.status) IS DISTINCT FROM (OLD.subtotal,OLD.tax_amount,OLD.total,OLD.status) THEN
  UPDATE finance_documents SET amount_before_vat=NEW.subtotal,vat_amount=NEW.tax_amount,amount_after_vat=NEW.total,status=NEW.status::text,updated_at=now()
  WHERE source_table='invoices' AND source_id=NEW.id AND posted_at IS NULL AND posting_batch_id IS NULL;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tw_accounting_sync_corrected_invoice() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER tw_accounting_sync_correction AFTER UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_sync_corrected_invoice();
COMMIT;
