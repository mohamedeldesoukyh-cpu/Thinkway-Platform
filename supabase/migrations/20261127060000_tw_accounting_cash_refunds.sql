BEGIN;
ALTER TABLE tw_accounting_settlements DROP CONSTRAINT tw_accounting_settlements_kind_check,DROP CONSTRAINT tw_accounting_settlements_amount_check,DROP CONSTRAINT tw_accounting_settlements_advance_amount_check;
ALTER TABLE tw_accounting_settlements ADD CONSTRAINT tw_accounting_settlements_kind_check CHECK(kind IN ('receipt','payment','receipt_apply','payment_apply','receipt_refund','payment_refund')),
 ADD CONSTRAINT tw_accounting_settlements_amount_check CHECK((kind LIKE '%_refund' AND amount<0 AND advance_amount<=0 AND parent_id IS NOT NULL) OR (kind NOT LIKE '%_refund' AND amount>0 AND advance_amount>=0));
ALTER TABLE tw_accounting_settlement_lines DROP CONSTRAINT tw_accounting_settlement_lines_amount_check,DROP CONSTRAINT tw_accounting_settlement_lines_base_amount_check;
ALTER TABLE tw_accounting_settlement_lines ADD CONSTRAINT tw_accounting_settlement_lines_amount_check CHECK(amount<>0),ADD CONSTRAINT tw_accounting_settlement_lines_base_amount_check CHECK(base_amount<>0 AND sign(base_amount)=sign(amount));
CREATE FUNCTION tw_accounting_advance_used(p_parent uuid) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(sum(CASE WHEN kind LIKE '%_refund' THEN -advance_amount ELSE amount END),0) FROM tw_accounting_settlements WHERE parent_id=p_parent AND status='posted' $$;
CREATE FUNCTION tw_accounting_advance_base_used(p_parent uuid) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT coalesce(sum(CASE WHEN kind LIKE '%_refund' THEN -advance_base ELSE (request->'quote'->>'cash')::numeric END),0) FROM tw_accounting_settlements WHERE parent_id=p_parent AND status='posted' $$;
CREATE FUNCTION tw_accounting_refund_payment_remaining(p_payment uuid) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN m.is_advance THEN s.advance_amount-tw_accounting_advance_used(s.id) ELSE
 (SELECT l.amount FROM tw_accounting_settlement_lines l WHERE l.settlement_id=s.id AND l.invoice_id=p.invoice_id)+
 coalesce((SELECT sum(l.amount) FROM tw_accounting_settlement_lines l JOIN tw_accounting_settlements r ON r.id=l.settlement_id WHERE r.parent_id=s.id AND r.kind='receipt_refund' AND r.status='posted' AND l.invoice_id=p.invoice_id),0) END
 FROM payments p JOIN tw_accounting_settlement_payments m ON m.payment_id=p.id JOIN tw_accounting_settlements s ON s.id=m.settlement_id WHERE p.id=p_payment
$$;
CREATE FUNCTION tw_accounting_sync_refund_payments(p_parent uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE p payments%ROWTYPE;remaining numeric;BEGIN
 FOR p IN SELECT x.* FROM payments x JOIN tw_accounting_settlement_payments m ON m.payment_id=x.id WHERE m.settlement_id=p_parent ORDER BY x.id LOOP
 remaining:=tw_accounting_refund_payment_remaining(p.id);
 IF remaining IS NULL OR remaining<0 THEN RAISE EXCEPTION 'Refund exceeds the original receipt';END IF;
 IF p.amount IS DISTINCT FROM (CASE WHEN remaining>0 THEN remaining ELSE p.amount END) OR p.status::text IS DISTINCT FROM (CASE WHEN remaining>0 THEN 'completed' ELSE 'cancelled' END) THEN
 UPDATE payments SET amount=CASE WHEN remaining>0 THEN remaining ELSE amount END,status=(CASE WHEN remaining>0 THEN 'completed' ELSE 'cancelled' END)::payment_status,revision=revision+1 WHERE id=p.id;
 END IF;
 IF p.invoice_id IS NOT NULL THEN
 IF remaining=0 THEN DELETE FROM payment_allocations WHERE payment_id=p.id;
 ELSIF EXISTS(SELECT 1 FROM payment_allocations WHERE payment_id=p.id) THEN UPDATE payment_allocations SET allocated_amount=remaining WHERE payment_id=p.id;
 ELSE INSERT INTO payment_allocations(payment_id,invoice_id,allocated_amount,currency_code) VALUES(p.id,p.invoice_id,remaining,p.currency);END IF;
 END IF;
 END LOOP;
END $$;
CREATE FUNCTION tw_accounting_refund_quote(p_value jsonb) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE s tw_accounting_settlements%ROWTYPE;c tw_accounting_companies%ROWTYPE;item jsonb;l tw_accounting_settlement_lines%ROWTYPE;currency text:=p_value->>'currency';kind text:=p_value->>'kind';day date:=(p_value->>'date')::date;amount numeric:=(p_value->>'amount')::numeric;part numeric;b numeric;left_amount numeric;left_base numeric;allocated numeric:=0;carrying numeric:=0;adv numeric;adv_base numeric;cash numeric;rate numeric;result jsonb:='[]';BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM tw_accounting_settlements WHERE id=(p_value->>'refundOf')::uuid AND company_id=(p_value->>'company')::uuid AND status='posted';
 IF NOT FOUND OR s.kind NOT IN ('receipt','payment') OR kind<>s.kind||'_refund' OR s.currency<>currency OR coalesce(s.client_id,s.vendor_id)<>(p_value->>'party')::uuid OR s.control_account<>p_value->>'control' OR s.advance_account<>p_value->>'advance' THEN RAISE EXCEPTION 'Choose the original receipt or payment for this party and currency';END IF;
 IF amount IS NULL OR amount>=0 OR amount<>round(amount,2) OR day IS NULL OR day<s.date OR day>(now() AT TIME ZONE 'Africa/Cairo')::date OR length(trim(coalesce(p_value->>'reference',''))) <3 OR jsonb_typeof(p_value->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_value->'lines')>200 THEN RAISE EXCEPTION 'Enter a negative refund amount, date and refund reference';END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_journals WHERE id=s.journal_id AND control_locked) THEN RAISE EXCEPTION 'Original voucher is locked';END IF;
 SELECT * INTO c FROM tw_accounting_companies WHERE id=s.company_id;
 IF NOT currency=ANY(c.currencies) THEN RAISE EXCEPTION 'Enable the refund currency in this company';END IF;
 PERFORM tw_accounting_require_account(c.id,p_value->>'cash','Posting','Asset','Debit');IF p_value->>'cash' NOT LIKE '11%' THEN RAISE EXCEPTION 'Choose a cash or bank account';END IF;
 IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_value->'lines'))<>jsonb_array_length(p_value->'lines') THEN RAISE EXCEPTION 'Duplicate refund allocation';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_value->'lines') LOOP
 part:=(item->>'amount')::numeric;
 SELECT * INTO l FROM tw_accounting_settlement_lines WHERE settlement_id=s.id AND coalesce(invoice_id,cost_id)=(item->>'id')::uuid;
 IF NOT FOUND OR part IS NULL OR part>=0 OR part<>round(part,2) THEN RAISE EXCEPTION 'Choose original settled invoices and negative refund allocations';END IF;
 SELECT l.amount+coalesce(sum(x.amount),0),l.base_amount+coalesce(sum(x.base_amount),0) INTO left_amount,left_base FROM tw_accounting_settlement_lines x JOIN tw_accounting_settlements r ON r.id=x.settlement_id WHERE r.parent_id=s.id AND r.kind=kind AND r.status='posted' AND coalesce(x.invoice_id,x.cost_id)=(item->>'id')::uuid;
 IF -part>left_amount THEN RAISE EXCEPTION 'Refund exceeds the remaining original allocation';END IF;
 b:=CASE WHEN -part=left_amount THEN -left_base ELSE -round((-part)/left_amount*left_base,2) END;
 IF b>=0 THEN RAISE EXCEPTION 'Refund allocation is below one local cent';END IF;
 allocated:=allocated+part;carrying:=carrying+b;
 result:=result||jsonb_build_array(jsonb_build_object('id',item->>'id','number',coalesce((SELECT document_number FROM invoices WHERE id=l.invoice_id),(SELECT number FROM tw_accounting_cost_invoices WHERE id=l.cost_id)),'amount',part::text,'base',b::text));
 END LOOP;
 IF allocated<amount THEN RAISE EXCEPTION 'Refund allocations exceed the refund amount';END IF;
 adv:=amount-allocated;left_amount:=s.advance_amount-tw_accounting_advance_used(s.id);left_base:=s.advance_base-tw_accounting_advance_base_used(s.id);
 IF -adv>left_amount THEN RAISE EXCEPTION 'Refund exceeds the unused original advance';END IF;
 adv_base:=CASE WHEN adv=0 THEN 0 WHEN -adv=left_amount THEN -left_base ELSE -round((-adv)/left_amount*left_base,2) END;
 rate:=resolve_effective_exchange_rate(currency,c.base_currency,day);cash:=round(amount*rate,2);
 IF cash>=0 OR adv<0 AND adv_base>=0 THEN RAISE EXCEPTION 'Refund converts to less than one local cent';END IF;
 RETURN jsonb_build_object('currency',currency,'base',c.base_currency,'rate',rate::text,'date',day,'amount',amount::text,'cash',cash::text,'allocated',allocated::text,'carrying',carrying::text,'advance',adv::text,'advanceBase',adv_base::text,'gain',(CASE WHEN s.client_id IS NOT NULL THEN cash-carrying-adv_base ELSE carrying+adv_base-cash END)::text,'lines',result);
END $$;
CREATE FUNCTION tw_accounting_refund_post(p_id uuid,p_value jsonb,p_expected jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE s tw_accounting_settlements%ROWTYPE;e tw_accounting_settlements%ROWTYPE;q jsonb;j uuid:=gen_random_uuid();number text;item jsonb;n integer:=0;b numeric;amount numeric;gain numeric;client boolean;BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 PERFORM i.id FROM invoices i JOIN tw_accounting_settlement_lines l ON l.invoice_id=i.id WHERE l.settlement_id=(p_value->>'refundOf')::uuid ORDER BY i.id FOR UPDATE OF i;
 PERFORM 1 FROM tw_accounting_companies WHERE id=(p_value->>'company')::uuid FOR UPDATE;
 SELECT * INTO e FROM tw_accounting_settlements WHERE id=p_id;
 IF FOUND THEN IF e.request->'value' IS DISTINCT FROM p_value OR e.status<>'posted' THEN RAISE EXCEPTION 'Refund request ID already used';END IF;RETURN e.journal_id;END IF;
 q:=tw_accounting_refund_quote(p_value);IF p_expected IS NULL OR q IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Refund balances or rates changed. Preview again.' USING ERRCODE='40001';END IF;
 SELECT * INTO s FROM tw_accounting_settlements WHERE id=(p_value->>'refundOf')::uuid;
 client:=s.client_id IS NOT NULL;number:=tw_accounting_number(s.company_id,CASE WHEN client THEN 'RR' ELSE 'PR' END,(p_value->>'date')::date);
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,automatic_source,transaction_currency,exchange_rate,exchange_rate_date) VALUES(j,s.company_id,(p_value->>'date')::date,number,'Refund of '||s.number||' · '||left(p_value->>'reference',500),auth.uid(),p_value->>'kind',s.currency,(q->>'rate')::numeric,(p_value->>'date')::date);
 INSERT INTO tw_accounting_settlements(id,company_id,kind,client_id,vendor_id,party_code,party_name,number,date,currency,amount,exchange_rate,cash_account,control_account,advance_account,advance_amount,advance_base,parent_id,journal_id,request,created_by)
 VALUES(p_id,s.company_id,p_value->>'kind',s.client_id,s.vendor_id,s.party_code,s.party_name,number,(p_value->>'date')::date,s.currency,(q->>'amount')::numeric,(q->>'rate')::numeric,p_value->>'cash',s.control_account,s.advance_account,(q->>'advance')::numeric,(q->>'advanceBase')::numeric,s.id,j,jsonb_build_object('value',p_value,'quote',q),auth.uid());
 FOR item IN SELECT value FROM jsonb_array_elements(q->'lines') LOOP
 n:=n+1;b:=-(item->>'base')::numeric;amount:=-(item->>'amount')::numeric;
 INSERT INTO tw_accounting_settlement_lines VALUES(p_id,n,CASE WHEN client THEN (item->>'id')::uuid END,CASE WHEN NOT client THEN (item->>'id')::uuid END,-amount,-b);
 PERFORM tw_accounting_auto_line(j,n,s.control_account,'Refund · '||(item->>'number'),CASE WHEN client THEN b ELSE 0 END,CASE WHEN NOT client THEN b ELSE 0 END,CASE WHEN client THEN amount ELSE 0 END,CASE WHEN NOT client THEN amount ELSE 0 END,s.client_id,s.vendor_id,s.party_code);
 END LOOP;
 b:=-(q->>'advanceBase')::numeric;amount:=-(q->>'advance')::numeric;
 IF amount>0 THEN n:=n+1;PERFORM tw_accounting_auto_line(j,n,s.advance_account,'Advance refund · '||s.number,CASE WHEN client THEN b ELSE 0 END,CASE WHEN NOT client THEN b ELSE 0 END,CASE WHEN client THEN amount ELSE 0 END,CASE WHEN NOT client THEN amount ELSE 0 END,s.client_id,s.vendor_id,s.party_code);END IF;
 n:=n+1;b:=-(q->>'cash')::numeric;amount:=-(q->>'amount')::numeric;
 PERFORM tw_accounting_auto_line(j,n,p_value->>'cash','Refund cash / bank',CASE WHEN NOT client THEN b ELSE 0 END,CASE WHEN client THEN b ELSE 0 END,CASE WHEN NOT client THEN amount ELSE 0 END,CASE WHEN client THEN amount ELSE 0 END);
 gain:=(q->>'gain')::numeric;
 IF gain<>0 THEN PERFORM tw_accounting_require_account(s.company_id,CASE WHEN gain>0 THEN p_value->>'gain' ELSE p_value->>'loss' END,'Posting',CASE WHEN gain>0 THEN 'Revenue' ELSE 'Expense' END,CASE WHEN gain>0 THEN 'Credit' ELSE 'Debit' END);PERFORM tw_accounting_auto_line(j,n+1,CASE WHEN gain>0 THEN p_value->>'gain' ELSE p_value->>'loss' END,'Refund exchange difference',greatest(-gain,0),greatest(gain,0),NULL,NULL);END IF;
 PERFORM tw_accounting_finish_receipt_journal(j);
 IF client THEN PERFORM tw_accounting_sync_refund_payments(s.id);END IF;
 RETURN j;
END $$;
CREATE OR REPLACE FUNCTION public.tw_accounting_settlement_quote(p_value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_variable
DECLARE company uuid:=(p_value->>'company')::uuid; party uuid:=(p_value->>'party')::uuid; kind text:=p_value->>'kind'; currency text:=p_value->>'currency'; day date:=(p_value->>'date')::date;
 amount numeric:=(p_value->>'amount')::numeric; base text; rate numeric; cash numeric; allocated numeric:=0; carrying numeric:=0; part numeric; b numeric; paid numeric; paid_base numeric; q jsonb; result jsonb:='[]'; item jsonb; c tw_accounting_cost_invoices%ROWTYPE; parent tw_accounting_settlements%ROWTYPE; used numeric; used_base numeric; adv numeric;
BEGIN
 IF p_value->>'kind' IN ('receipt_refund','payment_refund') THEN RETURN tw_accounting_refund_quote(p_value);END IF;
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 IF kind NOT IN ('receipt','payment','receipt_apply','payment_apply') OR amount IS NULL OR amount<=0 OR amount<>round(amount,2) OR day IS NULL OR day>(now() AT TIME ZONE 'Africa/Cairo')::date OR jsonb_typeof(p_value->'lines') IS DISTINCT FROM 'array' OR jsonb_array_length(p_value->'lines')>200 THEN RAISE EXCEPTION 'Check voucher type, date, amount and allocation lines'; END IF;
 SELECT base_currency INTO base FROM tw_accounting_companies WHERE id=company AND currency=ANY(currencies);
 IF NOT FOUND THEN RAISE EXCEPTION 'Enable the voucher currency in this company'; END IF;
 IF (SELECT count(DISTINCT value->>'id') FROM jsonb_array_elements(p_value->'lines'))<>jsonb_array_length(p_value->'lines') THEN RAISE EXCEPTION 'Duplicate invoice allocation'; END IF;
 IF kind LIKE 'receipt%' THEN
 IF NOT EXISTS(SELECT 1 FROM clients WHERE id=party AND document_number IS NOT NULL) THEN RAISE EXCEPTION 'Client code unavailable'; END IF;
 PERFORM tw_accounting_require_account(company,p_value->>'control','Control','Asset','Debit','Customer');
 PERFORM tw_accounting_require_account(company,p_value->>'advance','Control','Liability','Credit','Customer');
 ELSE
 IF NOT EXISTS(SELECT 1 FROM influencers WHERE id=party AND document_number IS NOT NULL) THEN RAISE EXCEPTION 'Vendor code unavailable'; END IF;
 PERFORM tw_accounting_require_account(company,p_value->>'control','Control','Liability','Credit','Supplier / creator');
 PERFORM tw_accounting_require_account(company,p_value->>'advance','Control','Asset','Debit','Supplier / creator');
 END IF;
 IF kind LIKE '%_apply' THEN
 SELECT * INTO parent FROM tw_accounting_settlements WHERE id=(p_value->>'parent')::uuid AND company_id=company AND status='posted';
 IF NOT FOUND OR parent.parent_id IS NOT NULL OR parent.currency<>currency OR coalesce(parent.client_id,parent.vendor_id)<>party OR parent.kind||'_apply'<>kind OR parent.advance_account<>p_value->>'advance' OR day<parent.date THEN RAISE EXCEPTION 'Select an available advance for this party, currency and date'; END IF;
 SELECT tw_accounting_advance_used(parent.id),tw_accounting_advance_base_used(parent.id) INTO used,used_base;
 IF amount>parent.advance_amount-used THEN RAISE EXCEPTION 'Allocation exceeds the available advance'; END IF;
 cash:=CASE WHEN amount=parent.advance_amount-used THEN parent.advance_base-used_base ELSE round(amount/(parent.advance_amount-used)*(parent.advance_base-used_base),2) END;rate:=parent.exchange_rate;
 ELSE
 PERFORM tw_accounting_require_account(company,p_value->>'cash','Posting','Asset','Debit');
 IF p_value->>'cash' NOT LIKE '11%' THEN RAISE EXCEPTION 'Select a cash/bank account in class 11'; END IF;
 rate:=resolve_effective_exchange_rate(currency,base,day);cash:=round(amount*rate,2);
 END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_value->'lines') LOOP
 part:=(item->>'amount')::numeric;
 IF part IS NULL OR part<=0 OR part<>round(part,2) THEN RAISE EXCEPTION 'Each allocation needs a positive amount with at most two decimals'; END IF;
 IF kind LIKE 'receipt%' THEN
 IF NOT EXISTS(SELECT 1 FROM invoices i JOIN tw_accounting_invoice_submissions s ON s.invoice_id=i.id WHERE i.id=(item->>'id')::uuid AND s.company_id=company AND i.client_id=party AND i.currency=currency AND i.total-i.amount_paid>=part) THEN RAISE EXCEPTION 'Invoice balance changed or belongs to another client/currency'; END IF;
 q:=tw_accounting_receipt_quote((item->>'id')::uuid,company,part,day);
 IF q->>'account'<>p_value->>'control' OR day<(q->>'minPostingDate')::date THEN RAISE EXCEPTION 'Use the invoice receivable account and a date on or after its posting'; END IF;
 b:=(q->>'receivable')::numeric;
 ELSE
 SELECT * INTO c FROM tw_accounting_cost_invoices WHERE id=(item->>'id')::uuid AND company_id=company AND vendor_id=party AND tw_accounting_cost_invoices.currency=currency AND status IN ('internal','supplier');
 IF NOT FOUND OR c.payable_account<>p_value->>'control' OR day<c.document_date THEN RAISE EXCEPTION 'Select a posted cost invoice for this vendor, currency and payable account'; END IF;
 SELECT coalesce(sum(l.amount),0),coalesce(sum(l.base_amount),0) INTO paid,paid_base FROM tw_accounting_settlement_lines l JOIN tw_accounting_settlements s ON s.id=l.settlement_id WHERE l.cost_id=c.id AND s.status='posted';
 IF part>c.net+c.tax-paid THEN RAISE EXCEPTION 'Cost invoice balance changed. Reload.' USING ERRCODE='40001'; END IF;
 b:=CASE WHEN part=c.net+c.tax-paid THEN c.base_net+c.base_tax-paid_base ELSE round(part/(c.net+c.tax-paid)*(c.base_net+c.base_tax-paid_base),2) END;
 END IF;
 IF b<=0 THEN RAISE EXCEPTION 'Allocation converts to less than one local cent'; END IF;
 allocated:=allocated+part;carrying:=carrying+b;
 result:=result||jsonb_build_array(jsonb_build_object('id',item->>'id','number',CASE WHEN kind LIKE 'receipt%' THEN (SELECT source->>'number' FROM tw_accounting_invoice_submissions WHERE invoice_id=(item->>'id')::uuid) ELSE c.number END,'amount',round(part,2)::text,'base',b::text));
 END LOOP;
 IF allocated>amount OR (kind LIKE '%_apply' AND allocated<>amount) THEN RAISE EXCEPTION 'Allocations must not exceed the voucher; advance applications must be fully allocated'; END IF;
 adv:=round((amount-allocated)*rate,2);
 IF cash<=0 OR (amount>allocated AND adv<=0) THEN RAISE EXCEPTION 'Voucher or advance converts to less than one local cent'; END IF;
 IF amount>allocated AND NOT coalesce((p_value->>'advanceRow')::boolean,false) THEN RAISE EXCEPTION 'Allocate the full amount or add an advance row (Ctrl+N)'; END IF;
 RETURN jsonb_build_object('currency',currency,'base',base,'rate',rate::text,'date',day,'amount',round(amount,2)::text,'cash',cash::text,'allocated',allocated::text,'carrying',carrying::text,'advance',round(amount-allocated,2)::text,'advanceBase',adv::text,'gain',(CASE WHEN kind LIKE 'receipt%' THEN cash-carrying-adv ELSE carrying+adv-cash END)::text,'lines',result);
END $function$;
CREATE OR REPLACE FUNCTION public.tw_accounting_settlement_post(p_id uuid, p_value jsonb, p_expected jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_variable
DECLARE company uuid:=(p_value->>'company')::uuid; party uuid:=(p_value->>'party')::uuid; kind text:=p_value->>'kind'; day date:=(p_value->>'date')::date; q jsonb; existing tw_accounting_settlements%ROWTYPE; parent tw_accounting_settlements%ROWTYPE; j uuid:=gen_random_uuid(); item jsonb; n integer:=0; code text; name text; number text; client uuid; vendor uuid; amount numeric; b numeric; difference numeric; account text; pay uuid; payseq bigint; advance_left numeric;
BEGIN
 IF p_value->>'kind' IN ('receipt_refund','payment_refund') THEN RETURN tw_accounting_refund_post(p_id,p_value,p_expected);END IF;
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 -- Same invoice-first lock order as Media and Stage 4/5; then serialize company books.
 IF kind LIKE 'receipt%' THEN PERFORM id FROM invoices WHERE id IN(SELECT (value->>'id')::uuid FROM jsonb_array_elements(p_value->'lines')) ORDER BY id FOR UPDATE; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=company FOR UPDATE;
 SELECT * INTO existing FROM tw_accounting_settlements WHERE id=p_id;
 IF FOUND THEN IF existing.company_id<>company OR existing.request->'value' IS DISTINCT FROM p_value OR existing.status<>'posted' THEN RAISE EXCEPTION 'Request ID already used with different details'; END IF;RETURN existing.journal_id; END IF;
 q:=tw_accounting_settlement_quote(p_value);
 IF p_expected IS NULL OR q IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Balances or rate changed. Refresh the preview.' USING ERRCODE='40001'; END IF;
 IF kind LIKE 'receipt%' THEN client:=party;SELECT document_number,clients.name INTO code,name FROM clients WHERE id=party;ELSE vendor:=party;SELECT document_number,coalesce(legal_name,display_name,document_number) INTO code,name FROM influencers WHERE id=party; END IF;
 number:=tw_accounting_number(company,CASE WHEN kind LIKE '%_apply' THEN 'AL' WHEN client IS NOT NULL THEN 'RV' ELSE 'PV' END,day);
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,automatic_source,transaction_currency,exchange_rate,exchange_rate_date) VALUES(j,company,day,number,left(kind||' · '||code||' · '||coalesce(p_value->>'reference',''),1000),auth.uid(),kind,q->>'currency',(q->>'rate')::numeric,day);
 INSERT INTO tw_accounting_settlements(id,company_id,kind,client_id,vendor_id,party_code,party_name,number,date,currency,amount,exchange_rate,cash_account,control_account,advance_account,advance_amount,advance_base,parent_id,journal_id,request,created_by)
 VALUES(p_id,company,kind,client,vendor,code,name,number,day,q->>'currency',(q->>'amount')::numeric,(q->>'rate')::numeric,CASE WHEN kind NOT LIKE '%_apply' THEN p_value->>'cash' END,p_value->>'control',p_value->>'advance',(q->>'advance')::numeric,(q->>'advanceBase')::numeric,nullif(p_value->>'parent','')::uuid,j,jsonb_build_object('value',p_value,'quote',q),auth.uid());
 IF kind LIKE '%_apply' THEN SELECT * INTO parent FROM tw_accounting_settlements WHERE id=(p_value->>'parent')::uuid; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(q->'lines') LOOP
 n:=n+1;amount:=(item->>'amount')::numeric;b:=(item->>'base')::numeric;
 INSERT INTO tw_accounting_settlement_lines VALUES(p_id,n,CASE WHEN client IS NOT NULL THEN (item->>'id')::uuid END,CASE WHEN vendor IS NOT NULL THEN (item->>'id')::uuid END,amount,b);
 PERFORM tw_accounting_auto_line(j,n,p_value->>'control','Invoice '||(item->>'number')||' · '||code,CASE WHEN vendor IS NOT NULL THEN b ELSE 0 END,CASE WHEN client IS NOT NULL THEN b ELSE 0 END,CASE WHEN vendor IS NOT NULL THEN amount ELSE 0 END,CASE WHEN client IS NOT NULL THEN amount ELSE 0 END,client,vendor,code);
 IF client IS NOT NULL THEN
 INSERT INTO document_sequences AS ds(prefix,last_value) VALUES('PAY',1) ON CONFLICT(prefix) DO UPDATE SET last_value=ds.last_value+1 RETURNING last_value INTO payseq;
 INSERT INTO payments(document_number,invoice_id,client_id,amount,currency,status,payment_method,reference_number,paid_at,notes,recorded_by,metadata)
 VALUES('PAY-'||lpad(payseq::text,greatest(6,length(payseq::text)),'0'),(item->>'id')::uuid,client,amount,q->>'currency','completed',coalesce(p_value->>'method','bank_transfer')::payment_method,number,coalesce(parent.date,day)::timestamp AT TIME ZONE 'UTC',p_value->>'reference',auth.uid(),jsonb_build_object('accounting_voucher',p_id)) RETURNING id INTO pay;
 INSERT INTO payment_allocations(payment_id,invoice_id,allocated_amount,currency_code) VALUES(pay,(item->>'id')::uuid,amount,q->>'currency');
 INSERT INTO tw_accounting_settlement_payments VALUES(pay,p_id,false);
 END IF;
 END LOOP;
 amount:=(q->>'advance')::numeric;b:=(q->>'advanceBase')::numeric;
 IF amount>0 THEN
 n:=n+1;PERFORM tw_accounting_auto_line(j,n,p_value->>'advance','Advance · '||code,CASE WHEN vendor IS NOT NULL THEN b ELSE 0 END,CASE WHEN client IS NOT NULL THEN b ELSE 0 END,CASE WHEN vendor IS NOT NULL THEN amount ELSE 0 END,CASE WHEN client IS NOT NULL THEN amount ELSE 0 END,client,vendor,code);
 IF client IS NOT NULL THEN
 INSERT INTO document_sequences AS ds(prefix,last_value) VALUES('PAY',1) ON CONFLICT(prefix) DO UPDATE SET last_value=ds.last_value+1 RETURNING last_value INTO payseq;
 INSERT INTO payments(document_number,client_id,amount,currency,status,payment_method,reference_number,paid_at,recorded_by,metadata) VALUES('PAY-'||lpad(payseq::text,greatest(6,length(payseq::text)),'0'),client,amount,q->>'currency','completed',coalesce(p_value->>'method','bank_transfer')::payment_method,number,day::timestamp AT TIME ZONE 'UTC',auth.uid(),jsonb_build_object('accounting_voucher',p_id,'original_advance_amount',amount)) RETURNING id INTO pay;
 INSERT INTO tw_accounting_settlement_payments VALUES(pay,p_id,true);
 END IF;END IF;
 n:=n+1;account:=CASE WHEN kind LIKE '%_apply' THEN p_value->>'advance' ELSE p_value->>'cash' END;amount:=(q->>'amount')::numeric;b:=(q->>'cash')::numeric;
 PERFORM tw_accounting_auto_line(j,n,account,CASE WHEN kind LIKE '%_apply' THEN 'Advance applied · '||code ELSE 'Cash / bank' END,CASE WHEN client IS NOT NULL THEN b ELSE 0 END,CASE WHEN vendor IS NOT NULL THEN b ELSE 0 END,CASE WHEN client IS NOT NULL THEN amount ELSE 0 END,CASE WHEN vendor IS NOT NULL THEN amount ELSE 0 END,CASE WHEN kind LIKE '%_apply' THEN client END,CASE WHEN kind LIKE '%_apply' THEN vendor END,code);
 difference:=(q->>'gain')::numeric;
 IF difference<>0 THEN
 account:=CASE WHEN difference>0 THEN p_value->>'gain' ELSE p_value->>'loss' END;
 PERFORM tw_accounting_require_account(company,account,'Posting',CASE WHEN difference>0 THEN 'Revenue' ELSE 'Expense' END,CASE WHEN difference>0 THEN 'Credit' ELSE 'Debit' END);
 PERFORM tw_accounting_auto_line(j,n+1,account,'Realized exchange difference',greatest(-difference,0),greatest(difference,0),NULL,NULL);
 END IF;
 PERFORM tw_accounting_finish_receipt_journal(j);
 IF client IS NOT NULL AND kind='receipt_apply' THEN
 SELECT * INTO parent FROM tw_accounting_settlements WHERE id=(p_value->>'parent')::uuid;
 SELECT parent.advance_amount-tw_accounting_advance_used(parent.id) INTO advance_left;
 UPDATE payments SET amount=CASE WHEN advance_left>0 THEN advance_left ELSE payments.amount END,status=CASE WHEN advance_left>0 THEN 'completed' ELSE 'cancelled' END::payment_status,revision=revision+1 WHERE id IN(SELECT payment_id FROM tw_accounting_settlement_payments WHERE settlement_id=parent.id AND is_advance);
 END IF;
 RETURN j;
END $function$;
CREATE OR REPLACE FUNCTION public.tw_accounting_settlement_reverse(p_id uuid, p_company uuid, p_date date, p_reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_variable
DECLARE s tw_accounting_settlements%ROWTYPE;j tw_accounting_journals%ROWTYPE;r uuid:=gen_random_uuid();remaining numeric;BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM i.id FROM invoices i WHERE i.id IN(SELECT invoice_id FROM tw_accounting_settlement_lines WHERE settlement_id=p_id) ORDER BY i.id FOR UPDATE;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 SELECT * INTO s FROM tw_accounting_settlements WHERE id=p_id AND company_id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Voucher unavailable'; END IF;IF s.status='reversed' THEN RETURN s.reversal_id; END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_settlements WHERE parent_id=s.id AND status='posted') THEN RAISE EXCEPTION 'Reverse the advance allocations first'; END IF;
 IF p_date IS NULL OR p_date<s.date OR p_date>(now() AT TIME ZONE 'Africa/Cairo')::date OR length(trim(coalesce(p_reason,''))) NOT BETWEEN 3 AND 500 THEN RAISE EXCEPTION 'Enter a valid reversal date and reason'; END IF;
 SELECT * INTO j FROM tw_accounting_journals WHERE id=s.journal_id;
 INSERT INTO tw_accounting_journals(id,company_id,entry_date,reference,memo,created_by,automatic_source,reversal_of,reversal_reason,transaction_currency,exchange_rate,exchange_rate_date) VALUES(r,p_company,p_date,s.number,'Reversal: '||p_reason,auth.uid(),s.kind,j.id,p_reason,j.transaction_currency,j.exchange_rate,j.exchange_rate_date);
 INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,client_id,client_code,vendor_id,vendor_code,auxiliary_id) SELECT r,line_number,company_id,account_code,account_name,description,credit,debit,foreign_credit,foreign_debit,client_id,client_code,vendor_id,vendor_code,auxiliary_id FROM tw_accounting_journal_lines WHERE journal_id=j.id;
 PERFORM tw_accounting_finish_receipt_journal(r);
 UPDATE tw_accounting_settlements SET status='reversed',reversal_id=r WHERE id=s.id;
 UPDATE payments SET status='cancelled',revision=revision+1 WHERE status='completed' AND id IN(SELECT payment_id FROM tw_accounting_settlement_payments WHERE settlement_id=s.id);
 DELETE FROM payment_allocations WHERE payment_id IN(SELECT payment_id FROM tw_accounting_settlement_payments WHERE settlement_id=s.id);
 IF s.kind='receipt_apply' THEN
 SELECT p.advance_amount-tw_accounting_advance_used(p.id) INTO remaining FROM tw_accounting_settlements p WHERE p.id=s.parent_id;
 UPDATE payments SET amount=remaining,status='completed',revision=revision+1 WHERE id IN(SELECT payment_id FROM tw_accounting_settlement_payments WHERE settlement_id=s.parent_id AND is_advance);
 END IF;IF s.kind='receipt_refund' THEN PERFORM tw_accounting_sync_refund_payments(s.parent_id);END IF;RETURN r;
END $function$;
CREATE OR REPLACE FUNCTION public.tw_accounting_guard_settlement_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_variable
DECLARE m tw_accounting_settlement_payments%ROWTYPE;s tw_accounting_settlements%ROWTYPE;remaining numeric;BEGIN
 SELECT * INTO m FROM tw_accounting_settlement_payments WHERE payment_id=OLD.id;IF NOT FOUND THEN IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Accounting voucher payments cannot be deleted'; END IF;
 SELECT * INTO s FROM tw_accounting_settlements WHERE id=m.settlement_id;
 IF (to_jsonb(NEW)-ARRAY['amount','status','revision','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['amount','status','revision','updated_at']) OR NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'Correct this payment through its Accounting voucher'; END IF;
 IF s.status='reversed' AND NEW.status='cancelled' AND NEW.amount=OLD.amount THEN RETURN NEW; END IF;
 IF s.status='posted' AND EXISTS(SELECT 1 FROM tw_accounting_settlements WHERE parent_id=s.id AND kind='receipt_refund') THEN
 remaining:=tw_accounting_refund_payment_remaining(OLD.id);
 IF (remaining>0 AND NEW.status='completed' AND NEW.amount=remaining) OR (remaining=0 AND NEW.status='cancelled' AND NEW.amount=OLD.amount) THEN RETURN NEW;END IF;
 END IF;
 IF m.is_advance AND s.status='posted' THEN
 SELECT s.advance_amount-tw_accounting_advance_used(s.id) INTO remaining;
 IF (remaining>0 AND NEW.status='completed' AND NEW.amount=remaining AND (OLD.amount<>NEW.amount OR OLD.status<>NEW.status)) OR (remaining=0 AND NEW.status='cancelled' AND NEW.amount=OLD.amount) THEN RETURN NEW; END IF;
 END IF;RAISE EXCEPTION 'Accounting voucher payments are read-only; use allocation or reversal in TW Accounting';
END $function$;
CREATE OR REPLACE FUNCTION public.tw_accounting_guard_settlement_allocation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p payments%ROWTYPE;m tw_accounting_settlement_payments%ROWTYPE;s tw_accounting_settlements%ROWTYPE;remaining numeric;BEGIN
 SELECT * INTO p FROM payments WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.payment_id ELSE NEW.payment_id END;
 SELECT * INTO m FROM tw_accounting_settlement_payments WHERE payment_id=p.id;
 SELECT * INTO s FROM tw_accounting_settlements WHERE id=m.settlement_id;
 IF s.status='posted' AND EXISTS(SELECT 1 FROM tw_accounting_settlements WHERE parent_id=s.id AND kind='receipt_refund') THEN
 remaining:=tw_accounting_refund_payment_remaining(p.id);
 IF TG_OP='DELETE' AND remaining=0 THEN RETURN OLD;END IF;
 IF TG_OP<>'DELETE' AND remaining>0 AND NEW.allocated_amount=remaining AND NEW.invoice_id=p.invoice_id AND NEW.currency_code=p.currency AND (TG_OP='INSERT' OR NEW.payment_id=OLD.payment_id AND NEW.invoice_id=OLD.invoice_id AND NEW.currency_code=OLD.currency_code) THEN RETURN NEW;END IF;
 END IF;
 IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM tw_accounting_settlement_payments original_link JOIN tw_accounting_settlements original_settlement ON original_settlement.id=original_link.settlement_id WHERE original_link.payment_id=OLD.payment_id AND (original_settlement.status='posted' OR TG_OP<>'DELETE')) OR TG_OP<>'DELETE' AND EXISTS(SELECT 1 FROM tw_accounting_settlement_payments WHERE payment_id=NEW.payment_id) THEN RAISE EXCEPTION 'Accounting allocations are read-only; reverse their voucher'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;ELSE RETURN NEW;END IF;
END $function$;
CREATE OR REPLACE VIEW tw_accounting_voucher_register WITH(security_invoker=true) AS SELECT s.*,j.voucher_number,(s.advance_amount-coalesce((SELECT sum(CASE WHEN c.kind LIKE '%_refund' THEN -c.advance_amount ELSE c.amount END) FROM tw_accounting_settlements c WHERE c.parent_id=s.id AND c.status='posted'),0))::text advance_remaining FROM tw_accounting_settlements s JOIN tw_accounting_journals j ON j.id=s.journal_id;
REVOKE ALL ON FUNCTION tw_accounting_advance_used(uuid),tw_accounting_advance_base_used(uuid),tw_accounting_refund_payment_remaining(uuid),tw_accounting_sync_refund_payments(uuid),tw_accounting_refund_quote(jsonb),tw_accounting_refund_post(uuid,jsonb,jsonb) FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION tw_accounting_refund_items(p_company uuid,p_source uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE s tw_accounting_settlements%ROWTYPE;result jsonb;BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 SELECT * INTO s FROM tw_accounting_settlements WHERE id=p_source AND company_id=p_company AND kind IN ('receipt','payment') AND status='posted';
 IF NOT FOUND THEN RAISE EXCEPTION 'Select an original posted voucher';END IF;
 SELECT coalesce(jsonb_agg(x),'[]') INTO result FROM (
 SELECT coalesce(l.invoice_id,l.cost_id) id,coalesce(i.document_number,c.number) number,coalesce(i.issue_date,c.document_date) date,NULL::date due,l.amount::text total,(-coalesce(r.amount,0))::text settled,(l.amount+coalesce(r.amount,0))::text outstanding,s.currency,s.control_account account
 FROM tw_accounting_settlement_lines l LEFT JOIN invoices i ON i.id=l.invoice_id LEFT JOIN tw_accounting_cost_invoices c ON c.id=l.cost_id LEFT JOIN LATERAL(SELECT sum(rl.amount) amount FROM tw_accounting_settlement_lines rl JOIN tw_accounting_settlements rr ON rr.id=rl.settlement_id WHERE rr.parent_id=s.id AND rr.kind LIKE '%_refund' AND rr.status='posted' AND coalesce(rl.invoice_id,rl.cost_id)=coalesce(l.invoice_id,l.cost_id))r ON true WHERE l.settlement_id=s.id AND l.amount+coalesce(r.amount,0)>0 ORDER BY l.line)x;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_refund_items(uuid,uuid) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_refund_items(uuid,uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
