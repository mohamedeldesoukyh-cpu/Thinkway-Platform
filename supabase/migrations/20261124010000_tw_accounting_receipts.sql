BEGIN;
ALTER TABLE public.tw_accounting_journals ADD COLUMN source_payment_id uuid REFERENCES public.payments(id);
CREATE UNIQUE INDEX tw_receipt_original_journal ON public.tw_accounting_journals(source_payment_id) WHERE reversal_of IS NULL AND source_payment_id IS NOT NULL;
CREATE TABLE public.tw_accounting_receipts (
 payment_id uuid PRIMARY KEY REFERENCES public.payments(id),
 company_id uuid NOT NULL REFERENCES public.tw_accounting_companies(id),
 invoice_id uuid NOT NULL REFERENCES public.invoices(id),
 journal_id uuid NOT NULL UNIQUE REFERENCES public.tw_accounting_journals(id),
 status text NOT NULL CHECK(status IN ('posted','reversed')),
 amount numeric(18,2) NOT NULL CHECK(amount>0),
 receivable_base numeric(18,2) NOT NULL CHECK(receivable_base>0),
 cash_base numeric(18,2) NOT NULL CHECK(cash_base>0),
 payment_revision integer NOT NULL,
 reversal_id uuid UNIQUE REFERENCES public.tw_accounting_journals(id),
 reversal_reason text,
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK((status='reversed')=(reversal_id IS NOT NULL))
);
ALTER TABLE public.tw_accounting_receipts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tw_accounting_receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.tw_accounting_receipts TO authenticated;
CREATE POLICY accounting_read ON public.tw_accounting_receipts FOR SELECT TO authenticated USING ((SELECT (public.tw_module_access()->>'accounting')::boolean));
CREATE TRIGGER tw_receipt_audit AFTER INSERT OR UPDATE ON public.tw_accounting_receipts FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_audit_change();

-- A source payment becomes immutable once it has an Accounting journal.
-- The only transition permitted is the dedicated, already-audited reversal.
CREATE FUNCTION public.tw_accounting_guard_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r tw_accounting_receipts%ROWTYPE; i invoices%ROWTYPE; invoice_key uuid; other_paid numeric;
BEGIN
 IF TG_OP<>'INSERT' THEN
  IF TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM tw_accounting_invoice_submissions WHERE invoice_id=OLD.invoice_id)
   AND (NEW.invoice_id IS DISTINCT FROM OLD.invoice_id OR NEW.client_id IS DISTINCT FROM OLD.client_id OR NEW.currency IS DISTINCT FROM OLD.currency)
  THEN RAISE EXCEPTION 'An Accounting-linked receipt cannot be moved to another invoice, client or currency'; END IF;
  SELECT * INTO r FROM tw_accounting_receipts WHERE payment_id=OLD.id;
  IF FOUND THEN
   IF TG_OP='UPDATE' AND r.status='reversed' AND OLD.status='completed' AND NEW.status='cancelled'
    AND (to_jsonb(NEW)-ARRAY['status','revision','updated_at'])=(to_jsonb(OLD)-ARRAY['status','revision','updated_at'])
    AND NEW.revision=OLD.revision+1 THEN RETURN NEW; END IF;
   RAISE EXCEPTION 'This receipt has an Accounting journal. Reverse it from TW Accounting; posted receipts cannot be edited, deleted or restored.';
  END IF;
 END IF;
 invoice_key:=CASE WHEN TG_OP='DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;
 -- Scope strengthened balance checks to invoices participating in Accounting.
 IF invoice_key IS NOT NULL AND EXISTS(SELECT 1 FROM tw_accounting_invoice_submissions WHERE invoice_id=invoice_key) THEN
  SELECT * INTO i FROM invoices WHERE id=invoice_key FOR UPDATE;
  IF TG_OP<>'DELETE' AND NEW.status='completed' THEN
   IF i.status='void' OR i.regeneration_status::text<>'active' OR NEW.currency<>i.currency OR NEW.client_id<>i.client_id
    OR NEW.amount<=0 OR NEW.amount<>round(NEW.amount,2) THEN RAISE EXCEPTION 'Use an active invoice, matching client/currency and a positive receipt amount'; END IF;
   IF EXISTS(SELECT 1 FROM tw_accounting_invoice_submissions WHERE invoice_id=i.id AND status='pending')
   THEN RAISE EXCEPTION 'Finish and repost the invoice correction before recording a receipt'; END IF;
   SELECT coalesce(sum(amount),0) INTO other_paid FROM payments WHERE invoice_id=i.id AND status='completed' AND id<>NEW.id;
   IF other_paid+NEW.amount>i.total THEN RAISE EXCEPTION 'Receipt exceeds the current invoice balance. Reload before saving.' USING ERRCODE='40001'; END IF;
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tw_accounting_guard_payment() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER a_tw_accounting_payment_guard BEFORE INSERT OR UPDATE OR DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_guard_payment();

-- Run after the existing invoice balance trigger. Derive collection coverage
-- from all active invoice slices, so a partial receipt does not overwrite other invoices.
CREATE FUNCTION public.tw_accounting_sync_receipt_coverage() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE invoice_key uuid;
BEGIN
 invoice_key:=CASE WHEN TG_OP='DELETE' THEN OLD.invoice_id ELSE NEW.invoice_id END;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_invoice_submissions WHERE invoice_id=invoice_key) THEN RETURN coalesce(NEW,OLD); END IF;
 WITH affected AS (SELECT DISTINCT assignment_deliverable_id id FROM invoice_line_items WHERE invoice_id=invoice_key AND assignment_deliverable_id IS NOT NULL),
 amounts AS (SELECT d.id,coalesce(sum(round(coalesce(l.revenue_before_vat,l.unit_price)*least(1,coalesce(i.amount_paid/nullif(i.total,0),0)),2)) FILTER(WHERE i.status<>'void' AND i.regeneration_status::text='active'),0) collected
 FROM affected d LEFT JOIN invoice_line_items_operational l ON l.assignment_deliverable_id=d.id LEFT JOIN invoices i ON i.id=l.invoice_id GROUP BY d.id)
 UPDATE assignment_deliverables d SET collected_amount=a.collected,billing_status=(CASE WHEN a.collected>=d.invoiced_amount AND d.invoiced_amount>0 THEN 'collected' WHEN a.collected>0 THEN 'partially_collected' ELSE 'invoiced' END)::assignment_deliverable_billing_status FROM amounts a WHERE d.id=a.id;
 UPDATE campaign_lines SET billing_status=(CASE WHEN i.amount_paid>=i.total AND i.total>0 THEN 'paid' WHEN i.amount_paid>0 THEN 'partially_paid' ELSE 'invoiced' END)::campaign_line_billing_status FROM invoices i WHERE i.id=invoice_key AND campaign_lines.invoice_id=i.id AND campaign_lines.billing_status IN ('invoiced','partially_paid','paid');
 RETURN coalesce(NEW,OLD);
END $$;
REVOKE ALL ON FUNCTION public.tw_accounting_sync_receipt_coverage() FROM PUBLIC,anon,authenticated,service_role;
CREATE CONSTRAINT TRIGGER zz_tw_accounting_receipt_coverage AFTER INSERT OR UPDATE OR DELETE ON public.payments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_sync_receipt_coverage();

CREATE FUNCTION public.tw_accounting_manages_invoice_collections(p_invoice uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce((tw_module_access()->>'media')::boolean,false) AND EXISTS(SELECT 1 FROM tw_accounting_invoice_submissions WHERE invoice_id=p_invoice)
$$;
REVOKE ALL ON FUNCTION public.tw_accounting_manages_invoice_collections(uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_accounting_manages_invoice_collections(uuid) TO authenticated;

CREATE FUNCTION public.tw_accounting_guard_receipt_allocation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM tw_accounting_receipts WHERE payment_id=OLD.payment_id AND (status='posted' OR TG_OP<>'DELETE'))
 OR TG_OP<>'DELETE' AND EXISTS(SELECT 1 FROM tw_accounting_receipts WHERE payment_id=NEW.payment_id)
 THEN RAISE EXCEPTION 'Accounting receipt allocations are read-only. Reverse the receipt from TW Accounting.'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.tw_accounting_guard_receipt_allocation() FROM PUBLIC,anon,authenticated,service_role;
CREATE TRIGGER tw_accounting_allocation_guard BEFORE INSERT OR UPDATE OR DELETE ON public.payment_allocations FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_guard_receipt_allocation();

CREATE FUNCTION public.tw_accounting_receipt_quote(p_invoice uuid,p_company uuid,p_amount numeric,p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE i invoices%ROWTYPE; s tw_accounting_invoice_submissions%ROWTYPE; original tw_accounting_journal_lines%ROWTYPE;
 base text; rate numeric; settled numeric; settled_base numeric; carrying numeric; cash numeric;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO s FROM tw_accounting_invoice_submissions WHERE invoice_id=p_invoice AND company_id=p_company AND status='posted';
 IF NOT FOUND OR EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=s.journal_id) THEN RAISE EXCEPTION 'Select an original posted invoice'; END IF;
 SELECT * INTO i FROM invoices WHERE id=p_invoice;
 IF i.status='void' OR i.regeneration_status::text<>'active' OR p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2)
 OR p_date IS NULL OR p_date>CURRENT_DATE OR p_date<i.issue_date THEN RAISE EXCEPTION 'Enter a positive receipt and valid receipt date on or after the invoice date'; END IF;
 SELECT * INTO original FROM tw_accounting_journal_lines WHERE journal_id=s.journal_id AND client_id=s.client_id AND debit>0 ORDER BY line_number LIMIT 1;
 SELECT coalesce(sum(amount),0),coalesce(sum(receivable_base),0) INTO settled,settled_base FROM tw_accounting_receipts WHERE invoice_id=i.id AND status='posted';
 IF settled+p_amount>i.total OR original.journal_id IS NULL THEN RAISE EXCEPTION 'Receipt exceeds the remaining Accounting receivable'; END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE id=p_company;
 rate:=resolve_effective_exchange_rate(trim(i.currency),base,p_date);
 cash:=round(p_amount*rate,2);
 -- Cumulative allocation assigns the final local cent to the last receipt.
 carrying:=round((settled+p_amount)*original.debit/i.total,2)-settled_base;
 IF cash<=0 OR carrying<=0 THEN RAISE EXCEPTION 'Receipt converts to less than one local cent'; END IF;
 RETURN jsonb_build_object('currency',trim(i.currency),'base',base,'rate',rate::text,'date',p_date,'amount',round(p_amount,2)::text,
 'cash',cash::text,'receivable',carrying::text,'gain',(cash-carrying)::text,'account',original.account_code,
 'invoiceVersion',s.version,'settled',settled::text,'settledBase',settled_base::text,'minPostingDate',(SELECT entry_date FROM tw_accounting_journals WHERE id=s.journal_id));
END $$;

-- Private numbering helper: caller validates source/accounts before constructing lines.
CREATE FUNCTION public.tw_accounting_finish_receipt_journal(p_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_accounting_journals%ROWTYPE; fiscal integer; seq bigint;
BEGIN
 SELECT * INTO j FROM tw_accounting_journals WHERE id=p_id;
 SELECT extract(year FROM y.start_date)::integer INTO fiscal FROM tw_accounting_years y JOIN tw_accounting_periods p ON p.year_id=y.id WHERE y.company_id=j.company_id AND j.entry_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed;
 IF fiscal IS NULL THEN RAISE EXCEPTION 'Choose an open receipt posting period'; END IF;
 IF (SELECT coalesce(sum(debit),0)<=0 OR sum(debit-credit)<>0 FROM tw_accounting_journal_lines WHERE journal_id=p_id) THEN RAISE EXCEPTION 'Receipt journal does not balance'; END IF;
 INSERT INTO tw_accounting_journal_sequences(company_id,fiscal_year,last_number) VALUES(j.company_id,fiscal,1)
 ON CONFLICT(company_id,fiscal_year) DO UPDATE SET last_number=tw_accounting_journal_sequences.last_number+1 RETURNING last_number INTO seq;
 UPDATE tw_accounting_journals SET status='posted',voucher_number='JV-'||fiscal||'-'||lpad(seq::text,greatest(6,length(seq::text)),'0'),posted_by=auth.uid(),posted_at=now(),version=version+1 WHERE id=p_id;
END $$;
REVOKE ALL ON FUNCTION public.tw_accounting_finish_receipt_journal(uuid) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.tw_accounting_post_receipt(p_payment uuid,p_company uuid,p_revision integer,p_post_date date,p_cash text,p_gain text,p_loss text,p_expected jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p payments%ROWTYPE; i invoices%ROWTYPE; s tw_accounting_invoice_submissions%ROWTYPE; r tw_accounting_receipts%ROWTYPE;
 q jsonb; j uuid:=gen_random_uuid(); a tw_accounting_accounts%ROWTYPE; difference numeric; receipt_date date;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 SELECT * INTO i FROM invoices WHERE id=(SELECT invoice_id FROM payments WHERE id=p_payment) FOR UPDATE;
 SELECT * INTO p FROM payments WHERE id=p_payment FOR UPDATE;
 IF i.id IS NULL OR p.id IS NULL OR p.invoice_id<>i.id THEN RAISE EXCEPTION 'Invoice receipt unavailable'; END IF;
 SELECT * INTO s FROM tw_accounting_invoice_submissions WHERE invoice_id=i.id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice is not in this accounting company'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO r FROM tw_accounting_receipts WHERE payment_id=p_payment;
 IF FOUND THEN
  IF r.company_id<>p_company OR r.status<>'posted' THEN RAISE EXCEPTION 'Receipt is already reversed or assigned elsewhere'; END IF;
  RETURN r.journal_id;
 END IF;
 IF p_revision IS NULL OR p.revision<>p_revision THEN RAISE EXCEPTION 'Receipt changed. Reload before posting.' USING ERRCODE='40001'; END IF;
 IF p.status<>'completed' OR p.currency<>i.currency OR p.client_id<>i.client_id OR p.paid_at IS NULL
 OR p.advance_source_id IS NOT NULL OR p.advance_campaign_id IS NOT NULL OR p.metadata ? 'original_advance_amount'
 THEN RAISE EXCEPTION 'Select a completed actual invoice receipt; advance accounting is separate'; END IF;
 IF EXISTS(SELECT 1 FROM payment_allocations WHERE payment_id=p.id AND (invoice_id<>i.id OR allocated_amount<>p.amount OR currency_code<>p.currency)) THEN RAISE EXCEPTION 'Reconcile payment allocations before posting'; END IF;
 receipt_date:=(p.paid_at AT TIME ZONE 'UTC')::date;
 q:=tw_accounting_receipt_quote(i.id,p_company,p.amount,receipt_date);
 IF p_expected IS NULL OR q IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Receipt, rate or receivable changed. Refresh the preview.' USING ERRCODE='40001'; END IF;
 IF p_post_date IS NULL OR p_post_date>CURRENT_DATE OR p_post_date<receipt_date OR p_post_date<(q->>'minPostingDate')::date THEN RAISE EXCEPTION 'Posting date must be on or after the receipt and invoice posting dates, and no later than today'; END IF;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_cash;
 IF NOT FOUND OR NOT a.active OR a.kind<>'Posting' OR a.account_type<>'Asset' OR a.normal_balance<>'Debit' OR a.code NOT LIKE '11%' THEN RAISE EXCEPTION 'Select an active cash/bank posting account in class 11'; END IF;
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,source_payment_id,transaction_currency,exchange_rate,exchange_rate_date)
 VALUES(j,p_company,p_post_date,left(p.document_number,120),'Receipt '||p.document_number||' · Invoice '||i.document_number,auth.uid(),p.id,trim(p.currency),(q->>'rate')::numeric,receipt_date);
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit)
 VALUES(j,1,p_company,a.code,a.name,'Client receipt',(q->>'cash')::numeric,0,p.amount,0);
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=q->>'account';
 IF NOT FOUND OR NOT a.active OR a.kind<>'Control' OR a.subledger<>'Customer' THEN RAISE EXCEPTION 'The invoice receivable account is unavailable'; END IF;
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,client_id,client_code)
 VALUES(j,2,p_company,a.code,a.name,left(s.client_code||' · '||s.client_name,500),0,(q->>'receivable')::numeric,0,p.amount,s.client_id,s.client_code);
 difference:=(q->>'gain')::numeric;
 IF difference<>0 THEN
  SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=CASE WHEN difference>0 THEN p_gain ELSE p_loss END;
  IF NOT FOUND OR NOT a.active OR a.kind<>'Posting' OR a.account_type<>(CASE WHEN difference>0 THEN 'Revenue' ELSE 'Expense' END) OR a.normal_balance<>(CASE WHEN difference>0 THEN 'Credit' ELSE 'Debit' END) THEN RAISE EXCEPTION 'Select an active realized exchange gain/loss account'; END IF;
  INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit)
  VALUES(j,3,p_company,a.code,a.name,'Realized exchange difference',greatest(-difference,0),greatest(difference,0));
 END IF;
 PERFORM tw_accounting_finish_receipt_journal(j);
 INSERT INTO tw_accounting_receipts(payment_id,company_id,invoice_id,journal_id,status,amount,receivable_base,cash_base,payment_revision,created_by)
 VALUES(p.id,p_company,i.id,j,'posted',p.amount,(q->>'receivable')::numeric,(q->>'cash')::numeric,p.revision,auth.uid());
 RETURN j;
END $$;

CREATE FUNCTION public.tw_accounting_record_receipt(p_request uuid,p_invoice uuid,p_company uuid,p_amount numeric,p_date date,p_method text,p_reference text,p_notes text,p_post_date date,p_cash text,p_gain text,p_loss text,p_expected jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE i invoices%ROWTYPE; p payments%ROWTYPE; result uuid; receipt_number bigint;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 IF p_request IS NULL THEN RAISE EXCEPTION 'Receipt request ID required'; END IF;
 SELECT * INTO i FROM invoices WHERE id=p_invoice FOR UPDATE;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_invoice_submissions WHERE invoice_id=p_invoice AND company_id=p_company AND status='posted') THEN RAISE EXCEPTION 'Select a posted invoice in this company'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_request::text,0));
 SELECT * INTO p FROM payments WHERE receipt_request_id=p_request;
 IF FOUND THEN
  IF p.invoice_id<>p_invoice OR p.amount<>p_amount OR (p.paid_at AT TIME ZONE 'UTC')::date<>p_date OR p.payment_method::text<>p_method OR coalesce(p.reference_number,'')<>trim(coalesce(p_reference,'')) OR coalesce(p.notes,'')<>trim(coalesce(p_notes,'')) THEN RAISE EXCEPTION 'This request already recorded a different receipt'; END IF;
  SELECT journal_id INTO result FROM tw_accounting_receipts WHERE payment_id=p.id AND company_id=p_company AND status='posted';
  IF result IS NULL THEN RAISE EXCEPTION 'Receipt request is already used'; END IF; RETURN result;
 END IF;
 IF i.total-i.amount_paid<p_amount OR p_amount IS NULL OR p_amount<=0 OR p_amount<>round(p_amount,2) OR p_date IS NULL OR p_date>CURRENT_DATE
 OR length(coalesce(p_reference,''))>120 OR length(coalesce(p_notes,''))>2000 THEN RAISE EXCEPTION 'Check the receipt amount, date and invoice balance'; END IF;
 -- Use the shared PAY counter within this authorized transaction. Accounting-only
 -- users must not gain access to the general Media document-number allocator.
 INSERT INTO document_sequences AS ds(prefix,last_value) VALUES('PAY',1)
 ON CONFLICT(prefix) DO UPDATE SET last_value=ds.last_value+1 RETURNING last_value INTO receipt_number;
 INSERT INTO payments(document_number,invoice_id,client_id,amount,currency,status,payment_method,reference_number,paid_at,notes,recorded_by,receipt_request_id,metadata)
 VALUES('PAY-'||lpad(receipt_number::text,greatest(6,length(receipt_number::text)),'0'),i.id,i.client_id,p_amount,i.currency,'completed',p_method::payment_method,nullif(trim(p_reference),''),p_date::timestamp AT TIME ZONE 'UTC',nullif(trim(p_notes),''),auth.uid(),p_request,jsonb_build_object('source','tw_accounting')) RETURNING * INTO p;
 INSERT INTO payment_allocations(payment_id,invoice_id,allocated_amount,currency_code) VALUES(p.id,i.id,p_amount,i.currency);
 result:=tw_accounting_post_receipt(p.id,p_company,p.revision,p_post_date,p_cash,p_gain,p_loss,p_expected);
 INSERT INTO collection_audit_logs(entity_type,entity_id,action,actor_id,metadata) VALUES('payment',p.id,'accounting_receipt_posted',auth.uid(),jsonb_build_object('invoice_id',i.id,'journal_id',result,'amount',p.amount));
 RETURN result;
END $$;

CREATE FUNCTION public.tw_accounting_reverse_receipt(p_payment uuid,p_company uuid,p_date date,p_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r tw_accounting_receipts%ROWTYPE; p payments%ROWTYPE; j tw_accounting_journals%ROWTYPE; result uuid:=gen_random_uuid();
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM invoices WHERE id=(SELECT invoice_id FROM payments WHERE id=p_payment) FOR UPDATE;
 SELECT * INTO p FROM payments WHERE id=p_payment FOR UPDATE;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO r FROM tw_accounting_receipts WHERE payment_id=p_payment AND company_id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Posted receipt not found'; END IF;
 IF r.status='reversed' THEN RETURN r.reversal_id; END IF;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=r.journal_id FOR UPDATE;
 IF p.status<>'completed' OR p.revision<>r.payment_revision THEN RAISE EXCEPTION 'Receipt source changed. Reconciliation required'; END IF;
 IF p_date IS NULL OR p_date<j.entry_date OR p_date>CURRENT_DATE OR p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Enter a reversal reason and an open date on or after the original posting'; END IF;
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,reversal_of,reversal_reason,source_payment_id,transaction_currency,exchange_rate,exchange_rate_date)
 VALUES(result,p_company,p_date,j.voucher_number,'Receipt reversal of '||j.voucher_number||': '||trim(p_reason),auth.uid(),j.id,trim(p_reason),p.id,j.transaction_currency,j.exchange_rate,j.exchange_rate_date);
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,client_id,client_code)
 SELECT result,line_number,company_id,account_code,account_name,description,credit,debit,foreign_credit,foreign_debit,client_id,client_code FROM tw_accounting_journal_lines WHERE journal_id=j.id;
 PERFORM tw_accounting_finish_receipt_journal(result);
 UPDATE tw_accounting_receipts SET status='reversed',reversal_id=result,reversal_reason=trim(p_reason) WHERE payment_id=p.id;
 UPDATE payments SET status='cancelled',revision=revision+1 WHERE id=p.id;
 DELETE FROM payment_allocations WHERE payment_id=p.id;
 INSERT INTO collection_audit_logs(entity_type,entity_id,action,actor_id,metadata) VALUES('payment',p.id,'accounting_receipt_reversed',auth.uid(),jsonb_build_object('invoice_id',r.invoice_id,'journal_id',result,'reason',p_reason));
 RETURN result;
END $$;

CREATE FUNCTION public.tw_accounting_receipts_list(p_company uuid,p_search text DEFAULT '',p_page integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE rows jsonb; n bigint; choices jsonb;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page<0 OR p_page>100000 OR length(coalesce(p_search,''))>120 THEN RAISE EXCEPTION 'Invalid receipt filters'; END IF;
 SELECT count(*) INTO n FROM payments p JOIN tw_accounting_invoice_submissions s ON s.invoice_id=p.invoice_id
 LEFT JOIN tw_accounting_receipts r ON r.payment_id=p.id WHERE s.company_id=p_company AND (p.status='completed' OR r.payment_id IS NOT NULL)
 AND concat_ws(' ',p.document_number,s.client_code,s.client_name,s.source->>'number',p.reference_number) ILIKE '%'||coalesce(p_search,'')||'%';
 SELECT coalesce(jsonb_agg(x ORDER BY x.created_at DESC,x.id),'[]') INTO rows FROM (
 SELECT p.id,p.document_number,p.invoice_id,s.source->>'number' invoice_number,s.client_code,s.client_name,p.amount::text,trim(p.currency) currency,(p.paid_at AT TIME ZONE 'UTC')::date date,p.payment_method::text method,p.reference_number reference,p.revision,
 coalesce(r.status,'unposted') status,j.voucher_number voucher,r.journal_id,r.reversal_id,rj.voucher_number reversal,p.created_at,
 (p.advance_source_id IS NOT NULL OR p.advance_campaign_id IS NOT NULL OR p.metadata ? 'original_advance_amount') advance
 FROM payments p JOIN tw_accounting_invoice_submissions s ON s.invoice_id=p.invoice_id LEFT JOIN tw_accounting_receipts r ON r.payment_id=p.id
 LEFT JOIN tw_accounting_journals j ON j.id=r.journal_id LEFT JOIN tw_accounting_journals rj ON rj.id=r.reversal_id
 WHERE s.company_id=p_company AND (p.status='completed' OR r.payment_id IS NOT NULL)
 AND concat_ws(' ',p.document_number,s.client_code,s.client_name,s.source->>'number',p.reference_number) ILIKE '%'||coalesce(p_search,'')||'%'
 ORDER BY p.created_at DESC,p.id LIMIT 50 OFFSET p_page*50) x;
 SELECT coalesce(jsonb_agg(x ORDER BY x.date DESC,x.number),'[]') INTO choices FROM (
 SELECT i.id,i.document_number number,s.client_code,s.client_name,trim(i.currency) currency,i.total::text total,i.amount_paid::text paid,(i.total-i.amount_paid)::text outstanding,i.issue_date date,
 (i.total-coalesce((SELECT sum(amount) FROM tw_accounting_receipts WHERE invoice_id=i.id AND status='posted'),0))::text accounting_outstanding
 FROM tw_accounting_invoice_submissions s JOIN invoices i ON i.id=s.invoice_id
 WHERE s.company_id=p_company AND s.status='posted' AND i.status<>'void' AND i.regeneration_status::text='active'
 AND NOT EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=s.journal_id)
 AND concat_ws(' ',i.document_number,s.client_code,s.client_name) ILIKE '%'||coalesce(p_search,'')||'%'
 ORDER BY i.issue_date DESC,i.document_number LIMIT 100) x;
 RETURN jsonb_build_object('rows',rows,'count',n,'invoices',choices);
END $$;

REVOKE ALL ON FUNCTION public.tw_accounting_receipt_quote(uuid,uuid,numeric,date),public.tw_accounting_post_receipt(uuid,uuid,integer,date,text,text,text,jsonb),public.tw_accounting_record_receipt(uuid,uuid,uuid,numeric,date,text,text,text,date,text,text,text,jsonb),public.tw_accounting_reverse_receipt(uuid,uuid,date,text),public.tw_accounting_receipts_list(uuid,text,integer) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_accounting_receipt_quote(uuid,uuid,numeric,date),public.tw_accounting_post_receipt(uuid,uuid,integer,date,text,text,text,jsonb),public.tw_accounting_record_receipt(uuid,uuid,uuid,numeric,date,text,text,text,date,text,text,text,jsonb),public.tw_accounting_reverse_receipt(uuid,uuid,date,text),public.tw_accounting_receipts_list(uuid,text,integer) TO authenticated;
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
  IF j.company_id<>p_company OR j.status<>'draft' OR j.source_invoice_id IS NOT NULL OR j.source_payment_id IS NOT NULL OR j.reversal_of IS NOT NULL THEN RAISE EXCEPTION 'Only an ordinary draft in this company can be edited'; END IF;
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
 IF NOT FOUND OR j.status<>'draft' OR j.source_invoice_id IS NOT NULL OR j.source_payment_id IS NOT NULL OR p_version IS NULL OR j.version<>p_version THEN RAISE EXCEPTION 'Only the current draft can be cancelled' USING ERRCODE='40001'; END IF;
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
 IF j.source_payment_id IS NOT NULL THEN RAISE EXCEPTION 'Automatic receipt journals must use Receipts & collections'; END IF;
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
 IF j.source_payment_id IS NOT NULL THEN RAISE EXCEPTION 'Reverse the receipt from Receipts & collections to update both modules'; END IF;
 IF j.source_invoice_id IS NOT NULL AND EXISTS(SELECT 1 FROM payments WHERE invoice_id=j.source_invoice_id AND status='completed') THEN RAISE EXCEPTION 'Reverse linked receipts before reversing this invoice'; END IF;
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
COMMIT;
