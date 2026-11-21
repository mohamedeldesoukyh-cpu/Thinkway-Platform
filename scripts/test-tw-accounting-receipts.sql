-- Development only. All data, source numbers and journal counters roll back.
BEGIN;
DO $$
DECLARE actor uuid; viewer uuid; customer uuid:=gen_random_uuid(); inv uuid:=gen_random_uuid(); egp uuid:=gen_random_uuid(); c uuid; j uuid; j2 uuid; original uuid; p uuid; rev uuid; req uuid:=gen_random_uuid(); q jsonb; blocked boolean; period uuid;
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
 {"code":"111001","name":"Cash and bank","parent":"100000","type":"Asset","normal":"Debit","kind":"Posting"},
 {"code":"121001","name":"Customers","parent":"100000","type":"Asset","normal":"Debit","kind":"Control","subledger":"Customer"},
 {"code":"200000","name":"Liabilities","parent":null,"type":"Liability","normal":"Credit","kind":"Group"},
 {"code":"231001","name":"Output VAT","parent":"200000","type":"Liability","normal":"Credit","kind":"Posting"},
 {"code":"400000","name":"Revenue","parent":null,"type":"Revenue","normal":"Credit","kind":"Group"},
 {"code":"411001","name":"Campaign revenue","parent":"400000","type":"Revenue","normal":"Credit","kind":"Posting"},
 {"code":"712001","name":"Realized gain","parent":"400000","type":"Revenue","normal":"Credit","kind":"Posting"},
 {"code":"500000","name":"Expenses","parent":null,"type":"Expense","normal":"Debit","kind":"Group"},
 {"code":"722001","name":"Realized loss","parent":"500000","type":"Expense","normal":"Debit","kind":"Posting"}]');
 PERFORM tw_accounting_submit_invoice(inv,c);original:=tw_accounting_post_invoice(inv,c,1,'2026-01-15','121001','411001','231001',50.12345678);
 PERFORM tw_accounting_submit_invoice(egp,c);PERFORM tw_accounting_post_invoice(egp,c,1,'2026-01-15','121001','411001',NULL,1);
 q:=tw_accounting_receipt_quote(inv,c,20,'2026-02-01');
 IF (q->>'cash')::numeric<>1020 OR (q->>'receivable')::numeric<>1002.47 THEN RAISE EXCEPTION 'Incorrect partial quote %',q; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_record_receipt(req,inv,c,20,'2026-02-01','bank_transfer','','','2026-02-01','111001','712001','722001',q||'{"rate":"1"}');EXCEPTION WHEN serialization_failure THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Stale rate accepted'; END IF;
 IF EXISTS(SELECT 1 FROM payments WHERE receipt_request_id=req) THEN RAISE EXCEPTION 'Failed posting left a payment'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_record_receipt(req,inv,c,20,'2026-02-01','bank_transfer','','','2026-02-01','121001','712001','722001',q);EXCEPTION WHEN raise_exception THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Customer control accepted as cash'; END IF;
 SELECT p1.id INTO period FROM tw_accounting_periods p1 JOIN tw_accounting_years y ON y.id=p1.year_id WHERE y.company_id=c AND p1.period_number=2;
 PERFORM tw_accounting_set_period(c,period,true,'QA close',1);
 blocked:=false;BEGIN PERFORM tw_accounting_record_receipt(req,inv,c,20,'2026-02-01','bank_transfer','','','2026-02-01','111001','712001','722001',q);EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Closed receipt period accepted'; END IF;
 PERFORM tw_accounting_set_period(c,period,false,'QA reopen',2);
 j:=tw_accounting_record_receipt(req,inv,c,20,'2026-02-01','bank_transfer','','','2026-02-01','111001','712001','722001',q);
 IF tw_accounting_record_receipt(req,inv,c,20,'2026-02-01','bank_transfer','','','2026-02-01','111001','712001','722001',q)<>j THEN RAISE EXCEPTION 'Retry duplicated receipt'; END IF;
 SELECT id INTO p FROM payments WHERE receipt_request_id=req;
 IF (SELECT amount_paid FROM invoices WHERE id=inv)<>20 OR (SELECT status FROM invoices WHERE id=inv)<>'partial' THEN RAISE EXCEPTION 'Media partial balance not synchronized'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE journal_id=j AND account_code='712001' AND credit=17.53 AND foreign_credit IS NULL) THEN RAISE EXCEPTION 'Realized gain missing'; END IF;
 blocked:=false;BEGIN PERFORM revise_collection_payment(p,0,10,'2026-02-01','bank_transfer','','','QA illegal');EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Posted source edited'; END IF;
 blocked:=false;BEGIN DELETE FROM payment_allocations WHERE payment_id=p;EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Posted allocation deleted'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_reverse_journal(j,c,gen_random_uuid(),'2026-02-01','QA illegal');EXCEPTION WHEN raise_exception THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Generic reversal accepted receipt'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_unpost_invoice(inv,c,2,'QA illegal');EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Paid invoice unposted'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_reverse_journal(original,c,gen_random_uuid(),'2026-02-01','QA illegal paid invoice reversal');EXCEPTION WHEN raise_exception THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Paid invoice reversed'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_record_receipt(gen_random_uuid(),inv,c,20,'2026-02-01','bank_transfer','','','2026-02-01','111001','712001','722001',q);EXCEPTION WHEN serialization_failure THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Stale receivable preview accepted'; END IF;
 -- Final receipt uses a lower rate and clears the full recorded EGP receivable.
 q:=tw_accounting_receipt_quote(inv,c,94.06,'2026-02-02');
 j2:=tw_accounting_record_receipt(gen_random_uuid(),inv,c,94.06,'2026-02-02','bank_transfer','','','2026-02-02','111001','712001','722001',q);
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE journal_id=j2 AND account_code='722001' AND debit>0 AND foreign_debit IS NULL) THEN RAISE EXCEPTION 'Realized loss missing'; END IF;
 IF (SELECT sum(debit-credit) FROM tw_accounting_journal_lines WHERE journal_id IN(original,j,j2) AND account_code='121001')<>0 THEN RAISE EXCEPTION 'Final receipt left AR rounding residual'; END IF;
 IF (SELECT status FROM invoices WHERE id=inv)<>'paid' THEN RAISE EXCEPTION 'Media full balance not synchronized'; END IF;
 blocked:=false;BEGIN INSERT INTO payments(invoice_id,client_id,amount,currency,status,paid_at) VALUES(inv,customer,1,'USD','completed',now());EXCEPTION WHEN serialization_failure THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Media overpayment accepted'; END IF;
 rev:=tw_accounting_reverse_receipt(p,c,'2026-02-03','QA incorrect receipt');
 IF tw_accounting_reverse_receipt(p,c,'2026-02-03','Retry')<>rev THEN RAISE EXCEPTION 'Duplicate reversal'; END IF;
 IF (SELECT sum(debit-credit) FROM tw_accounting_journal_lines WHERE journal_id IN(j,rev))<>0 OR (SELECT amount_paid FROM invoices WHERE id=inv)<>94.06 THEN RAISE EXCEPTION 'Reversal did not synchronize'; END IF;
 blocked:=false;BEGIN UPDATE payments SET status='completed' WHERE id=p;EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Reversed payment restored'; END IF;
 -- Existing Media receipt is posted once, without creating another payment.
 INSERT INTO payments(invoice_id,client_id,amount,currency,status,paid_at,recorded_by) VALUES(egp,customer,40,'EGP','completed','2026-02-01',actor) RETURNING id INTO p;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(tw_accounting_receipts_list(c)->'rows') x WHERE x->>'id'=p::text AND x->>'status'='unposted') THEN RAISE EXCEPTION 'Media receipt not queued'; END IF;
 q:=tw_accounting_receipt_quote(egp,c,40,'2026-02-01');
 j:=tw_accounting_post_receipt(p,c,0,'2026-02-01','111001','712001','722001',q);
 IF tw_accounting_post_receipt(p,c,0,'2026-02-01','111001','712001','722001',q)<>j OR (SELECT amount_paid FROM invoices WHERE id=egp)<>40 THEN RAISE EXCEPTION 'Existing Media receipt duplicated'; END IF;
 -- Advance allocations must not be recognized again as cash receipts.
 DECLARE advance_payment uuid; BEGIN
 INSERT INTO payments(invoice_id,client_id,amount,currency,status,paid_at,recorded_by,metadata) VALUES(egp,customer,10,'EGP','completed','2026-02-01',actor,'{"original_advance_amount":10}') RETURNING id INTO advance_payment;
 blocked:=false;BEGIN PERFORM tw_accounting_post_receipt(advance_payment,c,0,'2026-02-01','111001','712001','722001',tw_accounting_receipt_quote(egp,c,10,'2026-02-01'));EXCEPTION WHEN raise_exception THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Advance recognized as a new cash receipt'; END IF;
 UPDATE payments SET status='cancelled' WHERE id=advance_payment;
 END;
 -- Accounting-only staff can collect; read-only staff and unverified sessions cannot.
 RESET ROLE;
 INSERT INTO tw_module_assignments(profile_id,media,accounting_role) VALUES(viewer,false,'manage') ON CONFLICT(profile_id) DO UPDATE SET media=false,accounting_role='manage';
 PERFORM set_config('request.jwt.claim.sub',viewer::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','aal','aal2')::text,true);
 SET LOCAL ROLE authenticated;
 q:=tw_accounting_receipt_quote(egp,c,60,'2026-02-01');
 PERFORM tw_accounting_record_receipt(gen_random_uuid(),egp,c,60,'2026-02-01','bank_transfer','','','2026-02-01','111001','712001','722001',q);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','aal','aal1')::text,true);
 blocked:=false;BEGIN PERFORM tw_accounting_reverse_receipt(p,c,'2026-02-03','No MFA');EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'MFA bypassed'; END IF;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 UPDATE tw_module_assignments SET accounting_role='read' WHERE profile_id=viewer;
 PERFORM set_config('request.jwt.claim.sub',viewer::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','aal','aal2')::text,true);
 SET LOCAL ROLE authenticated;
 blocked:=false;BEGIN PERFORM tw_accounting_reverse_receipt(p,c,'2026-02-03','Read only');EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Read-only staff reversed receipt'; END IF;
 RESET ROLE;
 SET CONSTRAINTS ALL IMMEDIATE;
 RAISE NOTICE 'PASS: receipts, FX gain/loss, rounding, Media sync, reversal, duplicate requests, period locks and module permissions';
END $$;
ROLLBACK;
