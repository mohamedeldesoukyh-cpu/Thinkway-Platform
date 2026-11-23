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
 -- Historical settlement fixture only: automatic posting now uses today's journal date.
 RESET ROLE;
 UPDATE tw_accounting_journals SET entry_date='2026-01-15' WHERE company_id=c AND source_invoice_id IN(inv,egp);
 SET LOCAL ROLE authenticated;
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
 q:=tw_accounting_receipt_quote(inv,c,20,'2026-02-01');IF (q->>'settled')::numeric<>20 THEN RAISE EXCEPTION 'Stage 5 quote ignored new settlements'; END IF;
 val:=val||jsonb_build_object('kind','receipt_apply','parent',rv,'amount','10','date','2026-02-02','advanceRow',false,'lines',jsonb_build_array(jsonb_build_object('id',inv,'amount','10')));
 quote:=tw_accounting_settlement_quote(val);j2:=tw_accounting_settlement_post(av,val,quote);
 IF (SELECT amount_paid FROM invoices WHERE id=inv)<>30 THEN RAISE EXCEPTION 'Advance did not settle invoice'; END IF;
 IF (SELECT sum(p.amount) FROM payments p JOIN tw_accounting_settlement_payments m ON m.payment_id=p.id WHERE m.settlement_id IN(rv,av) AND p.status='completed')<>30 THEN RAISE EXCEPTION 'Advance application recorded cash twice'; END IF;
 IF (SELECT sum(l.debit-l.credit) FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id WHERE l.company_id=c AND l.account_code='221001' AND j.status='posted')<>0 THEN RAISE EXCEPTION 'Advance did not clear'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_settlement_reverse(rv,c,'2026-02-03','Illegal parent reversal');EXCEPTION WHEN raise_exception THEN blocked:=true;END;IF NOT blocked THEN RAISE EXCEPTION 'Allocated advance reversed'; END IF;
 -- Savepoint keeps the existing fixture versions and serial expectations unchanged.
 BEGIN
  PERFORM tw_accounting_control_action(c,'lock',(SELECT jsonb_build_array(jsonb_build_object('id',id,'version',version)) FROM tw_accounting_journals WHERE id=j2),'Lock source correction fixture');
  blocked:=false;BEGIN PERFORM tw_accounting_settlement_reverse(av,c,'2026-02-03','Locked source settlement reversal'); EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%locked%';END;
  IF NOT blocked THEN RAISE EXCEPTION 'Locked source settlement reversed'; END IF;
  RAISE NOTICE 'PASS: source journal lock enforced';
  RAISE EXCEPTION 'Rollback lock scenario only' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 PERFORM tw_accounting_settlement_reverse(av,c,'2026-02-03','Undo application');
 IF NOT EXISTS(SELECT 1 FROM payments p JOIN tw_accounting_settlement_payments m ON m.payment_id=p.id WHERE m.settlement_id=rv AND m.is_advance AND p.status='completed' AND p.amount=10) THEN RAISE EXCEPTION 'Reversal did not restore advance'; END IF;
 PERFORM tw_accounting_settlement_reverse(rv,c,'2026-02-03','Undo receipt');
 IF (SELECT amount_paid FROM invoices WHERE id=inv)<>0 THEN RAISE EXCEPTION 'Receipt reversal did not restore Media'; END IF;
 val:=jsonb_build_object('id',cost,'company',c,'version',NULL,'vendor',vendor,'date','2026-01-15','due','2026-02-15','currency','USD','net','100','tax','0','expense','722001','payable','211001','vat','111001','description','QA provisional creator cost','reference','QA approved assignment','supplierNumber','','supplierDate','');
 PERFORM tw_accounting_cost_save(val);quote:=tw_accounting_cost_fx(cost,c);j:=tw_accounting_cost_post(cost,c,1,(quote->>'rate')::numeric);
 RESET ROLE; UPDATE tw_accounting_journals SET entry_date='2026-01-15' WHERE id=j AND company_id=c; SET LOCAL ROLE authenticated;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_cost_invoices WHERE id=cost AND status='internal' AND number LIKE 'IC-%') THEN RAISE EXCEPTION 'Internal cost not posted'; END IF;
 val:=jsonb_build_object('company',c,'kind','payment','party',vendor,'currency','USD','date','2026-02-01','amount','50','cash','111001','control','211001','advance','131001','gain','712001','loss','722001','parent',NULL,'advanceRow',true,'method','bank_transfer','reference','QA vendor allocation','lines',jsonb_build_array(jsonb_build_object('id',cost,'amount','40')));
 val:=val||jsonb_build_object('method','check','reference','QA-CHEQUE-001');
 SELECT count(*) INTO before_count FROM tw_accounting_journals WHERE company_id=c;
 PERFORM tw_accounting_payment_prepare(c,'save',pv,NULL,val);
 IF (SELECT count(*) FROM tw_accounting_journals WHERE company_id=c)<>before_count OR EXISTS(SELECT 1 FROM tw_accounting_settlements WHERE id=pv) THEN RAISE EXCEPTION 'Saving preparation posted financial records';END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_payment_prepare(c,'save',pv,99,val);EXCEPTION WHEN serialization_failure THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Stale preparation overwritten';END IF;
 quote:=tw_accounting_settlement_quote(val);
 blocked:=false;BEGIN PERFORM tw_accounting_payment_prepare(c,'post',pv,1,val,quote||jsonb_build_object('rate','999'));EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked OR (SELECT version FROM tw_accounting_payment_preparations WHERE id=pv)<>1 THEN RAISE EXCEPTION 'Stale quote changed preparation';END IF;
 PERFORM tw_accounting_payment_prepare(c,'post',pv,1,val,quote);
 SELECT last_number INTO serial_before FROM tw_accounting_journal_sequences WHERE company_id=c AND fiscal_year=2026;
 SELECT count(*) INTO journal_count_before FROM tw_accounting_journals WHERE company_id=c;
 PERFORM tw_accounting_payment_prepare(c,'post',pv,1,val,quote);
 IF (SELECT last_number FROM tw_accounting_journal_sequences WHERE company_id=c AND fiscal_year=2026)<>serial_before OR (SELECT count(*) FROM tw_accounting_journals WHERE company_id=c)<>journal_count_before THEN RAISE EXCEPTION 'Payment retry consumed JV serial or duplicated journal';END IF;
 IF (SELECT status FROM tw_accounting_payment_preparations WHERE id=pv)<>'posted' OR (SELECT count(*) FROM tw_accounting_settlements WHERE id=pv)<>1 THEN RAISE EXCEPTION 'Prepared payment retry duplicated';END IF;
 IF (tw_accounting_cheques(c)->>'count')::integer<>1 THEN RAISE EXCEPTION 'Cheque register missing payment';END IF;
 PERFORM tw_accounting_bank_action(c,'bank-save',jsonb_build_object('id',bank_profile,'name','QA USD bank','account','111001','auxiliary','','currency','USD','reference','QA ONLY','active',true));
 PERFORM tw_accounting_bank_action(c,'import',jsonb_build_object('id',bank_statement,'bank',bank_profile,'reference','QA CHEQUE','from','2026-02-01','to','2026-02-01','opening','0','closing','-50','rows','[{"date":"2026-02-01","reference":"QA-CHEQUE-001","description":"Cheque","amount":"-50"}]'::jsonb));
 SELECT l.line_number INTO bank_line FROM tw_accounting_journal_lines l JOIN tw_accounting_settlements st ON st.journal_id=l.journal_id WHERE st.id=pv AND l.account_code='111001' AND l.credit>0;
 PERFORM tw_accounting_bank_action(c,'match',jsonb_build_object('id',bank_statement,'version',1,'reason','Cheque cleared in bank statement','rows',(SELECT jsonb_agg(id) FROM tw_accounting_bank_rows WHERE statement_id=bank_statement),'lines',jsonb_build_array(jsonb_build_object('journal',(SELECT journal_id FROM tw_accounting_settlements WHERE id=pv),'line',bank_line))));
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(tw_accounting_cheques(c)->'rows') x WHERE x->>'id'=pv::text AND x->>'cleared_date'='2026-02-01') THEN RAISE EXCEPTION 'Cheque clearing status missing';END IF;
 PERFORM tw_accounting_payment_prepare(c,'save',prep_cancel,NULL,val);
 PERFORM tw_accounting_payment_prepare(c,'cancel',prep_cancel,1,NULL,NULL,'Cancel unused preparation');
 IF (SELECT status FROM tw_accounting_payment_preparations WHERE id=prep_cancel)<>'cancelled' THEN RAISE EXCEPTION 'Preparation cancellation failed';END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(tw_accounting_open_items(c,'vendor',vendor,'USD','211001')) x WHERE x->>'id'=cost::text AND (x->>'outstanding')::numeric=60) THEN RAISE EXCEPTION 'Vendor unsettled statement incorrect'; END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(tw_accounting_aging(c,'vendor','USD',NULL)) x WHERE x->>'id'=cost::text AND (x->>'outstanding')::numeric=60 AND x->>'party' IS NOT NULL) THEN RAISE EXCEPTION 'All-vendor aging mismatch';END IF;
 j2:=tw_accounting_cost_reconcile(cost,c,2,'2026-02-02','QA-SUPPLIER-123','2026-01-15',110,0,'111001','QA received supplier invoice');
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_cost_invoices WHERE id=cost AND status='supplier' AND journal_id=j AND net=110) THEN RAISE EXCEPTION 'Supplier reconciliation duplicated original cost'; END IF;
 IF (SELECT count(*) FROM tw_accounting_settlement_lines WHERE cost_id=cost)<>1 THEN RAISE EXCEPTION 'Supplier reconciliation lost allocations'; END IF;
 q:=tw_accounting_statement_filtered(c,'2026-02-01','2026-12-31','211001','vendor',vendor,NULL,0);
 IF jsonb_array_length(q->'accounts')<>1 OR jsonb_array_length(q->'rows')<>3 THEN RAISE EXCEPTION 'Vendor statement missing payment, original-payable reversal or actual supplier payable'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_reverse_journal(j,c,gen_random_uuid(),'2026-02-03','Illegal generic reversal');EXCEPTION WHEN raise_exception THEN blocked:=true;END;IF NOT blocked THEN RAISE EXCEPTION 'Automatic cost journal manually reversed'; END IF;
 PERFORM tw_accounting_settlement_reverse(pv,c,'2026-02-03','QA vendor reversal');
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(tw_accounting_open_items(c,'vendor',vendor,'USD','211001')) x WHERE x->>'id'=cost::text AND (x->>'outstanding')::numeric=110) THEN RAISE EXCEPTION 'Vendor payment reversal did not restore open item'; END IF;
 RESET ROLE;
 SET CONSTRAINTS ALL IMMEDIATE;

 -- Mixed-currency Expenses entry: foreign amount and exact local equivalent.
 j:=gen_random_uuid();
 val:='[{"account":"722001","parentAccount":"500000","lineCurrency":"USD","lineRate":"50.12345678","foreignDebit":"10","foreignCredit":"0","debit":"501.23","credit":"0","description":"Foreign expense"},{"account":"111001","lineCurrency":"EGP","foreignDebit":"0","foreignCredit":"501.23","debit":"0","credit":"501.23","description":"Cash counter"}]';
 PERFORM tw_accounting_save_entry(j,c,'2026-01-15','QA','Mixed currency expense',NULL,'expense',val);
 PERFORM tw_accounting_post_journal(j,c,1);
 IF (SELECT transaction_currency FROM tw_accounting_journals WHERE id=j) IS NOT NULL THEN RAISE EXCEPTION 'Mixed currency header invented a single currency'; END IF;
 q:=tw_accounting_statement(c,'2026-01-15','2026-01-15','722001','all',NULL,'USD',0);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'rows') x WHERE x->>'id'=j::text AND (x->>'foreign_debit')::numeric=10 AND (x->>'debit')::numeric=501.23) THEN RAISE EXCEPTION 'Statement lost line currency'; END IF;
 j2:=tw_accounting_reverse_journal(j,c,gen_random_uuid(),'2026-02-01','Reverse expense test');
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE journal_id=j2 AND account_code='722001' AND line_currency='USD' AND line_rate=50.12345678 AND foreign_credit=10 AND credit=501.23 AND parent_account='500000') THEN RAISE EXCEPTION 'Reversal lost currency or auxiliary'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_save_entry(gen_random_uuid(),c,'2026-01-15','QA','Wrong local amount',NULL,'expense',jsonb_set(val,'{0,debit}','"501.24"'));EXCEPTION WHEN OTHERS THEN blocked:=true;END;IF NOT blocked THEN RAISE EXCEPTION 'Incorrect local amount accepted'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_save_entry(gen_random_uuid(),c,'2026-01-15','QA','Stale exchange rate',NULL,'expense',jsonb_set(val,'{0,lineRate}','"50"'));EXCEPTION WHEN serialization_failure THEN blocked:=true;END;IF NOT blocked THEN RAISE EXCEPTION 'Stale exchange rate accepted'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_save_entry(gen_random_uuid(),c,'2026-01-15','QA','Wrong auxiliary',NULL,'expense',jsonb_set(val,'{0,parentAccount}','"100000"'));EXCEPTION WHEN OTHERS THEN blocked:=true;END;IF NOT blocked THEN RAISE EXCEPTION 'Wrong auxiliary accepted'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_save_entry(gen_random_uuid(),c,'2026-01-15','QA','Wrong expense account',NULL,'expense',jsonb_set(val,'{0,account}','"111001"'));EXCEPTION WHEN OTHERS THEN blocked:=true;END;IF NOT blocked THEN RAISE EXCEPTION 'Non-expense debit accepted'; END IF;
 -- A second vendor payment applies its advance without additional cash.
 pv:=gen_random_uuid();av:=gen_random_uuid();
 val:=jsonb_build_object('company',c,'kind','payment','party',vendor,'currency','USD','date','2026-02-01','amount','50','cash','111001','control','211001','advance','131001','gain','712001','loss','722001','parent',NULL,'advanceRow',true,'method','bank_transfer','reference','QA vendor advance','lines',jsonb_build_array(jsonb_build_object('id',cost,'amount','40')));
 quote:=tw_accounting_settlement_quote(val);PERFORM tw_accounting_settlement_post(pv,val,quote);
 val:=val||jsonb_build_object('kind','payment_apply','parent',pv,'amount','10','date','2026-02-02','advanceRow',false,'lines',jsonb_build_array(jsonb_build_object('id',cost,'amount','10')));
 quote:=tw_accounting_settlement_quote(val);j:=tw_accounting_settlement_post(av,val,quote);
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE journal_id=j AND account_code='111001') THEN RAISE EXCEPTION 'Vendor advance application moved cash'; END IF;
 PERFORM tw_accounting_settlement_reverse(av,c,'2026-02-03','Undo vendor advance application');
 PERFORM tw_accounting_settlement_reverse(pv,c,'2026-02-03','Undo vendor advance receipt');
 -- Financial-only staff can read counterparties but read access cannot post.
 INSERT INTO tw_module_assignments(profile_id,media,accounting_role) VALUES(viewer,false,'read') ON CONFLICT(profile_id) DO UPDATE SET media=false,accounting_role='read';
 PERFORM set_config('request.jwt.claim.sub',viewer::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','aal','aal2')::text,true);
 PERFORM tw_accounting_parties('client','QA-RECEIPT');
 blocked:=false;BEGIN PERFORM tw_accounting_settlement_post(gen_random_uuid(),val,quote);EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;IF NOT blocked THEN RAISE EXCEPTION 'Read-only allocation posted'; END IF;
 RAISE NOTICE 'PASS: mixed-currency Expenses, local amount enforcement, F2 auxiliary scope, stale FX rejection, reversal currency preservation and vendor advance allocation';
 RAISE NOTICE 'PASS: receipt allocations, advances, advance applications/reversals, internal costs, vendor payments, supplier reconciliation and statements';
END $$;
ROLLBACK;
