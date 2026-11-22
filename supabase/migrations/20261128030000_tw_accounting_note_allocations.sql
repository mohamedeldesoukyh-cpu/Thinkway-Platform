BEGIN;
-- Allocations link existing posted notes to invoices; they never post tax or cash again.
CREATE TABLE tw_accounting_note_allocations (
 source_type text NOT NULL,source_id uuid NOT NULL,
 invoice_id uuid REFERENCES invoices(id),cost_id uuid REFERENCES tw_accounting_cost_invoices(id),
 amount numeric(18,2) NOT NULL CHECK(amount>0),base_amount numeric(18,2) NOT NULL CHECK(base_amount>0),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id),created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(source_type,source_id) REFERENCES tw_accounting_media_postings(source_type,source_id),
 CHECK(source_type IN('client_credit_note','client_debit_note','vendor_credit_note','vendor_debit_note')),
 CHECK((source_type LIKE 'client_%' AND invoice_id IS NOT NULL AND cost_id IS NULL) OR (source_type LIKE 'vendor_%' AND cost_id IS NOT NULL AND invoice_id IS NULL))
);
CREATE UNIQUE INDEX tw_note_invoice ON tw_accounting_note_allocations(source_type,source_id,invoice_id) WHERE invoice_id IS NOT NULL;
CREATE UNIQUE INDEX tw_note_cost ON tw_accounting_note_allocations(source_type,source_id,cost_id) WHERE cost_id IS NOT NULL;
CREATE INDEX tw_note_invoice_target ON tw_accounting_note_allocations(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX tw_note_cost_target ON tw_accounting_note_allocations(cost_id) WHERE cost_id IS NOT NULL;
ALTER TABLE tw_accounting_note_allocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tw_accounting_note_allocations FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON tw_accounting_note_allocations TO authenticated;
CREATE POLICY accounting_read ON tw_accounting_note_allocations FOR SELECT TO authenticated USING((SELECT (tw_module_access()->>'accounting')::boolean));
CREATE TRIGGER accounting_audit AFTER INSERT OR UPDATE OR DELETE ON tw_accounting_note_allocations FOR EACH ROW EXECUTE FUNCTION tw_accounting_audit_change();

CREATE FUNCTION tw_accounting_note_adjustment(p_id uuid,p_base boolean DEFAULT false) RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(sum((CASE WHEN p_base THEN a.base_amount ELSE a.amount END)*CASE WHEN a.source_type LIKE '%credit_note' THEN -1 ELSE 1 END),0)
 FROM tw_accounting_note_allocations a JOIN tw_accounting_media_postings b USING(source_type,source_id)
 JOIN tw_accounting_journals j ON j.id=b.journal_id
 WHERE (a.invoice_id=p_id OR a.cost_id=p_id) AND b.status='posted' AND j.status='posted'
 AND NOT EXISTS(SELECT 1 FROM tw_accounting_journals r WHERE r.reversal_of=j.id)
$$;

-- Invoice identity, carrying balance and cash settlements are kept separate.
CREATE FUNCTION tw_accounting_note_target(p_company uuid,p_kind text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r jsonb;BEGIN
 IF p_kind='client' THEN
 SELECT jsonb_build_object('id',i.id,'number',i.document_number,'party',i.client_id,'currency',trim(i.currency),'date',j.entry_date,'journal',j.id,'locked',j.control_locked,'account',l.account_code,'total',i.total,'paid',i.amount_paid,'base',l.debit,'paidBase',coalesce((SELECT sum(x.amount) FROM (SELECT receivable_base amount FROM tw_accounting_receipts WHERE invoice_id=i.id AND status='posted' UNION ALL SELECT a.base_amount FROM tw_accounting_settlement_lines a JOIN tw_accounting_settlements s ON s.id=a.settlement_id WHERE a.invoice_id=i.id AND s.status='posted')x),0)) INTO r
 FROM invoices i JOIN tw_accounting_invoice_submissions s ON s.invoice_id=i.id JOIN tw_accounting_journals j ON j.id=s.journal_id
 JOIN LATERAL(SELECT * FROM tw_accounting_journal_lines WHERE journal_id=j.id AND client_id=i.client_id AND debit>0 ORDER BY line_number LIMIT 1)l ON true
 WHERE i.id=p_id AND s.company_id=p_company AND s.status='posted' AND j.status='posted' AND i.status<>'void' AND i.regeneration_status::text='active' AND NOT EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=j.id);
 ELSIF p_kind='vendor' THEN
 SELECT jsonb_build_object('id',c.id,'number',coalesce(c.supplier_number,c.number),'party',c.vendor_id,'currency',c.currency,'date',j.entry_date,'journal',j.id,'locked',j.control_locked,'account',c.payable_account,'total',c.net+c.tax,'paid',coalesce(a.paid,0),'base',c.base_net+c.base_tax,'paidBase',coalesce(a.base,0)) INTO r
 FROM tw_accounting_cost_invoices c JOIN tw_accounting_journals j ON j.id=c.journal_id
 LEFT JOIN LATERAL(SELECT sum(l.amount) paid,sum(l.base_amount) base FROM tw_accounting_settlement_lines l JOIN tw_accounting_settlements s ON s.id=l.settlement_id WHERE l.cost_id=c.id AND s.status='posted')a ON true
 WHERE c.id=p_id AND c.company_id=p_company AND c.status IN('internal','supplier') AND j.status='posted' AND NOT EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=j.id);
 END IF;
 IF r IS NULL THEN RAISE EXCEPTION 'Select an original posted invoice in this company';END IF;
 RETURN r||jsonb_build_object('adjustment',tw_accounting_note_adjustment(p_id),'baseAdjustment',tw_accounting_note_adjustment(p_id,true),'outstanding',(r->>'total')::numeric+tw_accounting_note_adjustment(p_id)-(r->>'paid')::numeric);
END $$;

CREATE FUNCTION tw_accounting_note_allocation_read(p_company uuid,p_type text,p_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s jsonb;k text;ids uuid[];target uuid;r jsonb;items jsonb:='[]';BEGIN
 s:=tw_accounting_media_source(p_company,p_type,p_id);
 IF p_type NOT IN('client_credit_note','client_debit_note','vendor_credit_note','vendor_debit_note') THEN RAISE EXCEPTION 'Choose a credit or debit note';END IF;
 k:=CASE WHEN p_type LIKE 'client_%' THEN 'client' ELSE 'vendor' END;
 IF k='client' THEN SELECT array_agg(invoice_id) INTO ids FROM tw_accounting_invoice_submissions WHERE company_id=p_company AND client_id=(s->>'client')::uuid AND status='posted';
 ELSE SELECT array_agg(id) INTO ids FROM tw_accounting_cost_invoices WHERE company_id=p_company AND vendor_id=(s->>'vendor')::uuid AND status IN('internal','supplier');END IF;
 FOREACH target IN ARRAY coalesce(ids,ARRAY[]::uuid[]) LOOP
  BEGIN r:=tw_accounting_note_target(p_company,k,target);EXCEPTION WHEN raise_exception THEN CONTINUE;END;
  IF r->>'currency'=s->>'currency' THEN items:=items||jsonb_build_array(r||jsonb_build_object('allocated',coalesce((SELECT amount FROM tw_accounting_note_allocations WHERE source_type=p_type AND source_id=p_id AND coalesce(invoice_id,cost_id)=target),0)));END IF;
 END LOOP;
 RETURN jsonb_build_object('note',s,'invoices',items);
END $$;

CREATE FUNCTION tw_accounting_note_allocate(p_company uuid,p_type text,p_id uuid,p_version integer,p_lines jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE b tw_accounting_media_postings%ROWTYPE;j tw_accounting_journals%ROWTYPE;r jsonb;x jsonb;k text;targets uuid[];target uuid;part numeric;allocated numeric:=0;allocated_base numeric:=0;full_base numeric;local_part numeric;BEGIN
 IF NOT tw_accounting_can_manage() OR NOT(is_admin() OR has_permission('finance.write') OR has_permission('finance.override')) THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 PERFORM tw_accounting_media_source(p_company,p_type,p_id);
 IF p_type NOT IN('client_credit_note','client_debit_note','vendor_credit_note','vendor_debit_note') OR jsonb_typeof(p_lines) IS DISTINCT FROM 'array' OR jsonb_array_length(p_lines)>200 THEN RAISE EXCEPTION 'Invalid note allocations';END IF;
 IF (SELECT count(DISTINCT v->>'id') FROM jsonb_array_elements(p_lines)v)<>jsonb_array_length(p_lines) THEN RAISE EXCEPTION 'Duplicate invoice allocation';END IF;
 SELECT array_agg(DISTINCT id ORDER BY id) INTO targets FROM (SELECT (value->>'id')::uuid id FROM jsonb_array_elements(p_lines) UNION SELECT coalesce(invoice_id,cost_id) FROM tw_accounting_note_allocations WHERE source_type=p_type AND source_id=p_id)x;
 -- Same invoice-first/company lock order as receipts; serialize all note balances.
 PERFORM id FROM invoices WHERE id=ANY(targets) ORDER BY id FOR UPDATE;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO b FROM tw_accounting_media_postings WHERE source_type=p_type AND source_id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND OR b.status<>'posted' OR b.version IS DISTINCT FROM p_version THEN RAISE EXCEPTION 'Posting changed. Browse again.' USING ERRCODE='40001';END IF;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=b.journal_id;
 IF j.status<>'posted' OR j.control_locked OR EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=j.id) THEN RAISE EXCEPTION 'Note must be posted, unlocked and not reversed';END IF;
 k:=CASE WHEN p_type LIKE 'client_%' THEN 'client' ELSE 'vendor' END;
 FOREACH target IN ARRAY coalesce(targets,ARRAY[]::uuid[]) LOOP
  r:=tw_accounting_note_target(p_company,k,target);
  IF (r->>'locked')::boolean OR NOT EXISTS(SELECT 1 FROM tw_accounting_years y JOIN tw_accounting_periods p ON p.year_id=y.id WHERE y.company_id=p_company AND (r->>'date')::date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed) THEN RAISE EXCEPTION 'Invoice must be unlocked in an open period';END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_years y JOIN tw_accounting_periods p ON p.year_id=y.id WHERE y.company_id=p_company AND j.entry_date BETWEEN p.start_date AND p.end_date AND NOT p.is_closed) THEN RAISE EXCEPTION 'Note period is closed';END IF;
 DELETE FROM tw_accounting_note_allocations WHERE source_type=p_type AND source_id=p_id;
 SELECT debit+credit INTO full_base FROM tw_accounting_journal_lines WHERE journal_id=j.id AND line_number=3;
 FOR x IN SELECT value FROM jsonb_array_elements(p_lines) LOOP
  target:=(x->>'id')::uuid;part:=(x->>'amount')::numeric;r:=tw_accounting_note_target(p_company,k,target);
  IF part IS NULL OR part<=0 OR part<>round(part,2) OR part::text IN('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Enter a positive amount with two decimals';END IF;
  IF r->>'party' IS DISTINCT FROM b.snapshot->>k OR r->>'currency' IS DISTINCT FROM b.snapshot->>'currency' OR (r->>'date')::date>j.entry_date OR r->>'account' IS DISTINCT FROM (SELECT account_code FROM tw_accounting_journal_lines WHERE journal_id=j.id AND line_number=3) THEN RAISE EXCEPTION 'Invoice must match the note party, currency, control account and posting date';END IF;
  IF abs(round(part*(r->>'base')::numeric/(r->>'total')::numeric,2)-round(part*full_base/(b.snapshot->>'total')::numeric,2))>0 THEN RAISE EXCEPTION 'Invoice and note booked exchange rates differ; resolve the FX adjustment before allocating';END IF;
  IF p_type LIKE '%credit_note' AND part>(r->>'outstanding')::numeric THEN RAISE EXCEPTION 'Credit allocation exceeds invoice outstanding';END IF;
  allocated:=allocated+part;
  IF allocated>(b.snapshot->>'total')::numeric THEN RAISE EXCEPTION 'Allocations exceed note amount';END IF;
  local_part:=round(allocated/(b.snapshot->>'total')::numeric*full_base,2)-allocated_base;allocated_base:=allocated_base+local_part;
  IF local_part<=0 THEN RAISE EXCEPTION 'Allocation below one local currency cent';END IF;
  INSERT INTO tw_accounting_note_allocations(source_type,source_id,invoice_id,cost_id,amount,base_amount) VALUES(p_type,p_id,CASE WHEN k='client' THEN target END,CASE WHEN k='vendor' THEN target END,part,local_part);
 END LOOP;
 FOREACH target IN ARRAY coalesce(targets,ARRAY[]::uuid[]) LOOP
  r:=tw_accounting_note_target(p_company,k,target);
  IF (r->>'outstanding')::numeric=0 AND (r->>'base')::numeric+(r->>'baseAdjustment')::numeric-(r->>'paidBase')::numeric<>0 THEN RAISE EXCEPTION 'Allocation leaves a local currency balance; resolve the exchange difference first';END IF;
  IF (r->>'outstanding')::numeric<0 THEN RAISE EXCEPTION 'Reverse dependent receipts/payments or credits before removing this debit allocation';END IF;
 END LOOP;
 IF k='client' THEN UPDATE invoices SET status=(CASE WHEN amount_paid>=total+tw_accounting_note_adjustment(id) THEN 'paid' WHEN amount_paid>0 THEN 'partial' WHEN status::text='overdue' THEN 'overdue' ELSE 'sent' END)::invoice_status WHERE id=ANY(targets);END IF;
 UPDATE tw_accounting_media_postings SET version=version+1 WHERE source_type=p_type AND source_id=p_id;
END $$;

-- Allocated sources must first have allocations explicitly cleared (audited).
CREATE FUNCTION tw_accounting_note_dependency_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF (NEW.status IS DISTINCT FROM OLD.status OR NEW.reversal_of IS NOT NULL) AND EXISTS(SELECT 1 FROM tw_accounting_note_allocations a JOIN tw_accounting_media_postings b USING(source_type,source_id) LEFT JOIN tw_accounting_invoice_submissions s ON s.invoice_id=a.invoice_id LEFT JOIN tw_accounting_cost_invoices c ON c.id=a.cost_id WHERE OLD.id IN(b.journal_id,s.journal_id,c.journal_id) OR NEW.reversal_of IN(b.journal_id,s.journal_id,c.journal_id)) THEN RAISE EXCEPTION 'Clear related note allocations before unposting, reversing or changing journal status';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tw_note_dependencies BEFORE INSERT OR UPDATE ON tw_accounting_journals FOR EACH ROW EXECUTE FUNCTION tw_accounting_note_dependency_guard();
REVOKE ALL ON FUNCTION tw_accounting_note_adjustment(uuid,boolean),tw_accounting_note_target(uuid,text,uuid),tw_accounting_note_allocation_read(uuid,text,uuid),tw_accounting_note_allocate(uuid,text,uuid,integer,jsonb),tw_accounting_note_dependency_guard() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_note_allocation_read(uuid,text,uuid),tw_accounting_note_allocate(uuid,text,uuid,integer,jsonb) TO authenticated;


-- Descriptive references only: statements continue summing the original GL lines.
CREATE FUNCTION tw_accounting_note_references(p_journal uuid) RETURNS text LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $$
 SELECT string_agg(coalesce(i.document_number,c.supplier_number,c.number)||' ('||a.amount::text||' '||(b.snapshot->>'currency')||')',', ' ORDER BY coalesce(i.document_number,c.supplier_number,c.number)) FROM tw_accounting_note_allocations a JOIN tw_accounting_media_postings b USING(source_type,source_id) LEFT JOIN invoices i ON i.id=a.invoice_id LEFT JOIN tw_accounting_cost_invoices c ON c.id=a.cost_id WHERE b.journal_id=p_journal AND b.status='posted'
$$;
REVOKE ALL ON FUNCTION tw_accounting_note_references(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_note_references(uuid) TO authenticated;
DO $$ DECLARE b text;BEGIN
 SELECT pg_get_functiondef('tw_accounting_statement_filtered(uuid,date,date,text,text,uuid,text,integer,uuid,jsonb)'::regprocedure) INTO b;
 IF position('l.account_name,l.description,l.auxiliary_id' IN b)=0 THEN RAISE EXCEPTION 'Unexpected statement definition';END IF;
 EXECUTE replace(b,'l.account_name,l.description,l.auxiliary_id','l.account_name,concat_ws('' · '',l.description,tw_accounting_note_references(j.id)) description,l.auxiliary_id');
END $$;

-- Extend existing calculations in place, retaining their permissions and controls.
DO $patch$ DECLARE f text;b text;old text;new text;pair text[];BEGIN
 FOREACH f IN ARRAY ARRAY['tw_accounting_open_items(uuid,text,uuid,text,text)','tw_accounting_settlement_quote(jsonb)','tw_accounting_receipt_quote(uuid,uuid,numeric,date)','tw_accounting_guard_payment()','tw_accounting_record_receipt(uuid,uuid,uuid,numeric,date,text,text,text,date,text,text,text,jsonb)','tw_accounting_receipts_list(uuid,text,integer)'] LOOP
  SELECT pg_get_functiondef(f::regprocedure) INTO b;
  IF f LIKE 'tw_accounting_open_items%' OR f LIKE 'tw_accounting_receipts_list%' THEN
   b:=replace(b,'(i.total-coalesce((SELECT sum(amount) FROM tw_accounting_receipts','(i.total+tw_accounting_note_adjustment(i.id)-coalesce((SELECT sum(amount) FROM tw_accounting_receipts');
   b:=replace(b,'i.total-i.amount_paid','i.total+tw_accounting_note_adjustment(i.id)-i.amount_paid');
   b:=replace(b,'i.total>i.amount_paid','i.total+tw_accounting_note_adjustment(i.id)>i.amount_paid');
   b:=replace(b,'c.net+c.tax-coalesce(a.paid,0)','c.net+c.tax+tw_accounting_note_adjustment(c.id)-coalesce(a.paid,0)');
   b:=replace(b,'c.net+c.tax>coalesce(a.paid,0)','c.net+c.tax+tw_accounting_note_adjustment(c.id)>coalesce(a.paid,0)');
   b:=replace(b,'i.total::text total,','i.total::text total,tw_accounting_note_adjustment(i.id)::text adjustments,');
   b:=replace(b,'(c.net+c.tax)::text total,','(c.net+c.tax)::text total,tw_accounting_note_adjustment(c.id)::text adjustments,');
  ELSIF f LIKE 'tw_accounting_settlement_quote%' THEN
   b:=replace(b,'part:=(item->>''amount'')::numeric;','part:=(item->>''amount'')::numeric; IF EXISTS(SELECT 1 FROM tw_accounting_note_allocations na JOIN tw_accounting_media_postings nb USING(source_type,source_id) JOIN tw_accounting_journals nj ON nj.id=nb.journal_id WHERE coalesce(na.invoice_id,na.cost_id)=(item->>''id'')::uuid AND nb.status=''posted'' AND nj.entry_date>day) THEN RAISE EXCEPTION ''Settlement date must be on or after allocated notes'';END IF;');
   b:=replace(b,'i.total-i.amount_paid>=part','i.total+tw_accounting_note_adjustment(i.id)-i.amount_paid>=part');
   b:=replace(b,'c.net+c.tax-paid','c.net+c.tax+tw_accounting_note_adjustment(c.id)-paid');
   b:=replace(b,'c.base_net+c.base_tax-paid_base','c.base_net+c.base_tax+tw_accounting_note_adjustment(c.id,true)-paid_base');
  ELSIF f LIKE 'tw_accounting_receipt_quote%' THEN
   b:=replace(b,'SELECT * INTO i FROM invoices WHERE id=p_invoice;','SELECT * INTO i FROM invoices WHERE id=p_invoice; IF EXISTS(SELECT 1 FROM tw_accounting_note_allocations na JOIN tw_accounting_media_postings nb USING(source_type,source_id) JOIN tw_accounting_journals nj ON nj.id=nb.journal_id WHERE na.invoice_id=p_invoice AND nb.status=''posted'' AND nj.entry_date>p_date) THEN RAISE EXCEPTION ''Receipt date must be on or after allocated notes'';END IF;');
   b:=replace(b,'settled+p_amount>i.total','settled+p_amount>i.total+tw_accounting_note_adjustment(i.id)');
   old:='carrying:=round((settled+p_amount)*original.debit/i.total,2)-settled_base;';
   IF position(old IN b)=0 THEN RAISE EXCEPTION 'Unexpected receipt carrying balance';END IF;
   b:=replace(b,old,'carrying:=CASE WHEN tw_accounting_note_adjustment(i.id)=0 AND tw_accounting_note_adjustment(i.id,true)=0 THEN round((settled+p_amount)*original.debit/i.total,2)-settled_base WHEN p_amount=i.total+tw_accounting_note_adjustment(i.id)-settled THEN original.debit+tw_accounting_note_adjustment(i.id,true)-settled_base ELSE round(p_amount/(i.total+tw_accounting_note_adjustment(i.id)-settled)*(original.debit+tw_accounting_note_adjustment(i.id,true)-settled_base),2) END;');
  ELSIF f LIKE 'tw_accounting_guard_payment%' THEN
   b:=replace(b,'other_paid+NEW.amount>i.total','other_paid+NEW.amount>i.total+tw_accounting_note_adjustment(i.id)');
  ELSE b:=replace(b,'i.total-i.amount_paid<p_amount','i.total+tw_accounting_note_adjustment(i.id)-i.amount_paid<p_amount');
  END IF;
  EXECUTE b;
 END LOOP;
 -- Only the unallocated residual remains a standalone note in aging.
 SELECT pg_get_functiondef('tw_accounting_aging(uuid,text,text,uuid)'::regprocedure) INTO b;
 b:=replace(b,'(b.snapshot->>''total'')::numeric*CASE','((b.snapshot->>''total'')::numeric-coalesce((SELECT sum(a.amount) FROM tw_accounting_note_allocations a WHERE a.source_type=b.source_type AND a.source_id=b.source_id),0))*CASE');
 b:=replace(b,'WHERE b.company_id=p_company','WHERE (b.snapshot->>''total'')::numeric>coalesce((SELECT sum(a.amount) FROM tw_accounting_note_allocations a WHERE a.source_type=b.source_type AND a.source_id=b.source_id),0) AND NOT EXISTS(SELECT 1 FROM tw_accounting_journals r WHERE r.reversal_of=j.id) AND b.company_id=p_company');
 EXECUTE b;
END $patch$;
-- Cash remains cash; payment status uses the invoice's adjusted collectible amount.
DO $$ DECLARE b text;BEGIN
 SELECT pg_get_functiondef('sync_invoice_payment_status()'::regprocedure) INTO b;
 IF position('SELECT total' IN b)=0 THEN RAISE EXCEPTION 'Unexpected invoice payment status function';END IF;
 EXECUTE replace(b,'SELECT total','SELECT total+tw_accounting_note_adjustment(v_invoice_id)');
END $$;
-- Reconciliation changes invoice totals; detach notes before revising a cost.
CREATE FUNCTION tw_accounting_note_cost_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF (NEW.net,NEW.tax,NEW.currency,NEW.vendor_id) IS DISTINCT FROM (OLD.net,OLD.tax,OLD.currency,OLD.vendor_id) AND EXISTS(SELECT 1 FROM tw_accounting_note_allocations WHERE cost_id=OLD.id) THEN RAISE EXCEPTION 'Clear note allocations before revising this cost invoice';END IF;RETURN NEW;
END $$;
CREATE TRIGGER tw_note_cost_guard BEFORE UPDATE ON tw_accounting_cost_invoices FOR EACH ROW EXECUTE FUNCTION tw_accounting_note_cost_guard();
REVOKE ALL ON FUNCTION tw_accounting_note_cost_guard() FROM PUBLIC,anon,authenticated,service_role;
NOTIFY pgrst,'reload schema';
COMMIT;

