-- Development only. No test document or number survives this transaction.
BEGIN;
DO $$
DECLARE actor uuid; viewer uuid; c uuid; j uuid:=gen_random_uuid(); j2 uuid:=gen_random_uuid(); rev uuid:=gen_random_uuid(); result uuid; jan uuid; report jsonb; blocked boolean; n integer; lines jsonb; batch_id uuid;
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='super_admin' AND p.is_active LIMIT 1;
 SELECT p.id INTO viewer FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='viewer' AND p.is_active AND NOT EXISTS(SELECT 1 FROM client_users WHERE profile_id=p.id) AND NOT EXISTS(SELECT 1 FROM influencers WHERE profile_id=p.id) LIMIT 1;
 IF actor IS NULL OR viewer IS NULL THEN RAISE EXCEPTION 'Dev actors missing'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 SET LOCAL ROLE authenticated;
 c:=tw_accounting_create_company('QA rollback journal engine','EG','EGP','2026-01-01','[
 {"code":"100000","name":"Assets","parent":null,"type":"Asset","normal":"Debit","kind":"Group"},
 {"code":"111001","name":"Cash","parent":"100000","type":"Asset","normal":"Debit","kind":"Posting"},
 {"code":"121001","name":"Customers","parent":"100000","type":"Asset","normal":"Debit","kind":"Control","subledger":"Customer"},
 {"code":"600000","name":"Expenses","parent":null,"type":"Expense","normal":"Debit","kind":"Group"},
 {"code":"633001","name":"Depreciation expense","parent":"600000","type":"Expense","normal":"Debit","kind":"Posting"}]');
 lines:='[{"account":"633001","description":"Test expense","debit":"123.45","credit":"0"},{"account":"111001","description":"Test cash","debit":"0","credit":"123.44"}]';
 blocked:=false;BEGIN PERFORM tw_accounting_save_journal(j,c,'2026-01-15','QA','Rollback test',NULL,lines);EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked OR EXISTS(SELECT 1 FROM tw_accounting_journals WHERE id=j) THEN RAISE EXCEPTION 'Unbalanced journal saved'; END IF;
 lines:=jsonb_set(lines,'{1,credit}','"123.45"');
 PERFORM tw_accounting_save_journal(j,c,'2026-01-15','QA','Rollback test',NULL,lines);
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_sequences WHERE company_id=c) THEN RAISE EXCEPTION 'Draft allocated a number'; END IF;
 report:=tw_accounting_trial_balance(c,'2026-01-01','2026-12-31');
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(report) r WHERE (r->>'closing')::numeric<>0) THEN RAISE EXCEPTION 'Draft affected balances'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_post_journal(j,c,9);EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Stale journal posted'; END IF;
 IF EXISTS(SELECT 1 FROM tw_accounting_journal_sequences WHERE company_id=c) THEN RAISE EXCEPTION 'Failed post allocated number'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_save_journal(j,c,'2026-01-15','QA','Rollback test',9,lines);EXCEPTION WHEN serialization_failure THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Stale edit accepted'; END IF;
 lines:=jsonb_set(lines,'{1,credit}','"123.45"');
 PERFORM tw_accounting_save_journal(j,c,'2026-01-15','QA','Rollback test',1,lines);
 blocked:=false;BEGIN PERFORM tw_accounting_save_journal(gen_random_uuid(),c,'2026-01-15','','Control bypass',NULL,jsonb_set(lines,'{0,account}','"121001"'));EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Control account accepted'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_save_journal(gen_random_uuid(),c,'2026-01-15','','Group bypass',NULL,jsonb_set(lines,'{0,account}','"600000"'));EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Group account accepted'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_save_journal(gen_random_uuid(),c,'2026-01-15','','Precision bypass',NULL,jsonb_set(lines,'{0,debit}','"123.451"'));EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Fractional cent accepted'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_save_journal(gen_random_uuid(),c,'2025-12-31','','Wrong period',NULL,lines);EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Unconfigured year accepted'; END IF;
 SELECT p.id INTO jan FROM tw_accounting_periods p JOIN tw_accounting_years y ON y.id=p.year_id WHERE y.company_id=c AND p.period_number=1;
 PERFORM tw_accounting_set_period(c,jan,true,'QA close',1);
 blocked:=false;BEGIN PERFORM tw_accounting_post_journal(j,c,2);EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Closed-period posting accepted'; END IF;
 PERFORM tw_accounting_set_period(c,jan,false,'QA reopen',2);
 PERFORM tw_accounting_post_journal(j,c,2);
 PERFORM tw_accounting_post_journal(j,c,2);
 IF (SELECT last_number FROM tw_accounting_journal_sequences WHERE company_id=c AND fiscal_year=2026)<>1 THEN RAISE EXCEPTION 'Posting retry allocated duplicate'; END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journals WHERE id=j AND voucher_number='JV-2026-000001' AND version=3) THEN RAISE EXCEPTION 'Incorrect voucher state'; END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_save_journal(j,c,'2026-01-15','','Edit posted',3,lines);EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Posted journal editable'; END IF;
 blocked:=false;BEGIN UPDATE tw_accounting_journals SET memo='Direct write' WHERE id=j;EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Direct header write accepted'; END IF;
 blocked:=false;BEGIN DELETE FROM tw_accounting_journal_lines WHERE journal_id=j;EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Direct line delete accepted'; END IF;
 blocked:=false;BEGIN UPDATE tw_accounting_accounts SET normal_balance='Credit' WHERE company_id=c AND code='633001';EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Posted account classification changed'; END IF;
 report:=tw_accounting_ledger(c,'633001','2026-01-01','2026-01-31',0);
 IF (report->>'closing')::numeric<>123.45 OR (report->>'count')::integer<>1 OR (report->'rows'->0->>'balance')::numeric<>123.45 THEN RAISE EXCEPTION 'Incorrect ledger: %',report; END IF;
 report:=tw_accounting_trial_balance(c,'2026-01-01','2026-01-31');
 IF (SELECT sum((r->>'closing')::numeric) FROM jsonb_array_elements(report) r)<>0 OR (SELECT sum((r->>'debit')::numeric) FROM jsonb_array_elements(report) r)<>123.45 THEN RAISE EXCEPTION 'Trial balance incorrect'; END IF;
 UPDATE tw_accounting_accounts SET active=false WHERE company_id=c AND code='633001';
 blocked:=false;BEGIN PERFORM tw_accounting_save_journal(j2,c,'2026-02-01','','Inactive account',NULL,lines);EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Inactive account accepted'; END IF;
 result:=tw_accounting_reverse_journal(j,c,rev,'2026-02-15','Rollback reversal');
 IF result<>rev OR tw_accounting_reverse_journal(j,c,gen_random_uuid(),'2026-02-15','Retry reversal')<>rev THEN RAISE EXCEPTION 'Reversal retry duplicated'; END IF;
 IF (SELECT last_number FROM tw_accounting_journal_sequences WHERE company_id=c)<>2 THEN RAISE EXCEPTION 'Incorrect reversal sequence'; END IF;
 report:=tw_accounting_ledger(c,'633001','2026-02-01','2026-02-28',0);
 IF (report->>'opening')::numeric<>123.45 OR (report->>'credit')::numeric<>123.45 OR (report->>'closing')::numeric<>0 THEN RAISE EXCEPTION 'Opening/reversal balance incorrect: %',report; END IF;
 report:=tw_accounting_ledger(c,'633001','2026-01-01','2026-12-31',100);
 IF jsonb_array_length(report->'rows')<>0 OR (report->>'count')::integer<>2 OR (report->>'closing')::numeric<>0 THEN RAISE EXCEPTION 'Pagination changed totals'; END IF;
 UPDATE tw_accounting_accounts SET active=true WHERE company_id=c AND code='633001';
 PERFORM tw_accounting_save_journal(j2,c,'2026-03-01','','Cancelled test',NULL,lines);
 PERFORM tw_accounting_cancel_journal(j2,c,1);
 blocked:=false;BEGIN PERFORM tw_accounting_post_journal(j2,c,2);EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cancelled draft posted'; END IF;
 -- Exercise running balances across an actual page boundary, not just empty offsets.
 FOR n IN 1..101 LOOP
  batch_id:=gen_random_uuid();
  PERFORM tw_accounting_save_journal(batch_id,c,'2026-03-15','','Pagination fixture',NULL,'[{"account":"633001","description":"","debit":"1.00","credit":"0"},{"account":"111001","description":"","debit":"0","credit":"1.00"}]');
  PERFORM tw_accounting_post_journal(batch_id,c,1);
 END LOOP;
 report:=tw_accounting_ledger(c,'633001','2026-03-01','2026-03-31',100);
 IF (report->>'count')::integer<>101 OR jsonb_array_length(report->'rows')<>1 OR (report->'rows'->0->>'balance')::numeric<>101 OR (report->>'debit')::numeric<>101 THEN RAISE EXCEPTION 'Running balance incorrect across page boundary'; END IF;
 INSERT INTO tw_module_assignments(profile_id,media,accounting_role) VALUES(viewer,false,'read') ON CONFLICT(profile_id) DO UPDATE SET media=false,accounting_role='read';
 PERFORM set_config('request.jwt.claim.sub',viewer::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','aal','aal2')::text,true);
 report:=tw_accounting_trial_balance(c,'2026-01-01','2026-12-31');
 blocked:=false;BEGIN PERFORM tw_accounting_post_journal(j,c,3);EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Reader posted'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal1')::text,true);
 blocked:=false;BEGIN PERFORM tw_accounting_save_journal(gen_random_uuid(),c,'2026-01-15','','MFA bypass',NULL,lines);EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'MFA bypass'; END IF;
 RAISE NOTICE 'PASS: drafts, decimal precision, balanced posting, numbering/retry, period locks, immutable posting, reversal/retry, ledger openings, trial balance, pagination, account rules, read-only and MFA';
END $$;
ROLLBACK;
