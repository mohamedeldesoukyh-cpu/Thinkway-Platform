BEGIN;
DO $$ DECLARE actor uuid;c uuid;j uuid;n integer;q jsonb;old jsonb;blocked boolean;BEGIN
SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='super_admin' AND p.is_active LIMIT 1;
PERFORM set_config('request.jwt.claim.sub',actor::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);SET LOCAL ROLE authenticated;
c:=tw_accounting_create_company('QA statement rollback '||gen_random_uuid(),'EG','EGP','2026-01-01','[{"code":"100000","name":"Assets","parent":null,"type":"Asset","normal":"Debit","kind":"Group"},{"code":"111001","name":"QA Bank","parent":"100000","type":"Asset","normal":"Debit","kind":"Posting"},{"code":"400000","name":"Revenue","parent":null,"type":"Revenue","normal":"Credit","kind":"Group"},{"code":"411001","name":"QA Revenue","parent":"400000","type":"Revenue","normal":"Credit","kind":"Posting"}]');

FOR n IN 1..3 LOOP
j:=tw_accounting_save_signed_workflow(jsonb_build_object('id',gen_random_uuid(),'company',c,'workflow','general','kind','manual','date','2026-11-22','reference','STATEMENT-TYPE-'||n,'memo','Isolated metadata fixture','version',NULL,'lines',jsonb_build_array(jsonb_build_object('account','111001','description','Metadata fixture','debit','100','credit','0'),jsonb_build_object('account','411001','description','Offset','debit','0','credit','100'))));
PERFORM tw_accounting_post_journal(j,c,1);
RESET ROLE;
UPDATE tw_accounting_journals SET automatic_source=CASE n WHEN 1 THEN NULL WHEN 2 THEN 'receipt' ELSE 'payment' END WHERE id=j;
SET LOCAL ROLE authenticated;
END LOOP;
q:=tw_accounting_statement_filtered(c,'2026-01-01','2026-12-31','111001');
IF (q->>'count')::integer<>3 OR (q->'accounts'->0->>'closing')::numeric<>300 THEN RAISE EXCEPTION 'Metadata joins changed totals or rows';END IF;
IF (SELECT count(DISTINCT x->>'transaction_type') FROM jsonb_array_elements(q->'rows') x)<>3 THEN RAISE EXCEPTION 'Types not distinguished';END IF;
IF EXISTS(SELECT 1 FROM jsonb_array_elements(q->'rows') x WHERE x->>'number' NOT LIKE 'JV-%' OR x->>'document_number' IS DISTINCT FROM x->>'number' OR (x->>'trx_debit')::numeric<>100) THEN RAISE EXCEPTION 'Journal references or TRX changed';END IF;
IF (q->'aging'->0->'buckets'->>1)::numeric<>300 THEN RAISE EXCEPTION 'Aging does not reconcile to closing balance';END IF;
q:=tw_accounting_statement_filtered(c,'2026-01-01','2026-12-31','111001',p_options=>'{"types":["payment"]}');
IF (q->>'count')::integer<>1 OR q->'rows'->0->>'transaction_type'<>'payment' THEN RAISE EXCEPTION 'Payment type and filter disagree';END IF;
RAISE NOTICE 'PASS: JV/RC/PY classifications, preserved JV numbers, exact TRX, ledger aging and payment filter';
END $$;
ROLLBACK;
