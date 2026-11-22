-- Development-only reconciliation fixtures. Every record and counter rolls back.
BEGIN;
DO $$
DECLARE yr uuid;period uuid;alloc jsonb;actor uuid;reviewer uuid;c uuid;b uuid:=gen_random_uuid();s uuid:=gen_random_uuid();j1 uuid:=gen_random_uuid();j2 uuid:=gen_random_uuid();j3 uuid:=gen_random_uuid();blocked boolean;v integer;g uuid;ids jsonb;r jsonb;
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


 PERFORM tw_accounting_save_journal(j1,c,'2026-01-05','','Receipt',NULL,'[{"account":"111001","description":"Receipt","debit":"100","credit":"0"},{"account":"633001","description":"Offset","debit":"0","credit":"100"}]');
 PERFORM tw_accounting_post_journal(j1,c,1);
 PERFORM tw_accounting_save_journal(j2,c,'2026-02-05','','Payment',NULL,'[{"account":"633001","description":"Expense","debit":"30","credit":"0"},{"account":"111001","description":"Payment","debit":"0","credit":"30"}]');
 PERFORM tw_accounting_post_journal(j2,c,1);
 r:=tw_accounting_financial_report(c,'2026-02-01','2026-02-28');
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'accounts') a WHERE a->>'code'='111001' AND (a->>'opening')::numeric=100 AND (a->>'closing')::numeric=70 AND (a->>'credit')::numeric=30) THEN RAISE EXCEPTION 'Report date or balance mismatch: %',r;END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'cash') a WHERE a->>'category'='Operating' AND (a->>'amount')::numeric=-30) THEN RAISE EXCEPTION 'Cash flow mismatch';END IF;
 PERFORM tw_accounting_save_journal(j3,c,'2026-02-06','','Unposted',NULL,'[{"account":"633001","description":"Expense","debit":"99","credit":"0"},{"account":"111001","description":"Payment","debit":"0","credit":"99"}]');
 IF r IS DISTINCT FROM tw_accounting_financial_report(c,'2026-02-01','2026-02-28') THEN RAISE EXCEPTION 'Draft affected report';END IF;

 SELECT id INTO yr FROM tw_accounting_years WHERE company_id=c;
 SELECT jsonb_agg(jsonb_build_object('period',id,'amount','100','version',NULL) ORDER BY period_number) INTO alloc FROM tw_accounting_periods WHERE year_id=yr;
 PERFORM tw_accounting_budget_save(c,yr,'633001',alloc);
 r:=tw_accounting_budget_report(c,yr);
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r) a WHERE a->>'code'='633001' AND a->>'date'='2026-02-01' AND (a->>'budget')::numeric=100 AND (a->>'actual')::numeric=30) THEN RAISE EXCEPTION 'Budget/actual report mismatch';END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_budget_save(c,yr,'633001',alloc);EXCEPTION WHEN serialization_failure THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Stale budget accepted';END IF;
 SELECT id INTO period FROM tw_accounting_periods WHERE year_id=yr AND period_number=1;
 PERFORM tw_accounting_set_period(c,period,true,'QA closed month',1);
 SELECT jsonb_agg(jsonb_build_object('period',p.id,'amount',CASE WHEN p.period_number=1 THEN '100' ELSE '120' END,'version',b.version) ORDER BY p.period_number) INTO alloc FROM tw_accounting_periods p JOIN tw_accounting_budgets b ON b.period_id=p.id AND b.company_id=c AND b.account_code='633001' WHERE p.year_id=yr;
 PERFORM tw_accounting_budget_save(c,yr,'633001',alloc);
 SELECT jsonb_agg(jsonb_build_object('period',p.id,'amount','130','version',b.version) ORDER BY p.period_number) INTO alloc FROM tw_accounting_periods p JOIN tw_accounting_budgets b ON b.period_id=p.id AND b.company_id=c AND b.account_code='633001' WHERE p.year_id=yr;
 blocked:=false;BEGIN PERFORM tw_accounting_budget_save(c,yr,'633001',alloc);EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked OR EXISTS(SELECT 1 FROM tw_accounting_budgets WHERE company_id=c AND amount=130) THEN RAISE EXCEPTION 'Closed budget changed or partial save';END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal1')::text,true);
 blocked:=false;BEGIN PERFORM tw_accounting_budget_save(c,yr,'633001',alloc);EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Budget MFA bypass';END IF;
 RAISE NOTICE 'PASS: posted-only actuals, monthly budgets, optimistic versions, protected closed months, atomic saves and MFA';
END $$;
ROLLBACK;
