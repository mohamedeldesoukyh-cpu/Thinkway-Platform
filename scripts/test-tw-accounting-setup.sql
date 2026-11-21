-- Development only: all fixture writes and permission changes are rolled back.
BEGIN;
DO $$
DECLARE actor uuid; viewer uuid; c uuid; c2 uuid; y uuid; n integer; blocked boolean;
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='super_admin' AND p.is_active LIMIT 1;
 SELECT p.id INTO viewer FROM profiles p JOIN roles r ON r.id=p.role_id WHERE r.slug='viewer' AND p.is_active
 AND NOT EXISTS(SELECT 1 FROM client_users WHERE profile_id=p.id) AND NOT EXISTS(SELECT 1 FROM influencers WHERE profile_id=p.id) LIMIT 1;
 IF actor IS NULL OR viewer IS NULL THEN RAISE EXCEPTION 'Dev test actors missing'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 SET LOCAL ROLE authenticated;
 c:=tw_accounting_create_company('QA rollback accounting','EG','EGP','2026-01-01','[
 {"code":"100000","name":"Assets","parent":null,"type":"Asset","normal":"Debit","kind":"Group"},
 {"code":"110000","name":"Cash group","parent":"100000","type":"Asset","normal":"Debit","kind":"Group"},
 {"code":"110001","name":"Cash","parent":"110000","type":"Asset","normal":"Debit","kind":"Posting"}]');
 SELECT id INTO y FROM tw_accounting_years WHERE company_id=c;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_years WHERE id=y AND start_date='2026-01-01' AND end_date='2026-12-31') THEN RAISE EXCEPTION 'Wrong year'; END IF;
 SELECT count(*) INTO n FROM tw_accounting_periods WHERE year_id=y;
 IF n<>12 THEN RAISE EXCEPTION 'Expected 12 periods'; END IF;
 UPDATE tw_accounting_accounts SET name='Cash revised' WHERE company_id=c AND code='110001' AND version=1;
 UPDATE tw_accounting_accounts SET name='Stale write' WHERE company_id=c AND code='110001' AND version=1;
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Stale update was accepted'; END IF;
 blocked:=false; BEGIN UPDATE tw_accounting_accounts SET parent_code='110000' WHERE company_id=c AND code='100000'; EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Cycle accepted'; END IF;
 blocked:=false; BEGIN UPDATE tw_accounting_accounts SET active=false WHERE company_id=c AND code='110000'; EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Parent deactivation accepted'; END IF;
 blocked:=false; BEGIN UPDATE tw_accounting_accounts SET code='110002' WHERE company_id=c AND code='110001'; EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Code mutation accepted'; END IF;
 blocked:=false; BEGIN UPDATE tw_accounting_accounts SET kind='Control' WHERE company_id=c AND code='110001'; EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Missing subledger accepted'; END IF;
 blocked:=false; BEGIN UPDATE tw_accounting_companies SET base_currency='USD',currencies=ARRAY['USD'] WHERE id=c; EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Base currency mutation accepted'; END IF;
 blocked:=false; BEGIN PERFORM tw_accounting_add_year(c,'2026-01-01'); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Duplicate year accepted'; END IF;
 blocked:=false; BEGIN PERFORM tw_accounting_add_year(c,'2027-02-01'); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Wrong calendar accepted'; END IF;
 blocked:=false; BEGIN INSERT INTO tw_accounting_periods(year_id,period_number,start_date,end_date) VALUES(y,1,'2026-01-01','2026-01-31'); EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Direct period insert accepted'; END IF;
 PERFORM tw_accounting_add_year(c,'2027-01-01');
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_audit WHERE after_data->>'company_id'=c::text AND table_name='tw_accounting_accounts') THEN RAISE EXCEPTION 'Audit missing'; END IF;
 INSERT INTO tw_module_assignments(profile_id,media,accounting_role) VALUES(viewer,false,'read')
 ON CONFLICT(profile_id) DO UPDATE SET media=false,accounting_role='read';
 PERFORM set_config('request.jwt.claim.sub',viewer::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','aal','aal2')::text,true);
 IF (tw_module_access()->>'media')::boolean OR NOT (tw_module_access()->>'accounting')::boolean THEN RAISE EXCEPTION 'Incorrect assignment'; END IF;
 SELECT count(*) INTO n FROM tw_accounting_accounts WHERE company_id=c;
 IF n<>3 THEN RAISE EXCEPTION 'Reader cannot read'; END IF;
 UPDATE tw_accounting_accounts SET name='Unauthorized' WHERE company_id=c;
 GET DIAGNOSTICS n = ROW_COUNT;
 IF n<>0 THEN RAISE EXCEPTION 'Reader can write'; END IF;
 SELECT count(*) INTO n FROM clients;
 IF n<>0 OR tw_media_data_access() THEN RAISE EXCEPTION 'Accounting-only can read media'; END IF;
 blocked:=false; BEGIN PERFORM tw_accounting_add_year(c,'2028-01-01'); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Reader can create years'; END IF;
 blocked:=false; BEGIN DELETE FROM tw_module_assignments WHERE profile_id=viewer; EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Assignment delete accepted'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 UPDATE tw_module_assignments SET accounting_role='manage' WHERE profile_id=viewer;
 PERFORM set_config('request.jwt.claim.sub',viewer::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','aal','aal1')::text,true);
 blocked:=false; BEGIN PERFORM tw_accounting_add_year(c,'2028-01-01'); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'AAL1 manager can write'; END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',viewer,'role','authenticated','aal','aal2')::text,true);
 PERFORM tw_accounting_add_year(c,'2028-01-01');
 RAISE NOTICE 'PASS: fiscal dates, 12 periods, hierarchy, immutable codes/currency, concurrency versions, audit, reader/manager access, Media isolation, MFA and calendar RPC boundary';
END $$;
ROLLBACK;
