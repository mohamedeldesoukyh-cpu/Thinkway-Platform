BEGIN;

CREATE TABLE public.tw_accounting_invoice_submissions (
 invoice_id uuid PRIMARY KEY REFERENCES public.invoices(id),
 company_id uuid NOT NULL REFERENCES public.tw_accounting_companies(id),
 client_id uuid NOT NULL REFERENCES public.clients(id),
 client_code text NOT NULL,
 client_name text NOT NULL,
 source jsonb NOT NULL,
 status text NOT NULL CHECK(status IN ('submitted','withdrawn','posted')),
 version integer NOT NULL DEFAULT 1,
 journal_id uuid UNIQUE REFERENCES public.tw_accounting_journals(id),
 submitted_by uuid NOT NULL REFERENCES public.profiles(id),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='posted')=(journal_id IS NOT NULL))
);
CREATE INDEX tw_invoice_queue ON public.tw_accounting_invoice_submissions(company_id,submitted_at DESC,invoice_id);
ALTER TABLE public.tw_accounting_invoice_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tw_accounting_invoice_submissions FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.tw_accounting_invoice_submissions TO authenticated;
CREATE POLICY accounting_read ON public.tw_accounting_invoice_submissions FOR SELECT TO authenticated
 USING ((SELECT (public.tw_module_access()->>'accounting')::boolean));
CREATE TRIGGER tw_invoice_submission_audit AFTER INSERT OR UPDATE ON public.tw_accounting_invoice_submissions
 FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_audit_change();

ALTER TABLE public.tw_accounting_journals ADD COLUMN source_invoice_id uuid REFERENCES public.invoices(id);
ALTER TABLE public.tw_accounting_journal_lines
 ADD COLUMN client_id uuid REFERENCES public.clients(id),
 ADD COLUMN client_code text;

-- Private, deterministic financial snapshot. Payment state deliberately excluded.
CREATE FUNCTION public.tw_accounting_invoice_snapshot(i public.invoices) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT jsonb_build_object('id',i.id,'number',i.document_number,'client',i.client_id,
 'date',i.issue_date,'currency',trim(i.currency),'net',i.subtotal::text,
 'vat',i.tax_amount::text,'total',i.total::text,'version',i.version_number,
 'revenue_net',i.revenue_before_vat::text,'revenue_vat',i.revenue_vat_amount::text,
 'revenue_total',i.revenue_after_vat::text,'country',i.billing_country_code,
 'vat_exempt',i.revenue_vat_exempt,'due_date',i.due_date,'campaign',i.campaign_header_id);
$$;
REVOKE ALL ON FUNCTION public.tw_accounting_invoice_snapshot(public.invoices) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.tw_accounting_media_invoice_access(p_invoice uuid,p_write boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((tw_module_access()->>'media')::boolean,false)
 AND (CASE WHEN p_write THEN has_permission('invoices.write') ELSE has_permission('invoices.read') OR has_permission('invoices.write') END)
 AND EXISTS(SELECT 1 FROM invoices i WHERE i.id=p_invoice AND can_access_client(i.client_id)
 AND (NOT p_write OR ((i.campaign_id IS NULL OR can_access_campaign(i.campaign_id))
 AND (i.campaign_header_id IS NULL OR can_access_campaign_header(i.campaign_header_id)))));
$$;
REVOKE ALL ON FUNCTION public.tw_accounting_media_invoice_access(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.tw_accounting_media_invoice_access(uuid,boolean) TO authenticated;

-- A narrow bridge exposes company choices and this invoice's posting state only.
CREATE FUNCTION public.tw_accounting_media_invoice(p_invoice uuid) RETURNS jsonb
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
 'canSubmit',tw_accounting_media_invoice_access(p_invoice,true)) INTO result;
 RETURN result;
END $$;

CREATE FUNCTION public.tw_accounting_submit_invoice(p_invoice uuid,p_company uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i invoices%ROWTYPE; s tw_accounting_invoice_submissions%ROWTYPE; customer clients%ROWTYPE; base text;
BEGIN
 IF NOT tw_accounting_media_invoice_access(p_invoice,true) OR coalesce(auth.jwt()->>'aal','')<>'aal2' THEN RAISE EXCEPTION 'Invoice write access and verified MFA required' USING ERRCODE='42501'; END IF;
 -- Source row first: invoice edits and all bridge mutations share this lock order.
 SELECT * INTO i FROM invoices WHERE id=p_invoice FOR UPDATE;
 SELECT * INTO s FROM tw_accounting_invoice_submissions WHERE invoice_id=p_invoice FOR UPDATE;
 IF FOUND AND s.status<>'withdrawn' THEN
  IF s.company_id<>p_company THEN RAISE EXCEPTION 'Invoice is already assigned to another accounting company'; END IF;
  RETURN p_invoice;
 END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE id=p_company;
 IF NOT FOUND THEN RAISE EXCEPTION 'Accounting company not found'; END IF;
 IF i.status::text='void' OR i.regeneration_status::text IS DISTINCT FROM 'active' OR i.issue_date IS NULL
 OR (i.amounts_finalized_at IS NULL AND i.status::text='draft') THEN RAISE EXCEPTION 'Only finalized, active issued invoices can be submitted'; END IF;
 IF trim(i.currency)<>base THEN RAISE EXCEPTION 'Invoice currency must match the company base currency. Foreign-currency invoice posting is not enabled yet.'; END IF;
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

CREATE FUNCTION public.tw_accounting_withdraw_invoice(p_invoice uuid,p_version integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT (tw_accounting_can_manage() OR (tw_accounting_media_invoice_access(p_invoice,true) AND coalesce(auth.jwt()->>'aal','')='aal2'))
 THEN RAISE EXCEPTION 'Management access and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM invoices WHERE id=p_invoice FOR UPDATE;
 UPDATE tw_accounting_invoice_submissions SET status='withdrawn',version=version+1 WHERE invoice_id=p_invoice AND status='submitted' AND version=p_version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Submission changed or is already posted. Reload.' USING ERRCODE='40001'; END IF;
END $$;

CREATE FUNCTION public.tw_accounting_post_invoice(p_invoice uuid,p_company uuid,p_version integer,p_date date,p_receivable text,p_revenue text,p_vat text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s tw_accounting_invoice_submissions%ROWTYPE; i invoices%ROWTYPE; a tw_accounting_accounts%ROWTYPE;
 jid uuid:=gen_random_uuid(); fiscal integer; seq bigint; base text;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM invoices WHERE id=p_invoice FOR UPDATE;
 SELECT * INTO s FROM tw_accounting_invoice_submissions WHERE invoice_id=p_invoice FOR UPDATE;
 IF NOT FOUND OR s.company_id<>p_company THEN RAISE EXCEPTION 'Submission not found in this company'; END IF;
 IF s.status='posted' THEN RETURN s.journal_id; END IF;
 IF s.status<>'submitted' OR p_version IS NULL OR p_version<>s.version THEN RAISE EXCEPTION 'Submission changed. Reload before posting.' USING ERRCODE='40001'; END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 IF tw_accounting_invoice_snapshot(i) IS DISTINCT FROM s.source OR i.status::text='void' OR i.regeneration_status::text IS DISTINCT FROM 'active' OR trim(i.currency)<>base
 THEN RAISE EXCEPTION 'Source invoice changed or is unavailable. Withdraw and review it in Media.'; END IF;
 SELECT extract(year FROM y.start_date)::integer INTO fiscal FROM tw_accounting_years y JOIN tw_accounting_periods p ON p.year_id=y.id
 WHERE y.company_id=p_company AND p_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed;
 IF fiscal IS NULL OR p_date<i.issue_date THEN RAISE EXCEPTION 'Choose an open posting date on or after the invoice date'; END IF;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_receivable;
 IF NOT FOUND OR NOT a.active OR a.kind<>'Control' OR a.subledger<>'Customer' OR a.account_type<>'Asset' OR a.normal_balance<>'Debit'
 THEN RAISE EXCEPTION 'Select an active customer receivable control account'; END IF;
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,source_invoice_id)
 VALUES(jid,p_company,p_date,left(i.document_number,120),'Invoice '||i.document_number||' · '||left(s.client_name,500),auth.uid(),i.id);
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,client_id,client_code)
 VALUES(jid,1,p_company,a.code,a.name,left(s.client_code||' · '||s.client_name,500),i.total,0,s.client_id,s.client_code);
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_revenue;
 IF NOT FOUND OR NOT a.active OR a.kind<>'Posting' OR a.account_type<>'Revenue' OR a.normal_balance<>'Credit'
 THEN RAISE EXCEPTION 'Select an active revenue posting account'; END IF;
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit)
 VALUES(jid,2,p_company,a.code,a.name,'Invoice revenue',0,i.subtotal);
 IF i.tax_amount>0 THEN
  SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_vat;
  IF NOT FOUND OR NOT a.active OR a.kind<>'Posting' OR a.account_type<>'Liability' OR a.normal_balance<>'Credit'
  THEN RAISE EXCEPTION 'Select an active output VAT liability posting account'; END IF;
  INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit)
  VALUES(jid,3,p_company,a.code,a.name,'Invoice output VAT',0,i.tax_amount);
 END IF;
 IF (SELECT sum(debit-credit) FROM tw_accounting_journal_lines WHERE journal_id=jid)<>0 THEN RAISE EXCEPTION 'Invoice journal does not balance'; END IF;
 INSERT INTO tw_accounting_journal_sequences(company_id,fiscal_year,last_number) VALUES(p_company,fiscal,1)
 ON CONFLICT(company_id,fiscal_year) DO UPDATE SET last_number=tw_accounting_journal_sequences.last_number+1 RETURNING last_number INTO seq;
 UPDATE tw_accounting_journals SET status='posted',voucher_number='JV-'||fiscal||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0'),posted_by=auth.uid(),posted_at=now(),version=2 WHERE id=jid;
 UPDATE tw_accounting_invoice_submissions SET status='posted',journal_id=jid,version=version+1 WHERE invoice_id=p_invoice;
 RETURN jid;
END $$;

-- Keep payment updates independent. Void/regeneration requires withdrawal or a
-- posted reversal; financial identity remains immutable once submitted/posted.
CREATE FUNCTION public.tw_accounting_guard_source_invoice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s tw_accounting_invoice_submissions%ROWTYPE; reversed boolean;
BEGIN
 SELECT * INTO s FROM tw_accounting_invoice_submissions WHERE invoice_id=OLD.id;
 IF NOT FOUND OR s.status='withdrawn' THEN IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'An accounting source invoice must be retained'; END IF;
 IF tw_accounting_invoice_snapshot(NEW) IS DISTINCT FROM tw_accounting_invoice_snapshot(OLD)
 THEN RAISE EXCEPTION 'Invoice is submitted to Accounting. Withdraw before posting; posted financial values cannot be edited.'; END IF;
 SELECT EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=s.journal_id AND status='posted') INTO reversed;
 IF NOT reversed AND ((NEW.status::text='void' AND OLD.status::text<>'void') OR NEW.regeneration_status IS DISTINCT FROM OLD.regeneration_status)
 THEN RAISE EXCEPTION 'Withdraw the accounting submission or reverse its journal before cancelling the invoice'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tw_accounting_source_lock BEFORE UPDATE OR DELETE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_guard_source_invoice();

REVOKE ALL ON FUNCTION public.tw_accounting_media_invoice(uuid),public.tw_accounting_submit_invoice(uuid,uuid),public.tw_accounting_withdraw_invoice(uuid,integer),public.tw_accounting_post_invoice(uuid,uuid,integer,date,text,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_accounting_media_invoice(uuid),public.tw_accounting_submit_invoice(uuid,uuid),public.tw_accounting_withdraw_invoice(uuid,integer),public.tw_accounting_post_invoice(uuid,uuid,integer,date,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.tw_accounting_post_journal(p_id uuid,p_company uuid,p_version integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_accounting_journals%ROWTYPE; fiscal integer; seq bigint; d numeric; c numeric; n integer;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Journal not found'; END IF;
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
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,reversal_of,reversal_reason,created_by,source_invoice_id)
 VALUES(p_reversal,p_company,p_date,j.voucher_number,'Reversal of '||j.voucher_number||': '||trim(p_reason),p_id,trim(p_reason),auth.uid(),j.source_invoice_id);
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,client_id,client_code)
 SELECT p_reversal,line_number,company_id,account_code,account_name,description,credit,debit,client_id,client_code FROM tw_accounting_journal_lines WHERE journal_id=p_id;
 PERFORM tw_accounting_post_journal(p_reversal,p_company,1);
 RETURN p_reversal;
END $$;


COMMIT;
