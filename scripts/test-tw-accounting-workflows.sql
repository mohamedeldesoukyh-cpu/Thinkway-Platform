-- Development-only fixtures and document numbers roll back.
BEGIN;
DO $$
DECLARE actor uuid;reviewer uuid;c uuid;j uuid:=gen_random_uuid();s uuid:=gen_random_uuid();r uuid;repeat_id uuid;v integer;blocked boolean;
lines jsonb:='[{"account":"633001","description":"Expense","debit":"100","credit":"0"},{"account":"111001","description":"Cash","debit":"0","credit":"100"}]';
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='super_admin' AND p.is_active LIMIT 1;
 SELECT p.id INTO reviewer FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='viewer' AND p.is_active AND NOT EXISTS(SELECT 1 FROM client_users WHERE profile_id=p.id) AND NOT EXISTS(SELECT 1 FROM influencers WHERE profile_id=p.id) LIMIT 1;
 IF actor IS NULL OR reviewer IS NULL THEN RAISE EXCEPTION 'Dev actors missing'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 SET LOCAL ROLE authenticated;

 c:=tw_accounting_create_company('QA rollback transaction controls','EG','EGP','2026-01-01','[
 {"code":"100000","name":"Assets","parent":null,"type":"Asset","normal":"Debit","kind":"Group"},
 {"code":"111001","name":"Cash","parent":"100000","type":"Asset","normal":"Debit","kind":"Posting"},
 {"code":"111002","name":"Other cash","parent":"100000","type":"Asset","normal":"Debit","kind":"Posting"},
 {"code":"600000","name":"Expenses","parent":null,"type":"Expense","normal":"Debit","kind":"Group"},
 {"code":"633001","name":"Depreciation","parent":"600000","type":"Expense","normal":"Debit","kind":"Posting"}]');

 PERFORM tw_accounting_save_journal(j,c,'2026-01-01','','Recurring source',NULL,lines);
 PERFORM tw_accounting_schedule_action(c,'create',jsonb_build_object('id',s,'kind','recurring','source',j,'sourceVersion',1,'name','Monthly expense','date','2026-01-31','months',1,'end','2026-03-31'));
 r:=tw_accounting_schedule_action(c,'run',jsonb_build_object('id',s,'version',1,'date','2026-01-31'));
 repeat_id:=tw_accounting_schedule_action(c,'run',jsonb_build_object('id',s,'version',1,'date','2026-01-31'));
 IF r<>repeat_id OR (SELECT status FROM tw_accounting_journals WHERE id=r)<>'draft' OR (SELECT next_date FROM tw_accounting_schedules WHERE id=s)<>'2026-02-28' THEN RAISE EXCEPTION 'Recurring idempotency/draft/month-end failed'; END IF;
 PERFORM tw_accounting_schedule_action(c,'run',jsonb_build_object('id',s,'version',2,'date','2026-02-28'));
 IF (SELECT next_date FROM tw_accounting_schedules WHERE id=s)<>'2026-03-31' THEN RAISE EXCEPTION 'Month-end anchor drift'; END IF;
 PERFORM tw_accounting_schedule_action(c,'toggle',jsonb_build_object('id',s,'version',3));
 blocked:=false;BEGIN PERFORM tw_accounting_schedule_action(c,'run',jsonb_build_object('id',s,'version',4,'date','2026-03-31'));EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Paused schedule executed';END IF;
 PERFORM tw_accounting_post_journal(j,c,1);
 s:=gen_random_uuid();
 PERFORM tw_accounting_schedule_action(c,'create',jsonb_build_object('id',s,'kind','reversal','source',j,'sourceVersion',(SELECT version FROM tw_accounting_journals WHERE id=j),'name','Reverse expense','date','2026-02-01'));
 r:=tw_accounting_schedule_action(c,'run',jsonb_build_object('id',s,'version',1,'date','2026-02-01'));
 IF (SELECT reversal_of FROM tw_accounting_journals WHERE id=r)<>j OR (SELECT status FROM tw_accounting_journals WHERE id=r)<>'posted' OR (SELECT active FROM tw_accounting_schedules WHERE id=s) THEN RAISE EXCEPTION 'Scheduled reversal failed';END IF;
 IF tw_accounting_schedule_action(c,'run',jsonb_build_object('id',s,'version',1,'date','2026-02-01'))<>r THEN RAISE EXCEPTION 'Duplicate reversal';END IF;
 j:=gen_random_uuid();
 PERFORM tw_accounting_save_workflow(jsonb_build_object('id',j,'company',c,'date','2026-01-01','reference','','memo','Opening cash','workflow','opening','lines','[{"account":"111001","description":"Opening","debit":"100","credit":"0"},{"account":"111002","description":"Offset","debit":"0","credit":"100"}]'::jsonb));
 PERFORM tw_accounting_post_journal(j,c,1);
 blocked:=false;BEGIN PERFORM tw_accounting_save_workflow(jsonb_build_object('id',gen_random_uuid(),'company',c,'date','2026-01-02','reference','','memo','Invalid opening','workflow','opening','lines',lines));EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Invalid opening accepted';END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_save_workflow(jsonb_build_object('id',gen_random_uuid(),'company',c,'date','2026-01-01','reference','','memo','Expense opening','workflow','opening','lines',lines));EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'P&L opening accepted';END IF;
 j:=gen_random_uuid();
 PERFORM tw_accounting_save_workflow(jsonb_build_object('id',j,'company',c,'date','2026-02-01','reference','','memo','Cash transfer','workflow','transfer','lines','[{"account":"111001","description":"Destination","debit":"100","credit":"0"},{"account":"111002","description":"Source","debit":"0","credit":"100"}]'::jsonb));
 PERFORM tw_accounting_post_journal(j,c,1);
 IF (SELECT workflow FROM tw_accounting_journals WHERE id=j)<>'transfer' THEN RAISE EXCEPTION 'Transfer missing';END IF;
 blocked:=false;BEGIN PERFORM tw_accounting_save_workflow(jsonb_build_object('id',gen_random_uuid(),'company',c,'date','2026-02-01','reference','','memo','Self transfer','workflow','transfer','lines','[{"account":"111001","description":"Destination","debit":"100","credit":"0"},{"account":"111001","description":"Source","debit":"0","credit":"100"}]'::jsonb));EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Self transfer accepted';END IF;
 -- Generated drafts retain the company approval policy.
 PERFORM tw_accounting_approval_policy(c,true,(SELECT version FROM tw_accounting_companies WHERE id=c),'Enable schedule review');
 s:=gen_random_uuid();j:=gen_random_uuid();
 PERFORM tw_accounting_save_journal(j,c,'2026-01-01','','Approval source',NULL,lines);
 PERFORM tw_accounting_schedule_action(c,'create',jsonb_build_object('id',s,'kind','recurring','source',j,'sourceVersion',1,'name','Reviewed recurrence','date','2026-02-01'));
 r:=tw_accounting_schedule_action(c,'run',jsonb_build_object('id',s,'version',1,'date','2026-02-01'));
 blocked:=false;BEGIN PERFORM tw_accounting_post_journal(r,c,1);EXCEPTION WHEN OTHERS THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Generated draft bypassed approval';END IF;
 -- Read-only accounting users cannot change schedules.
 PERFORM set_config('request.jwt.claim.sub',reviewer::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',reviewer,'role','authenticated','aal','aal2')::text,true);
 blocked:=false;BEGIN PERFORM tw_accounting_schedule_action(c,'toggle',jsonb_build_object('id',s,'version',2));EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Read-only schedule mutation';END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal1')::text,true);
 blocked:=false;BEGIN PERFORM tw_accounting_schedule_action(c,'toggle',jsonb_build_object('id',s,'version',2));EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'MFA bypass';END IF;
 RAISE NOTICE 'PASS: recurring drafts, month anchoring, retry safety, pause, reversal, opening, transfers and MFA';
END $$;
ROLLBACK;
