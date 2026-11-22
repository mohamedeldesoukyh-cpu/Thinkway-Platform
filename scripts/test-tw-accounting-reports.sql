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


 PERFORM tw_accounting_save_journal(j1,c,'2026-01-05','','Receipt',NULL,'[{"account":"111001","description":"Receipt","debit":"100","credit":"0"},{"account":"633001","description":"Offset","debit":"0","credit":"100"}]');
 PERFORM tw_accounting_post_journal(j1,c,1);
 PERFORM tw_accounting_save_journal(j2,c,'2026-02-05','','Payment',NULL,'[{"account":"633001","description":"Expense","debit":"30","credit":"0"},{"account":"111001","description":"Payment","debit":"0","credit":"30"}]');
 PERFORM tw_accounting_post_journal(j2,c,1);
 r:=tw_accounting_financial_report(c,'2026-02-01','2026-02-28');
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'accounts') a WHERE a->>'code'='111001' AND (a->>'opening')::numeric=100 AND (a->>'closing')::numeric=70 AND (a->>'credit')::numeric=30) THEN RAISE EXCEPTION 'Report date or balance mismatch: %',r;END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(r->'cash') a WHERE a->>'category'='Operating' AND (a->>'amount')::numeric=-30) THEN RAISE EXCEPTION 'Cash flow mismatch';END IF;
 PERFORM tw_accounting_save_journal(j3,c,'2026-02-06','','Unposted',NULL,'[{"account":"633001","description":"Expense","debit":"99","credit":"0"},{"account":"111001","description":"Payment","debit":"0","credit":"99"}]');
 IF r IS DISTINCT FROM tw_accounting_financial_report(c,'2026-02-01','2026-02-28') THEN RAISE EXCEPTION 'Draft affected report';END IF;
 RAISE NOTICE 'PASS: financial report dates, posted-only balances and signed cash flow';
END $$;
ROLLBACK;
