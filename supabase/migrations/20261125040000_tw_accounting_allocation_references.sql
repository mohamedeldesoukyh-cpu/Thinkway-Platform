BEGIN;
CREATE OR REPLACE FUNCTION tw_accounting_settlement_post(p_id uuid,p_value jsonb,p_expected jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
#variable_conflict use_variable
DECLARE company uuid:=(p_value->>'company')::uuid; party uuid:=(p_value->>'party')::uuid; kind text:=p_value->>'kind'; day date:=(p_value->>'date')::date; q jsonb; existing tw_accounting_settlements%ROWTYPE; parent tw_accounting_settlements%ROWTYPE; j uuid:=gen_random_uuid(); item jsonb; n integer:=0; code text; name text; number text; client uuid; vendor uuid; amount numeric; b numeric; difference numeric; account text; pay uuid; payseq bigint; advance_left numeric;
BEGIN
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
 SELECT parent.advance_amount-coalesce(sum(s.amount),0) INTO advance_left FROM tw_accounting_settlements s WHERE s.parent_id=parent.id AND s.status='posted';
 UPDATE payments SET amount=CASE WHEN advance_left>0 THEN advance_left ELSE payments.amount END,status=CASE WHEN advance_left>0 THEN 'completed' ELSE 'cancelled' END::payment_status,revision=revision+1 WHERE id IN(SELECT payment_id FROM tw_accounting_settlement_payments WHERE settlement_id=parent.id AND is_advance);
 END IF;
 RETURN j;
END $$;

COMMIT;
