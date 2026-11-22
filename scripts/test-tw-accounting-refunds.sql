-- Development only. All data, source numbers and journal counters roll back.
BEGIN;
DO $$
DECLARE serial_before bigint; journal_count_before integer; prep_cancel uuid:=gen_random_uuid();bank_profile uuid:=gen_random_uuid();bank_statement uuid:=gen_random_uuid();before_count integer;bank_line integer;actor uuid; viewer uuid; customer uuid:=gen_random_uuid(); inv uuid:=gen_random_uuid(); egp uuid:=gen_random_uuid(); c uuid; j uuid; j2 uuid; original uuid; p uuid; rev uuid; req uuid:=gen_random_uuid(); q jsonb; blocked boolean; period uuid; vendor uuid; val jsonb; quote jsonb; rv uuid:=gen_random_uuid(); av uuid:=gen_random_uuid(); cost uuid:=gen_random_uuid(); pv uuid:=gen_random_uuid(); saved jsonb;
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='super_admin' AND p.is_active LIMIT 1;
 SELECT p.id INTO viewer FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='viewer' AND p.is_active AND NOT EXISTS(SELECT 1 FROM client_users WHERE profile_id=p.id) AND NOT EXISTS(SELECT 1 FROM influencers WHERE profile_id=p.id) LIMIT 1;
 IF actor IS NULL OR viewer IS NULL THEN RAISE EXCEPTION 'Development actors missing'; END IF;
 INSERT INTO clients(id,document_number,name,currency) VALUES(customer,'QA-RECEIPT-'||customer,'QA receipt rollback','EGP');
 INSERT INTO invoices(id,document_number,client_id,issue_date,currency,subtotal,tax_amount,total,revenue_before_vat,revenue_vat_amount,revenue_after_vat,amounts_finalized_at)
 VALUES(inv,'QA-INV-'||inv,customer,'2026-01-15','USD',100.05,14.01,114.06,100.05,14.01,114.06,now()),(egp,'QA-INV-'||egp,customer,'2026-01-15','EGP',100,0,100,100,0,100,now());
 INSERT INTO md_exchange_rates(from_currency,to_currency,exchange_rate,effective_start_date,effective_end_date,is_active,source)
 VALUES('USD','EGP',50.12345678,'2026-01-15','2026-01-15',true,'QA receipt rollback'),('USD','EGP',51,'2026-02-01','2026-02-01',true,'QA receipt rollback'),('USD','EGP',49,'2026-02-02','2026-02-02',true,'QA receipt rollback');
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 SET LOCAL ROLE authenticated;
 c:=tw_accounting_create_company('QA receipt rollback','EG','EGP','2026-01-01','[
 {"code":"100000","name":"Assets","parent":null,"type":"Asset","normal":"Debit","kind":"Group"},
 {"code":"131001","name":"Vendor advances","parent":"100000","type":"Asset","normal":"Debit","kind":"Control","subledger":"Supplier / creator"},
 {"code":"111001","name":"Cash and bank","parent":"100000","type":"Asset","normal":"Debit","kind":"Posting"},
 {"code":"121001","name":"Customers","parent":"100000","type":"Asset","normal":"Debit","kind":"Control","subledger":"Customer"},
 {"code":"200000","name":"Liabilities","parent":null,"type":"Liability","normal":"Credit","kind":"Group"},
 {"code":"211001","name":"Vendors","parent":"200000","type":"Liability","normal":"Credit","kind":"Control","subledger":"Supplier / creator"},
 {"code":"221001","name":"Customer advances","parent":"200000","type":"Liability","normal":"Credit","kind":"Control","subledger":"Customer"},
 {"code":"231001","name":"Output VAT","parent":"200000","type":"Liability","normal":"Credit","kind":"Posting"},
 {"code":"400000","name":"Revenue","parent":null,"type":"Revenue","normal":"Credit","kind":"Group"},
 {"code":"411001","name":"Campaign revenue","parent":"400000","type":"Revenue","normal":"Credit","kind":"Posting"},
 {"code":"712001","name":"Realized gain","parent":"400000","type":"Revenue","normal":"Credit","kind":"Posting"},
 {"code":"500000","name":"Expenses","parent":null,"type":"Expense","normal":"Debit","kind":"Group"},
 {"code":"722001","name":"Realized loss","parent":"500000","type":"Expense","normal":"Debit","kind":"Posting"}]');
 PERFORM tw_accounting_submit_invoice(inv,c);original:=tw_accounting_post_invoice(inv,c,1,'2026-01-15','121001','411001','231001',50.12345678);
 PERFORM tw_accounting_submit_invoice(egp,c);PERFORM tw_accounting_post_invoice(egp,c,1,'2026-01-15','121001','411001',NULL,1);
 UPDATE tw_accounting_companies SET currencies=ARRAY['EGP','USD'] WHERE id=c;
 SELECT id INTO vendor FROM influencers WHERE document_number IS NOT NULL LIMIT 1;
 IF vendor IS NULL THEN RAISE EXCEPTION 'Dev vendor directory unavailable'; END IF;
 val:=jsonb_build_object('company',c,'kind','receipt','party',customer,'currency','USD','date','2026-02-01','amount','30','cash','111001','control','121001','advance','221001','gain','712001','loss','722001','parent',NULL,'advanceRow',true,'method','bank_transfer','bank','QA Dev Bank','instrumentNumber','TRF-QA-001','maturity','','reference','QA multi allocation','lines',jsonb_build_array(jsonb_build_object('id',inv,'amount','20')));
 quote:=tw_accounting_settlement_quote(val);saved:=val;j:=tw_accounting_settlement_post(rv,val,quote);
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE journal_id=j AND description LIKE 'Invoice QA-INV-%') THEN RAISE EXCEPTION 'JV line lost invoice reference';END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_settlements WHERE journal_id=j AND request->'value'->>'bank'='QA Dev Bank' AND request->'value'->>'instrumentNumber'='TRF-QA-001' AND request->'value'->>'maturity'='') THEN RAISE EXCEPTION 'Bank or transfer details lost';END IF;
 SELECT last_number INTO serial_before FROM tw_accounting_journal_sequences WHERE company_id=c AND fiscal_year=2026;
 SELECT count(*) INTO journal_count_before FROM tw_accounting_journals WHERE company_id=c;
 IF tw_accounting_settlement_post(rv,val,quote)<>j THEN RAISE EXCEPTION 'Voucher retry duplicated'; END IF;
 IF (SELECT last_number FROM tw_accounting_journal_sequences WHERE company_id=c AND fiscal_year=2026)<>serial_before OR (SELECT count(*) FROM tw_accounting_journals WHERE company_id=c)<>journal_count_before THEN RAISE EXCEPTION 'Receipt retry consumed JV serial or duplicated journal';END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_voucher_register WHERE id=rv AND journal_id=j AND voucher_number=(SELECT voucher_number FROM tw_accounting_journals WHERE id=j)) THEN RAISE EXCEPTION 'Receipt register is not linked to its original JV';END IF;
 IF (SELECT amount_paid FROM invoices WHERE id=inv)<>20 OR (SELECT count(*) FROM tw_accounting_journal_lines WHERE journal_id=j)<>4 THEN RAISE EXCEPTION 'Receipt/advance journal incorrect'; END IF;
 IF NOT EXISTS(SELECT 1 FROM payments p JOIN tw_accounting_settlement_payments m ON m.payment_id=p.id WHERE m.settlement_id=rv AND m.is_advance AND p.amount=10 AND p.invoice_id IS NULL) THEN RAISE EXCEPTION 'Advance missing from Media'; END IF;

 val:=saved||jsonb_build_object('kind','receipt_refund','refundOf',rv,'amount','-15','date','2026-02-02','reference','QA partial refund','lines',jsonb_build_array(jsonb_build_object('id',inv,'amount','-10')));
 quote:=tw_accounting_settlement_quote(val);j2:=tw_accounting_settlement_post(req,val,quote);
 IF (SELECT amount_paid FROM invoices WHERE id=inv)<>10 THEN RAISE EXCEPTION 'Partial refund did not reopen invoice';END IF;
 IF (SELECT advance_remaining::numeric FROM tw_accounting_voucher_register WHERE id=rv)<>5 THEN RAISE EXCEPTION 'Partial advance refund incorrect';END IF;
 IF (SELECT amount FROM tw_accounting_settlements WHERE id=rv)<>30 THEN RAISE EXCEPTION 'Original receipt was changed';END IF;
 IF (SELECT sum(debit-credit) FROM tw_accounting_journal_lines WHERE journal_id=j2)<>0 THEN RAISE EXCEPTION 'Refund journal unbalanced';END IF;
 IF tw_accounting_settlement_post(req,val,quote)<>j2 THEN RAISE EXCEPTION 'Refund retry duplicated';END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_settlement_quote(val||jsonb_build_object('amount','-30','lines',jsonb_build_array(jsonb_build_object('id',inv,'amount','-30'))));EXCEPTION WHEN raise_exception THEN blocked:=true;END;IF NOT blocked THEN RAISE EXCEPTION 'Overrefund accepted';END IF;
 PERFORM tw_accounting_settlement_reverse(req,c,'2026-02-03','QA refund reversal');
 IF (SELECT amount_paid FROM invoices WHERE id=inv)<>20 OR (SELECT advance_remaining::numeric FROM tw_accounting_voucher_register WHERE id=rv)<>10 THEN RAISE EXCEPTION 'Refund reversal failed to restore balances';END IF;
 RAISE NOTICE 'PASS: partial invoice/advance refund, original preserved, balanced JV, retry, overrefund, reversal';

 req:=gen_random_uuid();val:=saved||jsonb_build_object('kind','receipt_refund','refundOf',rv,'amount','-30','date','2026-02-02','reference','QA full refund','lines',jsonb_build_array(jsonb_build_object('id',inv,'amount','-20')));
 quote:=tw_accounting_settlement_quote(val);j2:=tw_accounting_settlement_post(req,val,quote);
 IF (SELECT amount_paid FROM invoices WHERE id=inv)<>0 OR (SELECT advance_remaining::numeric FROM tw_accounting_voucher_register WHERE id=rv)<>0 THEN RAISE EXCEPTION 'Full refund failed';END IF;
 IF EXISTS(SELECT 1 FROM payments p JOIN tw_accounting_settlement_payments m ON m.payment_id=p.id WHERE m.settlement_id=rv AND p.status='completed') THEN RAISE EXCEPTION 'Full refund still counted as collection';END IF;
 PERFORM tw_accounting_settlement_reverse(req,c,'2026-02-03','QA full refund reversal');
 IF (SELECT amount_paid FROM invoices WHERE id=inv)<>20 THEN RAISE EXCEPTION 'Full refund reversal failed';END IF;
 val:=jsonb_build_object('id',cost,'company',c,'version',NULL,'vendor',vendor,'date','2026-01-15','due','2026-02-15','currency','USD','net','100','tax','0','expense','722001','payable','211001','vat','111001','description','QA provisional creator cost','reference','QA approved assignment','supplierNumber','','supplierDate','');
 PERFORM tw_accounting_cost_save(val);quote:=tw_accounting_cost_fx(cost,c);j:=tw_accounting_cost_post(cost,c,1,(quote->>'rate')::numeric);
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_cost_invoices WHERE id=cost AND status='internal' AND number LIKE 'IC-%') THEN RAISE EXCEPTION 'Internal cost not posted'; END IF;
 val:=jsonb_build_object('company',c,'kind','payment','party',vendor,'currency','USD','date','2026-02-01','amount','50','cash','111001','control','211001','advance','131001','gain','712001','loss','722001','parent',NULL,'advanceRow',true,'method','bank_transfer','reference','QA vendor allocation','lines',jsonb_build_array(jsonb_build_object('id',cost,'amount','40')));

 quote:=tw_accounting_settlement_quote(val);PERFORM tw_accounting_settlement_post(pv,val,quote);
 req:=gen_random_uuid();val:=val||jsonb_build_object('kind','payment_refund','refundOf',pv,'amount','-25','date','2026-02-02','reference','QA supplier refund','lines',jsonb_build_array(jsonb_build_object('id',cost,'amount','-20')));
 quote:=tw_accounting_settlement_quote(val);j2:=tw_accounting_settlement_post(req,val,quote);
 IF (SELECT advance_remaining::numeric FROM tw_accounting_voucher_register WHERE id=pv)<>5 OR (SELECT sum(debit-credit) FROM tw_accounting_journal_lines WHERE journal_id=j2)<>0 THEN RAISE EXCEPTION 'Supplier refund incorrect';END IF;
 IF (tw_accounting_refund_items(c,pv)->0->>'outstanding')::numeric<>20 THEN RAISE EXCEPTION 'Supplier refundable items incorrect';END IF;
 PERFORM tw_accounting_settlement_reverse(req,c,'2026-02-03','QA supplier refund reversal');
 IF (SELECT advance_remaining::numeric FROM tw_accounting_voucher_register WHERE id=pv)<>10 THEN RAISE EXCEPTION 'Supplier refund reversal failed';END IF;
 RAISE NOTICE 'PASS: full receipt refund and reversal, supplier invoice/advance refund, remaining items, balanced FX';

 req:=gen_random_uuid();val:=saved||jsonb_build_object('kind','receipt_refund','refundOf',rv,'amount','-5','date','2026-02-02','reference','QA controls refund','lines',jsonb_build_array(jsonb_build_object('id',inv,'amount','-5')));
 quote:=tw_accounting_settlement_quote(val);
 blocked:=false;BEGIN PERFORM tw_accounting_settlement_post(req,val,jsonb_set(quote,'{amount}','"-999"'));EXCEPTION WHEN serialization_failure THEN blocked:=true;END;IF NOT blocked THEN RAISE EXCEPTION 'Stale refund quote posted';END IF;
 PERFORM tw_accounting_control_action(c,'lock',(SELECT jsonb_build_array(jsonb_build_object('id',h.id,'version',h.version)) FROM tw_accounting_journals h JOIN tw_accounting_settlements s ON s.journal_id=h.id WHERE s.id=rv),'QA source refund lock');
 blocked:=false;BEGIN PERFORM tw_accounting_settlement_quote(val);EXCEPTION WHEN raise_exception THEN blocked:=SQLERRM LIKE '%locked%';END;IF NOT blocked THEN RAISE EXCEPTION 'Locked original refunded';END IF;
 PERFORM tw_accounting_control_action(c,'unlock',(SELECT jsonb_build_array(jsonb_build_object('id',h.id,'version',h.version)) FROM tw_accounting_journals h JOIN tw_accounting_settlements s ON s.journal_id=h.id WHERE s.id=rv),'QA unlock source refund');
 SELECT p.id INTO period FROM tw_accounting_periods p JOIN tw_accounting_years y ON y.id=p.year_id WHERE y.company_id=c AND '2026-02-02' BETWEEN p.start_date AND p.end_date;
 PERFORM tw_accounting_set_period(c,period,true,'QA close refund fixture',(SELECT version FROM tw_accounting_periods WHERE id=period));
 blocked:=false;BEGIN PERFORM tw_accounting_settlement_post(req,val,quote);EXCEPTION WHEN raise_exception THEN blocked:=SQLERRM LIKE '%open%period%';END;IF NOT blocked THEN RAISE EXCEPTION 'Closed period refund posted';END IF;
 PERFORM tw_accounting_set_period(c,period,false,'QA reopen refund fixture',(SELECT version FROM tw_accounting_periods WHERE id=period));
 PERFORM set_config('request.jwt.claim.sub',viewer::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','aal','aal2')::text,true);
 blocked:=false;BEGIN PERFORM tw_accounting_settlement_post(req,val,quote);EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;IF NOT blocked THEN RAISE EXCEPTION 'Viewer posted refund';END IF;
 RAISE NOTICE 'PASS: refund stale quote, source lock, closed period and viewer posting protections';
END $$;
ROLLBACK;
