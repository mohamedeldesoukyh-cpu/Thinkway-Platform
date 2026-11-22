-- Development only: every fixture, journal and accounting counter rolls back.
BEGIN;
DO $$
DECLARE actor uuid; viewer uuid; customer uuid:=gen_random_uuid(); inv uuid:=gen_random_uuid(); bad uuid:=gen_random_uuid(); zero_vat uuid:=gen_random_uuid(); c uuid; j uuid; rev uuid; p uuid; blocked boolean; result jsonb; n integer;
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='super_admin' AND p.is_active LIMIT 1;
 SELECT p.id INTO viewer FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='viewer' AND p.is_active AND NOT EXISTS(SELECT 1 FROM client_users WHERE profile_id=p.id) AND NOT EXISTS(SELECT 1 FROM influencers WHERE profile_id=p.id) LIMIT 1;
 IF actor IS NULL OR viewer IS NULL THEN RAISE EXCEPTION 'Development actors missing'; END IF;
 INSERT INTO clients(id,document_number,name,currency) VALUES(customer,'QA-AC-STAGE4-'||customer,'QA accounting invoice rollback '||customer,'EGP');
 INSERT INTO invoices(id,document_number,client_id,issue_date,currency,subtotal,tax_amount,total,revenue_before_vat,revenue_vat_amount,revenue_after_vat,amounts_finalized_at)
 VALUES(inv,'QA-INV-'||inv,customer,'2026-01-15','EGP',100.05,14.01,114.06,100.05,14.01,114.06,now()),
 (bad,'QA-INV-'||bad,customer,'2026-01-15','XXX',100,0,100,100,0,100,now()),
 (zero_vat,'QA-INV-'||zero_vat,customer,'2026-01-15','EGP',100,0,100,100,0,100,now());
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 SET LOCAL ROLE authenticated;
 c:=tw_accounting_create_company('QA rollback invoice posting','EG','EGP','2026-01-01','[
 {"code":"100000","name":"Assets","parent":null,"type":"Asset","normal":"Debit","kind":"Group"},
 {"code":"121001","name":"Customers","parent":"100000","type":"Asset","normal":"Debit","kind":"Control","subledger":"Customer"},
 {"code":"200000","name":"Liabilities","parent":null,"type":"Liability","normal":"Credit","kind":"Group"},
 {"code":"231001","name":"Output VAT","parent":"200000","type":"Liability","normal":"Credit","kind":"Posting"},
 {"code":"400000","name":"Revenue","parent":null,"type":"Revenue","normal":"Credit","kind":"Group"},
 {"code":"411001","name":"Campaign revenue","parent":"400000","type":"Revenue","normal":"Credit","kind":"Posting"}]');
 blocked:=false;BEGIN PERFORM tw_accounting_submit_invoice(bad,c);EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Missing FX accepted'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal1')::text,true);
 blocked:=false;BEGIN PERFORM tw_accounting_submit_invoice(inv,c);EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Submission without MFA accepted'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 PERFORM tw_accounting_submit_invoice(inv,c);PERFORM tw_accounting_submit_invoice(inv,c);
 IF (SELECT version FROM tw_accounting_invoice_submissions WHERE invoice_id=inv)<>1 THEN RAISE EXCEPTION 'Submission retry was not idempotent'; END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_sequences WHERE company_id=c) THEN RAISE EXCEPTION 'Submission allocated voucher'; END IF;
 blocked:=false;BEGIN UPDATE tw_accounting_invoice_submissions SET status='withdrawn' WHERE invoice_id=inv;EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Direct submission write allowed'; END IF;
 blocked:=false;BEGIN UPDATE invoices SET status='void' WHERE id=inv;EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Submitted invoice cancelled'; END IF;
 PERFORM tw_accounting_withdraw_invoice(inv,1);
 PERFORM tw_accounting_submit_invoice(inv,c);
 IF (SELECT version FROM tw_accounting_invoice_submissions WHERE invoice_id=inv)<>3 THEN RAISE EXCEPTION 'Resubmission version incorrect'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_post_invoice(inv,c,1,'2026-01-15','121001','411001','231001');EXCEPTION WHEN serialization_failure THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Stale submission posted'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_post_invoice(inv,c,3,'2026-01-15','100000','411001','231001');EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Summary account accepted'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_post_invoice(inv,c,3,'2026-01-15','121001','231001','231001');EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Liability accepted as revenue'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_post_invoice(inv,c,3,'2026-01-14','121001','411001','231001');EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Posting before invoice date accepted'; END IF;
 UPDATE tw_accounting_accounts SET active=false WHERE company_id=c AND code='411001';
 blocked:=false;BEGIN PERFORM tw_accounting_post_invoice(inv,c,3,'2026-01-15','121001','411001','231001');EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Inactive revenue account accepted'; END IF;
 UPDATE tw_accounting_accounts SET active=true WHERE company_id=c AND code='411001';
 SELECT p1.id INTO p FROM tw_accounting_periods p1 JOIN tw_accounting_years y ON y.id=p1.year_id WHERE y.company_id=c AND p1.period_number=1;
 PERFORM tw_accounting_set_period(c,p,true,'QA close',1);
 blocked:=false;BEGIN PERFORM tw_accounting_post_invoice(inv,c,3,'2026-01-15','121001','411001','231001');EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Closed period accepted'; END IF;
 PERFORM tw_accounting_set_period(c,p,false,'QA reopen',2);
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_sequences WHERE company_id=c) THEN RAISE EXCEPTION 'Failed posts reserved voucher numbers'; END IF;
 -- Accounting-only management can post the submitted snapshot but cannot read Media.
 RESET ROLE;
 INSERT INTO tw_module_assignments(profile_id,media,accounting_role) VALUES(viewer,false,'manage') ON CONFLICT(profile_id) DO UPDATE SET media=false,accounting_role='manage';
 PERFORM set_config('request.jwt.claim.sub',viewer::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','aal','aal2')::text,true);
 SET LOCAL ROLE authenticated;
 SELECT count(*) INTO n FROM invoices WHERE id=inv;IF n<>0 THEN RAISE EXCEPTION 'Accounting-only staff can read Media invoices'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_media_invoice(inv);EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Accounting-only staff reached Media bridge'; END IF;
 j:=tw_accounting_post_invoice(inv,c,3,'2026-01-15','121001','411001','231001');
 IF tw_accounting_post_invoice(inv,c,3,'2026-01-15','121001','411001','231001')<>j THEN RAISE EXCEPTION 'Duplicate invoice posted'; END IF;
 IF (SELECT last_number FROM tw_accounting_journal_sequences WHERE company_id=c)<>1 THEN RAISE EXCEPTION 'Duplicate invoice allocated number'; END IF;
 IF (SELECT count(*) FROM tw_accounting_journal_lines WHERE journal_id=j)<>3 OR (SELECT sum(debit-credit) FROM tw_accounting_journal_lines WHERE journal_id=j)<>0 THEN RAISE EXCEPTION 'Invoice journal incorrect'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE journal_id=j AND debit=114.06 AND client_id=customer AND client_code='QA-AC-STAGE4-'||customer) THEN RAISE EXCEPTION 'Customer subledger link missing'; END IF;
 result:=tw_accounting_ledger(c,'121001','2026-01-01','2026-12-31',0);
 IF (result->>'closing')::numeric<>114.06 THEN RAISE EXCEPTION 'Receivable ledger incorrect'; END IF;
 result:=tw_accounting_trial_balance(c,'2026-01-01','2026-12-31');
 IF (SELECT sum((x->>'closing')::numeric) FROM jsonb_array_elements(result) x)<>0 THEN RAISE EXCEPTION 'Invoice trial balance does not balance'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_withdraw_invoice(inv,4);EXCEPTION WHEN serialization_failure THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Posted submission withdrawn'; END IF;
 rev:=tw_accounting_reverse_journal(j,c,gen_random_uuid(),'2026-02-01','QA reverse invoice');
 IF tw_accounting_reverse_journal(j,c,gen_random_uuid(),'2026-02-01','QA retry')<>rev THEN RAISE EXCEPTION 'Duplicate reversal'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE journal_id=rev AND credit=114.06 AND client_id=customer) THEN RAISE EXCEPTION 'Reversal lost customer link'; END IF;
 result:=tw_accounting_ledger(c,'121001','2026-01-01','2026-12-31',0);
 IF (result->>'closing')::numeric<>0 THEN RAISE EXCEPTION 'Reversal did not clear receivable'; END IF;
 RESET ROLE;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 UPDATE tw_module_assignments SET accounting_role='read' WHERE profile_id=viewer;
 PERFORM set_config('request.jwt.claim.sub',viewer::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','aal','aal2')::text,true);
 SET LOCAL ROLE authenticated;
 blocked:=false;BEGIN PERFORM tw_accounting_post_invoice(inv,c,3,'2026-01-15','121001','411001','231001');EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Read-only accounting user posted'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 result:=tw_accounting_media_invoice(inv);
 IF result->'submission'->>'status'<>'reversed' THEN RAISE EXCEPTION 'Media did not reflect reversal'; END IF;
 UPDATE invoices SET status='void' WHERE id=inv;
 PERFORM tw_accounting_submit_invoice(zero_vat,c);
 j:=tw_accounting_post_invoice(zero_vat,c,1,'2026-01-15','121001','411001',NULL);
 IF (SELECT count(*) FROM tw_accounting_journal_lines WHERE journal_id=j)<>2 THEN RAISE EXCEPTION 'Zero VAT generated an empty line'; END IF;
 UPDATE invoices SET amount_paid=10 WHERE id=zero_vat;
 IF (SELECT sum(debit) FROM tw_accounting_journal_lines WHERE journal_id=j)<>100 THEN RAISE EXCEPTION 'Payment changed invoice journal'; END IF;
 blocked:=false;BEGIN UPDATE invoices SET client_id=gen_random_uuid() WHERE id=zero_vat;EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Posted customer identity changed'; END IF;
 RAISE NOTICE 'Invoice submission, permissions, posting, retry, ledger and reversal checks passed';
END $$;
ROLLBACK;
