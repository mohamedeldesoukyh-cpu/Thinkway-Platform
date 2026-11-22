-- Development-only reconciliation fixtures. Every record and counter rolls back.
BEGIN;
DO $$
DECLARE actor uuid;reviewer uuid;c uuid;b uuid:=gen_random_uuid();s uuid:=gen_random_uuid();j1 uuid:=gen_random_uuid();j2 uuid:=gen_random_uuid();j3 uuid:=gen_random_uuid();blocked boolean;v integer;g uuid;ids jsonb;r jsonb;
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='super_admin' AND p.is_active LIMIT 1;
 SELECT p.id INTO reviewer FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='viewer' AND p.is_active AND NOT EXISTS(SELECT 1 FROM client_users WHERE profile_id=p.id) AND NOT EXISTS(SELECT 1 FROM influencers WHERE profile_id=p.id) LIMIT 1;
 IF actor IS NULL OR reviewer IS NULL THEN RAISE EXCEPTION 'Dev actors missing'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 SET LOCAL ROLE authenticated;
 INSERT INTO tw_module_assignments(profile_id,media,accounting_role) VALUES(reviewer,false,'manage') ON CONFLICT(profile_id) DO UPDATE SET media=false,accounting_role='manage';
 c:=tw_accounting_create_company('QA rollback transaction controls','EG','EGP','2026-01-01','[
 {"code":"100000","name":"Assets","parent":null,"type":"Asset","normal":"Debit","kind":"Group"},
 {"code":"111001","name":"Cash","parent":"100000","type":"Asset","normal":"Debit","kind":"Posting"},
 {"code":"111002","name":"Other cash","parent":"100000","type":"Asset","normal":"Debit","kind":"Posting"},
 {"code":"600000","name":"Expenses","parent":null,"type":"Expense","normal":"Debit","kind":"Group"},
 {"code":"633001","name":"Depreciation","parent":"600000","type":"Expense","normal":"Debit","kind":"Posting"}]');

 PERFORM tw_accounting_bank_action(c,'bank-save',jsonb_build_object('id',b,'name','QA Bank','account','111001','auxiliary','','currency','EGP','reference','QA ONLY','active',true));
 PERFORM tw_accounting_bank_action(c,'bank-save',jsonb_build_object('id',b,'version',1,'name','QA Bank updated','account','111001','auxiliary','','currency','EGP','reference','QA ONLY','active',true));
 IF (SELECT name FROM tw_accounting_banks WHERE id=b)<>'QA Bank updated' THEN RAISE EXCEPTION 'Bank profile edit failed';END IF;
 PERFORM tw_accounting_save_journal(j1,c,'2026-01-05','','Bank receipt',NULL,'[{"account":"111001","description":"Receipt","debit":"100","credit":"0"},{"account":"633001","description":"Offset","debit":"0","credit":"100"}]');
 PERFORM tw_accounting_post_journal(j1,c,1);
 PERFORM tw_accounting_save_journal(j2,c,'2026-01-06','','Bank payment',NULL,'[{"account":"633001","description":"Expense","debit":"30","credit":"0"},{"account":"111001","description":"Payment","debit":"0","credit":"30"}]');
 PERFORM tw_accounting_post_journal(j2,c,1);
 PERFORM tw_accounting_save_journal(j3,c,'2026-01-07','','Outstanding deposit',NULL,'[{"account":"111001","description":"Deposit","debit":"20","credit":"0"},{"account":"633001","description":"Offset","debit":"0","credit":"20"}]');
 PERFORM tw_accounting_post_journal(j3,c,1);
 PERFORM tw_accounting_bank_action(c,'import',jsonb_build_object('id',s,'bank',b,'reference','QA JAN','from','2026-01-01','to','2026-01-31','opening','0','closing','70','rows','[{"date":"2026-01-05","reference":"R1","description":"Receipt","amount":"100"},{"date":"2026-01-06","reference":"P1","description":"Payment","amount":"-30"}]'::jsonb));
 r:=tw_accounting_bank_report(c,b,s,'2026-01-31');
 IF r->>'balance'<>'90.00' OR r->>'outstanding'<>'90.00' THEN RAISE EXCEPTION 'Bank movement balances incorrect: %',r; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_bank_action(c,'import',jsonb_build_object('id',gen_random_uuid(),'bank',b,'reference','Duplicate','from','2026-01-01','to','2026-01-31','opening','0','closing','70','rows','[{"date":"2026-01-05","reference":"R1","description":"Receipt","amount":"70"}]'::jsonb));EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Overlapping import accepted';END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_bank_action(c,'close',jsonb_build_object('id',s,'version',1,'reason','Premature close'));EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Unmatched statement closed';END IF;
 SELECT jsonb_agg(id ORDER BY row_number) INTO ids FROM tw_accounting_bank_rows WHERE statement_id=s;
 blocked:=false;BEGIN PERFORM tw_accounting_bank_action(c,'match',jsonb_build_object('id',s,'version',1,'reason','Incorrect match','rows',ids,'lines',jsonb_build_array(jsonb_build_object('journal',j1,'line',1))));EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked OR EXISTS(SELECT 1 FROM tw_accounting_bank_matches WHERE statement_id=s) THEN RAISE EXCEPTION 'Unbalanced match accepted';END IF;
 PERFORM tw_accounting_bank_action(c,'match',jsonb_build_object('id',s,'version',1,'reason','Match bank movements','rows',ids,'lines',jsonb_build_array(jsonb_build_object('journal',j1,'line',1),jsonb_build_object('journal',j2,'line',2))));
 SELECT id INTO g FROM tw_accounting_bank_matches WHERE statement_id=s;
 r:=tw_accounting_bank_report(c,b,s,'2026-01-31');IF r->>'outstanding'<>'20.00' THEN RAISE EXCEPTION 'Outstanding deposit not retained';END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_move_accounts(gen_random_uuid(),c,'111001','111002',NULL,true,'[]',3,'Reconciled move blocked',tw_accounting_move_lines(c,'111001')->>'snapshot');EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Matched GL line reclassified';END IF;
 PERFORM tw_accounting_bank_action(c,'close',jsonb_build_object('id',s,'version',2,'reason','Adjusted balance agrees'));
 blocked:=false;BEGIN PERFORM tw_accounting_bank_action(c,'unmatch',jsonb_build_object('id',s,'version',3,'reason','Closed unmatch','match',g));EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Closed reconciliation changed';END IF;
 PERFORM set_config('request.jwt.claim.sub',reviewer::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',reviewer,'role','authenticated','aal','aal2')::text,true);
 blocked:=false;BEGIN PERFORM tw_accounting_bank_action(c,'reopen',jsonb_build_object('id',s,'version',3,'reason','Unauthorized reopen'));EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Manager reopened closed reconciliation';END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 PERFORM tw_accounting_bank_action(c,'reopen',jsonb_build_object('id',s,'version',3,'reason','Administrator correction'));
 PERFORM tw_accounting_bank_action(c,'unmatch',jsonb_build_object('id',s,'version',4,'reason','Audited match correction','match',g));
 IF EXISTS(SELECT 1 FROM tw_accounting_bank_match_lines WHERE company_id=c) THEN RAISE EXCEPTION 'Unmatch left matched lines';END IF;
 PERFORM tw_accounting_bank_action(c,'void',jsonb_build_object('id',s,'version',5,'reason','Replace incorrect import'));
 IF (SELECT status FROM tw_accounting_bank_statements WHERE id=s)<>'void' THEN RAISE EXCEPTION 'Import void failed';END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_audit WHERE table_name='tw_accounting_bank_statements' AND operation='BANK_UNMATCH' AND after_data->>'reason'='Audited match correction') THEN RAISE EXCEPTION 'Unmatch reason not audited';END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal1')::text,true);
 blocked:=false;BEGIN PERFORM tw_accounting_bank_action(c,'bank-save',jsonb_build_object('id',gen_random_uuid(),'name','Denied bank','account','111002','auxiliary','','currency','EGP','active',true));EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'MFA bypass';END IF;
 RAISE NOTICE 'PASS: import totals, duplicate periods, grouped matching, outstanding deposits, line protection, closure, administrator reopen, audited unmatch/void and MFA';
END $$;
ROLLBACK;
