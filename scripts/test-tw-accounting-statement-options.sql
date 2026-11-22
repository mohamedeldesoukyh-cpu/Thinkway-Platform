BEGIN;
DO $$ DECLARE actor uuid;c uuid;j uuid;n integer;q jsonb;old jsonb;blocked boolean;BEGIN
SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='super_admin' AND p.is_active LIMIT 1;
PERFORM set_config('request.jwt.claim.sub',actor::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);SET LOCAL ROLE authenticated;
c:=tw_accounting_create_company('QA statement rollback '||gen_random_uuid(),'EG','EGP','2026-01-01','[{"code":"100000","name":"Assets","parent":null,"type":"Asset","normal":"Debit","kind":"Group"},{"code":"111001","name":"QA Bank","parent":"100000","type":"Asset","normal":"Debit","kind":"Posting"},{"code":"400000","name":"Revenue","parent":null,"type":"Revenue","normal":"Credit","kind":"Group"},{"code":"411001","name":"QA Revenue","parent":"400000","type":"Revenue","normal":"Credit","kind":"Posting"}]');
FOR n IN 1..2 LOOP
j:=tw_accounting_save_signed_workflow(jsonb_build_object('id',gen_random_uuid(),'company',c,'workflow','general','kind','manual','date','2026-11-22','reference','MINI-STATEMENT-QA-'||n,'memo','Mini statement isolated fixture '||n,'version',NULL,'lines',jsonb_build_array(jsonb_build_object('account','111001','description','QA bank line','debit',(n*100)::text,'credit','0'),jsonb_build_object('account','411001','description','QA revenue line','debit','0','credit',(n*100)::text))));
PERFORM tw_accounting_post_journal(j,c,1);
END LOOP;

q:=tw_accounting_statement_filtered(c,'2026-01-01','2026-12-31','111001');old:=tw_accounting_statement(c,'2026-01-01','2026-12-31','111001');
IF q->>'count' IS DISTINCT FROM old->>'count' OR q->'accounts'->0->>'closing' IS DISTINCT FROM old->'accounts'->0->>'closing' THEN RAISE EXCEPTION 'Default statement differs from existing balances';END IF;
IF (q->'accounts'->0->>'closing')::numeric<>300 THEN RAISE EXCEPTION 'Default balance wrong';END IF;
q:=tw_accounting_statement_filtered(c,'2026-01-01','2026-12-31','111001',p_options=>'{"types":["receipt"]}');IF (q->>'count')::integer<>0 THEN RAISE EXCEPTION 'Transaction filter ignored';END IF;
q:=tw_accounting_statement_filtered(c,'2026-01-01','2026-12-31','111001',p_options=>'{"includeUnlocked":false}');IF (q->>'count')::integer<>0 THEN RAISE EXCEPTION 'Lock filter ignored';END IF;
q:=tw_accounting_statement_filtered(c,'2026-01-01','2026-12-31','111001',p_options=>'{"display":"USD"}');IF q->>'currency'<>'USD' OR (q->'accounts'->0->>'closing')::numeric<>5.77 THEN RAISE EXCEPTION 'USD equivalent incorrect';END IF;
q:=tw_accounting_statement_filtered(c,'2026-01-01','2026-12-31','111001',p_currency=>'EGP',p_options=>'{"display":"foreign"}');IF (q->'accounts'->0->>'closing')::numeric<>300 THEN RAISE EXCEPTION 'Foreign balance incorrect';END IF;
q:=tw_accounting_statement_filtered(c,'2026-01-01','2026-12-31','100000');IF (q->'accounts'->0->>'closing')::numeric<>300 THEN RAISE EXCEPTION 'Parent does not include posting descendant';END IF;
RESET ROLE;UPDATE tw_accounting_companies SET currencies=ARRAY['EGP','USD'] WHERE id=c;SET LOCAL ROLE authenticated;
j:=tw_accounting_save_signed_workflow(jsonb_build_object('id',gen_random_uuid(),'company',c,'workflow','general','kind','manual','date','2026-11-22','reference','MULTI-FC-QA','memo','Separate currency balances','version',NULL,'lines',jsonb_build_array(jsonb_build_object('account','111001','description','USD bank','debit','52','credit','0','foreignDebit','1','foreignCredit','0','lineCurrency','USD','lineRate','52'),jsonb_build_object('account','411001','description','USD revenue','debit','0','credit','52','foreignDebit','0','foreignCredit','1','lineCurrency','USD','lineRate','52'))));PERFORM tw_accounting_post_journal(j,c,1);
q:=tw_accounting_statement_filtered(c,'2026-01-01','2026-12-31','100000',p_options=>'{"display":"foreign"}');
IF jsonb_array_length(q->'accounts')<>2 OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'accounts') a WHERE a->>'currency'='EGP' AND (a->>'closing')::numeric=300) OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(q->'accounts') a WHERE a->>'currency'='USD' AND (a->>'closing')::numeric=1) THEN RAISE EXCEPTION 'Foreign currency balances combined';END IF;
q:=tw_accounting_statement_filtered(c,'2026-11-23','2026-12-31','111001',p_options=>'{"skipInactivePeriod":true}');IF jsonb_array_length(q->'accounts')<>0 THEN RAISE EXCEPTION 'Inactive period filter ignored';END IF;
RAISE NOTICE 'PASS: preserved balances, parent descendants, transaction/lock filters, USD equivalents, independent foreign balances, no-movement option';
END $$;
ROLLBACK;

