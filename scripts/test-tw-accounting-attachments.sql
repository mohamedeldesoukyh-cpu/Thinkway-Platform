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
 val:=jsonb_build_object('company',c,'kind','receipt','party',customer,'currency','USD','date','2026-02-01','amount','30','cash','111001','control','121001','advance','221001','gain','712001','loss','722001','parent',NULL,'advanceRow',true,'method','bank_transfer','reference','QA multi allocation','lines',jsonb_build_array(jsonb_build_object('id',inv,'amount','20')));
 quote:=tw_accounting_settlement_quote(val);saved:=val;j:=tw_accounting_settlement_post(rv,val,quote);

 INSERT INTO tw_accounting_attachments(id,journal_id,file_name,mime_type,byte_size,storage_path)
 VALUES(req,j,'receipt.pdf','application/pdf',12,j::text||'/'||req::text||'.pdf');
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_attachments WHERE id=req AND company_id=c) THEN RAISE EXCEPTION 'Attachment company identity lost';END IF;
 IF NOT tw_accounting_attachment_object(j::text||'/'||req::text||'.pdf',true) THEN RAISE EXCEPTION 'Signed upload policy denied valid journal';END IF;
 blocked:=false;BEGIN UPDATE tw_accounting_attachments SET uploaded_at=now() WHERE id=req;EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Incomplete upload accepted';END IF;
 blocked:=false;BEGIN UPDATE tw_accounting_attachments SET file_name='changed.pdf' WHERE id=req;EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Attachment identity editable';END IF;
 RESET ROLE;
 UPDATE tw_accounting_journals SET control_locked=true WHERE id=j;
 SET LOCAL ROLE authenticated;
 IF tw_accounting_attachment_access(j,true) OR NOT tw_accounting_attachment_access(j,false) THEN RAISE EXCEPTION 'Locked attachment access incorrect';END IF;
 blocked:=false;BEGIN UPDATE tw_accounting_attachments SET removed_at=now() WHERE id=req;EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF EXISTS(SELECT 1 FROM tw_accounting_attachments WHERE id=req AND removed_at IS NOT NULL) THEN RAISE EXCEPTION 'Locked attachment removed';END IF;
 RESET ROLE;
 UPDATE tw_accounting_journals SET control_locked=false WHERE id=j;
 SET LOCAL ROLE authenticated;
 UPDATE tw_accounting_attachments SET removed_at=now() WHERE id=req;
 IF tw_accounting_attachment_object(j::text||'/'||req::text||'.pdf',false) THEN RAISE EXCEPTION 'Removed attachment still accessible';END IF;
 PERFORM set_config('request.jwt.claim.sub',viewer::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','aal','aal2')::text,true);
 IF tw_accounting_attachment_access(j,true) THEN RAISE EXCEPTION 'Viewer attachment mutation allowed';END IF;
 RAISE NOTICE 'PASS attachment identity, incomplete upload rejection, immutable metadata, lock protection, soft removal, viewer denial';
END $$;
ROLLBACK;
