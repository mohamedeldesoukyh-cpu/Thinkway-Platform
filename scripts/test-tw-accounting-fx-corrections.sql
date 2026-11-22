-- Development only: every fixture, journal and accounting counter rolls back.
BEGIN;
DO $$
DECLARE actor uuid; viewer uuid; customer uuid:=gen_random_uuid(); inv uuid:=gen_random_uuid(); bad uuid:=gen_random_uuid(); zero_vat uuid:=gen_random_uuid(); c uuid; j uuid; rev uuid; p uuid; blocked boolean; result jsonb; n integer; v integer; saved_number text; rate numeric;
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='super_admin' AND p.is_active LIMIT 1;
 SELECT p.id INTO viewer FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='viewer' AND p.is_active AND NOT EXISTS(SELECT 1 FROM client_users WHERE profile_id=p.id) AND NOT EXISTS(SELECT 1 FROM influencers WHERE profile_id=p.id) LIMIT 1;
 IF actor IS NULL OR viewer IS NULL THEN RAISE EXCEPTION 'Development actors missing'; END IF;
 INSERT INTO clients(id,document_number,name,currency) VALUES(customer,'QA-AC-STAGE4-'||customer,'QA accounting invoice rollback '||customer,'EGP');
 INSERT INTO invoices(id,document_number,client_id,issue_date,currency,subtotal,tax_amount,total,revenue_before_vat,revenue_vat_amount,revenue_after_vat,amounts_finalized_at)
 VALUES(inv,'QA-INV-'||inv,customer,'2026-01-15','USD',100.05,14.01,114.06,100.05,14.01,114.06,now()),
 (bad,'QA-INV-'||bad,customer,'2026-01-15','XXX',100,0,100,100,0,100,now()),
 (zero_vat,'QA-INV-'||zero_vat,customer,'2026-01-15','EGP',100,0,100,100,0,100,now());
 INSERT INTO md_exchange_rates(from_currency,to_currency,exchange_rate,effective_start_date,effective_end_date,is_active,source)
 VALUES('USD','EGP',50.12345678,'2026-01-15','2026-01-15',true,'QA FX rollback');
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

 INSERT INTO finance_documents(document_kind,document_number,source_table,source_id,client_id,currency,amount_before_vat,vat_amount,amount_after_vat,status,created_by)
 SELECT 'client_invoice',document_number,'invoices',id,client_id,currency,subtotal,tax_amount,total,status::text,actor FROM invoices WHERE id=inv;
 PERFORM tw_accounting_submit_invoice(inv,c);
 result:=tw_accounting_invoice_fx(inv,c);
 IF (result->>'rate')::numeric<>50.12345678 THEN RAISE EXCEPTION 'Preview did not resolve the invoice-date rate'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_post_invoice(inv,c,1,'2026-01-15','121001','411001','231001',49);EXCEPTION WHEN serialization_failure THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Stale FX rate accepted'; END IF;
 j:=tw_accounting_post_invoice(inv,c,1,'2026-01-15','121001','411001','231001',50.12345678);
 SELECT voucher_number INTO saved_number FROM tw_accounting_journals WHERE id=j;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE journal_id=j AND line_number=1 AND foreign_debit=114.06 AND debit=5717.08) THEN RAISE EXCEPTION 'Dual currency amounts incorrect'; END IF;
 IF (SELECT sum(debit-credit) FROM tw_accounting_journal_lines WHERE journal_id=j)<>0 OR (SELECT sum(foreign_debit-foreign_credit) FROM tw_accounting_journal_lines WHERE journal_id=j)<>0 THEN RAISE EXCEPTION 'FX journal does not balance'; END IF;
 blocked:=false;BEGIN UPDATE invoices SET subtotal=120,total=134.01,revenue_before_vat=120,revenue_after_vat=134.01 WHERE id=inv;EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Posted invoice edited'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_save_journal(j,c,'2026-01-15','','illegal edit',2,'[]');EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Automatic journal manually edited'; END IF;
 SELECT p1.id INTO p FROM tw_accounting_periods p1 JOIN tw_accounting_years y ON y.id=p1.year_id WHERE y.company_id=c AND p1.period_number=1;
 PERFORM tw_accounting_set_period(c,p,true,'QA close',1);
 blocked:=false;BEGIN PERFORM tw_accounting_unpost_invoice(inv,c,2,'Correction');EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Closed period unposted'; END IF;
 PERFORM tw_accounting_set_period(c,p,false,'QA reopen',2);
 -- Savepoint keeps the existing fixture versions and serial expectations unchanged.
 BEGIN
  PERFORM tw_accounting_control_action(c,'lock',(SELECT jsonb_build_array(jsonb_build_object('id',id,'version',version)) FROM tw_accounting_journals WHERE id=j),'Lock source correction fixture');
  blocked:=false;BEGIN PERFORM tw_accounting_unpost_invoice(inv,c,2,'Locked invoice correction'); EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%locked%';END;
  IF NOT blocked THEN RAISE EXCEPTION 'Locked source invoice unposted'; END IF;
  RAISE NOTICE 'PASS: source journal lock enforced';
  RAISE EXCEPTION 'Rollback lock scenario only' USING ERRCODE='ZX001';
 EXCEPTION WHEN SQLSTATE 'ZX001' THEN NULL;
 END;
 PERFORM tw_accounting_unpost_invoice(inv,c,2,'Correct pricing');
 PERFORM tw_accounting_unpost_invoice(inv,c,2,'Retry');
 IF NOT tw_accounting_invoice_correction_allowed(inv) THEN RAISE EXCEPTION 'Pending invoice not editable'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal1')::text,true);
 IF tw_accounting_invoice_correction_allowed(inv) THEN RAISE EXCEPTION 'Correction without MFA allowed'; END IF;
 blocked:=false;BEGIN UPDATE invoices SET subtotal=120 WHERE id=inv;EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Correction without MFA changed amounts'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 RESET ROLE;
 INSERT INTO tw_module_assignments(profile_id,media,accounting_role) VALUES(viewer,false,'manage') ON CONFLICT(profile_id) DO UPDATE SET media=false,accounting_role='manage';
 PERFORM set_config('request.jwt.claim.sub',viewer::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','aal','aal2')::text,true);
 SET LOCAL ROLE authenticated;
 IF tw_accounting_invoice_correction_allowed(inv) THEN RAISE EXCEPTION 'Accounting-only staff can correct Media source'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journals WHERE id=j AND status='pending' AND voucher_number=saved_number) THEN RAISE EXCEPTION 'Pending voucher number lost'; END IF;
 result:=tw_accounting_ledger(c,'121001','2026-01-01','2026-12-31',0);
 IF (result->>'closing')::numeric<>0 THEN RAISE EXCEPTION 'Pending voucher remains in ledger'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_post_journal(j,c,3);EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Pending automatic journal manually posted'; END IF;
 blocked:=false;BEGIN UPDATE invoices SET currency='EGP' WHERE id=inv;EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Correction changed invoice currency'; END IF;
 -- Exercise issued line guards and automatic header recalculation under the same
 -- authorization used by the Media regeneration pipeline.
 UPDATE invoices SET regeneration_status='pending_regeneration',status='draft' WHERE id=inv;
 INSERT INTO invoice_line_items(invoice_id,sort_order,description,quantity,unit_price,revenue_vat_percent,revenue_vat_exempt)
 VALUES(inv,1,'Corrected campaign charge',1,200,14,false);
 IF (SELECT subtotal FROM invoices WHERE id=inv)<>200 THEN RAISE EXCEPTION 'Corrected lines did not recalculate'; END IF;
 IF (SELECT amount_after_vat FROM finance_documents WHERE source_table='invoices' AND source_id=inv)<>228 THEN RAISE EXCEPTION 'Finance registry totals stale after correction'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_submit_invoice(inv,c);EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Unfinished regeneration submitted'; END IF;
 UPDATE invoices SET regeneration_status='active',version_number=version_number+1 WHERE id=inv;
 PERFORM tw_accounting_submit_invoice(inv,c);
 IF tw_accounting_invoice_correction_allowed(inv) THEN RAISE EXCEPTION 'Resubmission left invoice editable'; END IF;
 -- Withdrawing a corrected submission returns to pending without losing linkage.
 SELECT version INTO v FROM tw_accounting_invoice_submissions WHERE invoice_id=inv;
 PERFORM tw_accounting_withdraw_invoice(inv,v);
 IF NOT tw_accounting_invoice_correction_allowed(inv) THEN RAISE EXCEPTION 'Withdraw lost pending correction state'; END IF;
 PERFORM tw_accounting_submit_invoice(inv,c);
 SELECT version INTO v FROM tw_accounting_invoice_submissions WHERE invoice_id=inv;
 IF tw_accounting_post_invoice(inv,c,v,'2026-01-15','121001','411001','231001',50.12345678)<>j THEN RAISE EXCEPTION 'Repost created another journal'; END IF;
 IF (SELECT voucher_number FROM tw_accounting_journals WHERE id=j)<>saved_number OR (SELECT last_number FROM tw_accounting_journal_sequences WHERE company_id=c)<>1 THEN RAISE EXCEPTION 'Repost consumed number'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE journal_id=j AND foreign_debit=228 AND debit=11428.15) THEN RAISE EXCEPTION 'Reposted amounts not rebuilt'; END IF;
 RESET ROLE;
 UPDATE md_exchange_rates SET exchange_rate=51 WHERE source='QA FX rollback';
 SET LOCAL ROLE authenticated;
 IF (tw_accounting_invoice_fx(inv,c)->>'rate')::numeric<>50.12345678 THEN RAISE EXCEPTION 'Posted FX snapshot changed with master data'; END IF;
 rev:=tw_accounting_reverse_journal(j,c,gen_random_uuid(),'2026-02-01','QA FX reversal');
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE journal_id=rev AND foreign_credit=228 AND credit=11428.15) THEN RAISE EXCEPTION 'Reversal lost FX amounts'; END IF;
 SELECT version INTO v FROM tw_accounting_invoice_submissions WHERE invoice_id=inv;
 blocked:=false;BEGIN PERFORM tw_accounting_unpost_invoice(inv,c,v,'Illegal unpost');EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Reversed invoice unposted'; END IF;
 RAISE NOTICE 'FX posting, pending correction, same-number repost, rate snapshot and reversal checks passed';
END $$;
ROLLBACK;
