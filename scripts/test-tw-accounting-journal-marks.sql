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

 val:=jsonb_build_object('id',req,'company',c,'workflow','general','kind','manual','date','2026-02-01','reference','SIGNED-QA','memo','QA signed entry rollback','version',NULL,'lines',jsonb_build_array(
 jsonb_build_object('account','111001','description','Negative debit','debit','0','credit','100','foreignDebit','0','foreignCredit','100','lineCurrency','EGP','lineRate','1','enteredAmount','-100','enteredSide','D'),
 jsonb_build_object('account','722001','description','Balancing debit','debit','100','credit','0','foreignDebit','100','foreignCredit','0','lineCurrency','EGP','lineRate','1')));
 j:=tw_accounting_save_signed_workflow(val);
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE journal_id=j AND entered_amount=-100 AND entered_side='D' AND debit=0 AND credit=100) THEN RAISE EXCEPTION 'Signed presentation not retained';END IF;
 PERFORM tw_accounting_post_journal(j,c,1);
 IF (SELECT sum(debit-credit) FROM tw_accounting_journal_lines WHERE journal_id=j)<>0 THEN RAISE EXCEPTION 'Signed journal unbalanced';END IF;

 SELECT last_number INTO serial_before FROM tw_accounting_journal_sequences WHERE company_id=c AND fiscal_year=2026;
 PERFORM tw_accounting_journal_mark(c,j,(SELECT version FROM tw_accounting_journals WHERE id=j),'pending','QA pending mark');
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journals WHERE id=j AND status='pending' AND voucher_number='JV-2026-000001' AND resume_status='posted') THEN RAISE EXCEPTION 'Pending lost number';END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_lines l JOIN tw_accounting_journals h ON h.id=l.journal_id WHERE h.company_id=c AND h.status='posted') THEN RAISE EXCEPTION 'Pending still posted';END IF;
 PERFORM tw_accounting_journal_mark(c,j,(SELECT version FROM tw_accounting_journals WHERE id=j),'clear','QA restore pending');
 PERFORM tw_accounting_journal_mark(c,j,(SELECT version FROM tw_accounting_journals WHERE id=j),'cancelled','QA cancel mark');
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journals WHERE id=j AND status='cancelled' AND voucher_number='JV-2026-000001') THEN RAISE EXCEPTION 'Cancelled lost number';END IF;
 PERFORM tw_accounting_journal_mark(c,j,(SELECT version FROM tw_accounting_journals WHERE id=j),'clear','QA restore cancelled');
 IF (SELECT last_number FROM tw_accounting_journal_sequences WHERE company_id=c AND fiscal_year=2026)<>serial_before THEN RAISE EXCEPTION 'Status toggles consumed a number';END IF;
 val:=jsonb_set(val,'{id}',to_jsonb(gen_random_uuid()::text));j2:=tw_accounting_save_signed_workflow(val);PERFORM tw_accounting_post_journal(j2,c,1);
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journals WHERE id=j2 AND voucher_number='JV-2026-000002') THEN RAISE EXCEPTION 'Next journal did not take next serial';END IF;

 PERFORM tw_accounting_journal_mark(c,j,(SELECT version FROM tw_accounting_journals WHERE id=j),'pending','QA approval restore');
 UPDATE tw_accounting_companies SET journal_approval_required=true WHERE id=c;
 blocked:=false;BEGIN PERFORM tw_accounting_journal_mark(c,j,(SELECT version FROM tw_accounting_journals WHERE id=j),'clear','QA approval bypass');EXCEPTION WHEN raise_exception THEN blocked:=SQLERRM LIKE '%approval%';END;IF NOT blocked THEN RAISE EXCEPTION 'Restoration bypassed approval';END IF;
 UPDATE tw_accounting_companies SET journal_approval_required=false WHERE id=c;
 PERFORM tw_accounting_journal_mark(c,j,(SELECT version FROM tw_accounting_journals WHERE id=j),'clear','QA approved policy restore');
 SELECT p.id INTO period FROM tw_accounting_periods p JOIN tw_accounting_years y ON y.id=p.year_id WHERE y.company_id=c AND '2026-02-01' BETWEEN p.start_date AND p.end_date;
 PERFORM tw_accounting_set_period(c,period,true,'QA close fixture',(SELECT version FROM tw_accounting_periods WHERE id=period));
 blocked:=false;BEGIN PERFORM tw_accounting_journal_mark(c,j,(SELECT version FROM tw_accounting_journals WHERE id=j),'pending','QA closed period');EXCEPTION WHEN raise_exception THEN blocked:=SQLERRM LIKE '%open financial period%';END;IF NOT blocked THEN RAISE EXCEPTION 'Closed period changed';END IF;
 PERFORM tw_accounting_set_period(c,period,false,'QA reopen fixture',(SELECT version FROM tw_accounting_periods WHERE id=period));
 blocked:=false;BEGIN PERFORM tw_accounting_journal_mark(c,j,1,'pending','QA stale version');EXCEPTION WHEN serialization_failure THEN blocked:=true;END;IF NOT blocked THEN RAISE EXCEPTION 'Stale mark accepted';END IF;
 PERFORM set_config('request.jwt.claim.sub',viewer::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','aal','aal2')::text,true);
 blocked:=false;BEGIN PERFORM tw_accounting_journal_mark(c,j,1,'pending','QA viewer');EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;IF NOT blocked THEN RAISE EXCEPTION 'Viewer changed status';END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 PERFORM tw_accounting_control_action(c,'lock',(SELECT jsonb_build_array(jsonb_build_object('id',id,'version',version)) FROM tw_accounting_journals WHERE id=j),'QA locked mark');
 blocked:=false;BEGIN PERFORM tw_accounting_journal_mark(c,j,(SELECT version FROM tw_accounting_journals WHERE id=j),'pending','QA blocked');EXCEPTION WHEN raise_exception THEN blocked:=SQLERRM LIKE '%locked%';END;IF NOT blocked THEN RAISE EXCEPTION 'Locked journal marked';END IF;
 IF (SELECT count(*) FROM tw_accounting_audit WHERE operation LIKE 'CONTROL_MARK_%' AND after_data->>'id'=j::text)<>6 THEN RAISE EXCEPTION 'Mark audit incomplete';END IF;
 RAISE NOTICE 'PASS: pending/cancel/restore preserve serial, balances excluded, next serial contiguous, lock and audit';
END $$;
ROLLBACK;
