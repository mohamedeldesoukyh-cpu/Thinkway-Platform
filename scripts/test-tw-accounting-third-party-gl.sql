-- Development only: all fixtures, shared-directory changes and numbering roll back.
BEGIN;
DO $$
DECLARE actor uuid; customer uuid:=gen_random_uuid(); vendor uuid; inv uuid:=gen_random_uuid();
 c uuid; cost uuid:=gen_random_uuid(); val jsonb; quote jsonb; report jsonb; j uuid;
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='super_admin' AND p.is_active LIMIT 1;
 SELECT ci.influencer_id INTO vendor FROM campaign_influencers ci JOIN campaign_lines l ON l.id=ci.campaign_line_id WHERE l.status<>'cancelled' LIMIT 1;
 IF actor IS NULL OR vendor IS NULL THEN RAISE EXCEPTION 'Development fixtures unavailable'; END IF;
 INSERT INTO clients(id,document_number,name,currency) VALUES(customer,'QA-THIRD-PARTY-'||customer,'QA Third Party multi GL rollback','EGP');
 INSERT INTO invoices(id,document_number,client_id,issue_date,currency,subtotal,tax_amount,total,revenue_before_vat,revenue_vat_amount,revenue_after_vat,amounts_finalized_at)
 VALUES(inv,'QA-THIRD-PARTY-INV-'||inv,customer,'2026-01-15','EGP',100,0,100,100,0,100,now());
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 SET LOCAL ROLE authenticated;
 c:=tw_accounting_create_company('QA Third Party multi GL rollback','EG','EGP','2026-01-01','[
 {"code":"100000","name":"Assets","parent":null,"type":"Asset","normal":"Debit","kind":"Group"},
 {"code":"111001","name":"Cash and bank","parent":"100000","type":"Asset","normal":"Debit","kind":"Posting"},
 {"code":"121001","name":"Receivables","parent":"100000","type":"Asset","normal":"Debit","kind":"Control","subledger":"Customer"},
 {"code":"131001","name":"Vendor advances","parent":"100000","type":"Asset","normal":"Debit","kind":"Control","subledger":"Supplier / creator"},
 {"code":"200000","name":"Liabilities","parent":null,"type":"Liability","normal":"Credit","kind":"Group"},
 {"code":"211001","name":"Payables","parent":"200000","type":"Liability","normal":"Credit","kind":"Control","subledger":"Supplier / creator"},
 {"code":"221001","name":"Customer advances","parent":"200000","type":"Liability","normal":"Credit","kind":"Control","subledger":"Customer"},
 {"code":"400000","name":"Revenue","parent":null,"type":"Revenue","normal":"Credit","kind":"Group"},
 {"code":"411001","name":"Campaign revenue","parent":"400000","type":"Revenue","normal":"Credit","kind":"Posting"},
 {"code":"712001","name":"Realized gain","parent":"400000","type":"Revenue","normal":"Credit","kind":"Posting"},
 {"code":"500000","name":"Expenses","parent":null,"type":"Expense","normal":"Debit","kind":"Group"},
 {"code":"722001","name":"Realized loss","parent":"500000","type":"Expense","normal":"Debit","kind":"Posting"}]');
 UPDATE tw_accounting_accounts SET client_id=customer WHERE company_id=c AND code IN('121001','221001');
 UPDATE tw_accounting_accounts SET vendor_id=vendor WHERE company_id=c AND code IN('211001','131001');
 IF (SELECT count(*) FROM tw_accounting_accounts WHERE company_id=c AND client_id=customer AND NOT has_auxiliary)<>2
 OR (SELECT count(*) FROM tw_accounting_accounts WHERE company_id=c AND vendor_id=vendor AND NOT has_auxiliary)<>2 THEN RAISE EXCEPTION 'Third Party cannot link to multiple GL accounts independently of auxiliaries'; END IF;
 PERFORM tw_accounting_submit_invoice(inv,c);
 quote:=tw_accounting_invoice_mapping_preview(inv,c,'121001','411001',NULL);
 PERFORM tw_accounting_post_mapped_invoice(inv,c,1,'2026-01-15','121001','411001',NULL,1,quote,'{}');
 val:=jsonb_build_object('company',c,'kind','receipt','party',customer,'currency','EGP','date','2026-02-01','amount','30','cash','111001','control','121001','advance','221001','gain','712001','loss','722001','parent',NULL,'advanceRow',true,'method','bank_transfer','reference','QA Third Party receipt','lines',jsonb_build_array(jsonb_build_object('id',inv,'amount','20')));
 quote:=tw_accounting_settlement_quote(val);j:=tw_accounting_settlement_post(gen_random_uuid(),val,quote);
 IF (SELECT count(DISTINCT account_code) FROM tw_accounting_journal_lines WHERE journal_id=j AND client_id=customer)<>2 THEN RAISE EXCEPTION 'Receipt did not preserve one Third Party identity across receivables and advances'; END IF;
 report:=tw_accounting_statement(c,'2026-02-01','2026-12-31',NULL,'client',customer,NULL,0);
 IF jsonb_array_length(report->'accounts')<>2
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(report->'accounts')a WHERE a->>'account'='121001' AND (a->>'opening')::numeric=100 AND (a->>'closing')::numeric=80)
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(report->'accounts')a WHERE a->>'account'='221001' AND (a->>'closing')::numeric=-10)
 OR (SELECT sum((a->>'closing')::numeric) FROM jsonb_array_elements(report->'accounts')a)<>70 THEN RAISE EXCEPTION 'Client independent or consolidated balance incorrect'; END IF;
 report:=tw_accounting_statement(c,'2026-01-01','2026-12-31','221001','client',customer,NULL,0);
 IF jsonb_array_length(report->'accounts')<>1 OR (report->'accounts'->0->>'closing')::numeric<>-10 THEN RAISE EXCEPTION 'Individual client advance statement incorrect'; END IF;
 val:=jsonb_build_object('id',cost,'company',c,'version',NULL,'vendor',vendor,'date','2026-01-15','due','2026-02-15','currency','EGP','net','100','tax','0','expense','722001','payable','211001','vat','111001','description','QA Third Party cost','reference','QA Third Party cost','supplierNumber','','supplierDate','');
 PERFORM tw_accounting_cost_save(val);PERFORM tw_accounting_cost_post(cost,c,1,1);
 val:=jsonb_build_object('company',c,'kind','payment','party',vendor,'currency','EGP','date','2026-02-01','amount','50','cash','111001','control','211001','advance','131001','gain','712001','loss','722001','parent',NULL,'advanceRow',true,'method','bank_transfer','reference','QA Third Party payment','lines',jsonb_build_array(jsonb_build_object('id',cost,'amount','40')));
 quote:=tw_accounting_settlement_quote(val);j:=tw_accounting_settlement_post(gen_random_uuid(),val,quote);
 IF (SELECT count(DISTINCT account_code) FROM tw_accounting_journal_lines WHERE journal_id=j AND vendor_id=vendor)<>2 THEN RAISE EXCEPTION 'Payment did not preserve one Third Party identity across payables and advances'; END IF;
 report:=tw_accounting_statement(c,'2026-02-01','2026-12-31',NULL,'vendor',vendor,NULL,0);
 IF jsonb_array_length(report->'accounts')<>2
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(report->'accounts')a WHERE a->>'account'='211001' AND (a->>'opening')::numeric=-100 AND (a->>'closing')::numeric=-60)
 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(report->'accounts')a WHERE a->>'account'='131001' AND (a->>'closing')::numeric=10)
 OR (SELECT sum((a->>'closing')::numeric) FROM jsonb_array_elements(report->'accounts')a)<>-50 THEN RAISE EXCEPTION 'Vendor independent or consolidated balance incorrect'; END IF;
 report:=tw_accounting_statement(c,'2026-03-01','2026-12-31',NULL,'client',customer,NULL,0);
 IF (report->>'count')::integer<>0 OR (SELECT sum((a->>'opening')::numeric) FROM jsonb_array_elements(report->'accounts')a)<>70 THEN RAISE EXCEPTION 'Third Party opening balance lost in a period with no activity'; END IF;
 IF EXISTS(SELECT journal_id FROM tw_accounting_journal_lines WHERE company_id=c GROUP BY journal_id HAVING sum(debit-credit)<>0)
 OR EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE company_id=c AND auxiliary_id IS NOT NULL) THEN RAISE EXCEPTION 'Third Party posting lost double-entry integrity or used auxiliaries'; END IF;
 RAISE NOTICE 'PASS: one Third Party on multiple GLs, separate AR/advance and AP/advance balances, consolidated statements, opening balances and balanced posting without auxiliaries';
END $$;
ROLLBACK;
