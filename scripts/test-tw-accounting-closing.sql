-- Development only. Every journal, rate, auxiliary, closing and sequence rolls back.
BEGIN;
DO $$
DECLARE actor uuid;viewer uuid;c uuid;y uuid;future uuid;prior uuid;aux uuid;j uuid:=gen_random_uuid();j2 uuid:=gen_random_uuid();close_id uuid;close_j uuid;period uuid;q jsonb;report_before jsonb;report_after jsonb;blocked boolean;
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='super_admin' AND p.is_active LIMIT 1;
 SELECT p.id INTO viewer FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='viewer' AND p.is_active AND NOT EXISTS(SELECT 1 FROM client_users WHERE profile_id=p.id) AND NOT EXISTS(SELECT 1 FROM influencers WHERE profile_id=p.id) LIMIT 1;
 INSERT INTO md_exchange_rates(from_currency,to_currency,exchange_rate,effective_start_date,effective_end_date,is_active,source) VALUES('USD','EGP',50,'2025-02-01','2025-02-01',true,'QA closing rollback');
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 SET LOCAL ROLE authenticated;
 INSERT INTO tw_module_assignments(profile_id,media,accounting_role) VALUES(viewer,false,'manage') ON CONFLICT(profile_id) DO UPDATE SET media=false,accounting_role='manage';
 c:=tw_accounting_create_company('QA fiscal closing rollback','EG','EGP','2025-01-01','[
 {"code":"100000","name":"Assets","parent":null,"type":"Asset","normal":"Debit","kind":"Group"},
 {"code":"111001","name":"Cash","parent":"100000","type":"Asset","normal":"Debit","kind":"Posting"},
 {"code":"300000","name":"Equity","parent":null,"type":"Equity","normal":"Credit","kind":"Group"},
 {"code":"321001","name":"Retained earnings","parent":"300000","type":"Equity","normal":"Credit","kind":"Posting"},
 {"code":"400000","name":"Revenue","parent":null,"type":"Revenue","normal":"Credit","kind":"Group"},
 {"code":"411001","name":"Revenue","parent":"400000","type":"Revenue","normal":"Credit","kind":"Posting"},
 {"code":"600000","name":"Expenses","parent":null,"type":"Expense","normal":"Debit","kind":"Group"},
 {"code":"633001","name":"Depreciation","parent":"600000","type":"Expense","normal":"Debit","kind":"Posting"}]');
 UPDATE tw_accounting_companies SET currencies=ARRAY['EGP','USD'] WHERE id=c;
 UPDATE tw_accounting_accounts SET has_auxiliary=true WHERE company_id=c AND code='633001';
 aux:=tw_accounting_auxiliary_save_numbered(c,'633001',NULL,NULL,'Equipment pool',true,NULL,NULL,1);
 SELECT id INTO y FROM tw_accounting_years WHERE company_id=c;
 future:=tw_accounting_add_year(c,'2026-01-01');
 q:=tw_accounting_closing_preview(c,future);blocked:=false;BEGIN PERFORM tw_accounting_year_action(c,future,'close','321001','Premature close',q->>'snapshot');EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%must end%';END;
 IF NOT blocked OR EXISTS(SELECT 1 FROM tw_accounting_journal_sequences WHERE company_id=c) THEN RAISE EXCEPTION 'Current fiscal year closed or number reserved';END IF;
 prior:=tw_accounting_add_year(c,'2024-01-01');q:=tw_accounting_closing_preview(c,prior);PERFORM tw_accounting_year_action(c,prior,'close','321001','Empty prior year',q->>'snapshot');
 PERFORM tw_accounting_save_journal(j,c,'2025-01-02','','Revenue fixture',NULL,'[{"account":"111001","description":"Cash","debit":"100","credit":"0"},{"account":"411001","description":"Income","debit":"0","credit":"100"}]');PERFORM tw_accounting_post_journal(j,c,1);
 PERFORM tw_accounting_save_workflow(jsonb_build_object('id',j2,'company',c,'date','2025-02-01','reference','','memo','USD expense fixture','lines',jsonb_build_array(jsonb_build_object('account','633001','auxiliaryId',aux,'description','Expense','debit','5000','credit','0','foreignDebit','100','foreignCredit','0','lineCurrency','USD','lineRate','50'),jsonb_build_object('account','111001','description','Cash','debit','0','credit','5000','foreignDebit','0','foreignCredit','100','lineCurrency','USD','lineRate','50'))));
 q:=tw_accounting_closing_preview(c,y);blocked:=false;BEGIN PERFORM tw_accounting_year_action(c,y,'close','321001','Pending journal',q->>'snapshot');EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%pending%';END;
 IF NOT blocked THEN RAISE EXCEPTION 'Pending journal ignored';END IF;
 PERFORM tw_accounting_post_journal(j2,c,(SELECT version FROM tw_accounting_journals WHERE id=j2));
 report_before:=tw_accounting_financial_report(c,'2025-01-01','2025-12-31');
 q:=tw_accounting_closing_preview(c,y);
 blocked:=false;BEGIN PERFORM tw_accounting_year_action(c,y,'close','321001','Stale preview','wrong');EXCEPTION WHEN serialization_failure THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Stale closing accepted';END IF;
 PERFORM set_config('request.jwt.claim.sub',viewer::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','aal','aal2')::text,true);
 blocked:=false;BEGIN PERFORM tw_accounting_year_action(c,y,'close','321001','Unauthorized close',q->>'snapshot');EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Manager closed fiscal year';END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 close_id:=tw_accounting_year_action(c,y,'close','321001','Validated closing',q->>'snapshot');
 SELECT journal_ids[1] INTO close_j FROM tw_accounting_year_closings WHERE id=close_id;
 IF EXISTS(SELECT 1 FROM tw_accounting_periods WHERE year_id=y AND NOT is_closed) THEN RAISE EXCEPTION 'Periods not closed';END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE journal_id=close_j AND account_code='633001' AND auxiliary_id=aux AND credit=5000 AND foreign_credit=100 AND line_currency='USD' AND line_rate=50) THEN RAISE EXCEPTION 'Closing lost FX/auxiliary identity';END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE journal_id=close_j AND account_code='321001' AND debit=4900) OR EXISTS(SELECT 1 FROM tw_accounting_closing_preview(c,y) x WHERE jsonb_array_length(x->'rows')<>0) THEN RAISE EXCEPTION 'Retained earnings or P&L clearance failed';END IF;
 report_after:=tw_accounting_financial_report(c,'2025-01-01','2025-12-31');
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(report_after->'accounts') a WHERE a->>'code'='633001' AND (a->>'debit')::numeric=5000 AND (a->>'closing')::numeric=0) THEN RAISE EXCEPTION 'Closing distorted P&L presentation';END IF;
 SELECT id INTO period FROM tw_accounting_periods WHERE year_id=y AND period_number=12;
 blocked:=false;BEGIN PERFORM tw_accounting_set_period(c,period,false,'Bypass fiscal close',(SELECT version FROM tw_accounting_periods WHERE id=period));EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%fiscal year%';END;
 IF NOT blocked THEN RAISE EXCEPTION 'Closed year period reopened directly';END IF;
 q:=tw_accounting_closing_preview(c,prior);blocked:=false;BEGIN PERFORM tw_accounting_year_action(c,prior,'reopen','321001','Wrong reopen order',q->>'snapshot');EXCEPTION WHEN OTHERS THEN blocked:=SQLERRM LIKE '%later fiscal years%';END;IF NOT blocked THEN RAISE EXCEPTION 'Reopen order bypass';END IF;
 q:=tw_accounting_closing_preview(c,y);PERFORM tw_accounting_year_action(c,y,'reopen','321001','Audit correction',q->>'snapshot');
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_journals WHERE reversal_of=close_j AND status='posted' AND automatic_source='fiscal_reopen') OR EXISTS(SELECT 1 FROM tw_accounting_periods WHERE year_id=y AND is_closed) THEN RAISE EXCEPTION 'Reopening reversal/period restore failed';END IF;
 q:=tw_accounting_closing_preview(c,y);IF jsonb_array_length(q->'rows')<>2 THEN RAISE EXCEPTION 'Reopen did not restore original balances';END IF;
 PERFORM tw_accounting_year_action(c,y,'close','321001','Reclose reviewed year',q->>'snapshot');
 IF (SELECT count(*) FROM tw_accounting_year_closings WHERE company_id=c AND year_id=y)<>2 THEN RAISE EXCEPTION 'Closing history lost';END IF;
 q:=tw_accounting_audit_report(c,'2025-01-01','2026-12-31','',0);IF (q->>'count')::integer=0 THEN RAISE EXCEPTION 'Audit viewer returned no company history';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(q->'rows') a WHERE coalesce(a->'after_data'->>'company_id',a->'before_data'->>'company_id',c::text)<>c::text) THEN RAISE EXCEPTION 'Audit scope leaked company';END IF;
 RAISE NOTICE 'PASS: future/pending/stale/admin guards, closing FX+auxiliary preservation, P&L compatibility, period protection, reversal reopening, reclose and company audit';
END $$;
ROLLBACK;
