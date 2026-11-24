BEGIN;
DO $$
DECLARE actor uuid;other_actor uuid;c uuid;y uuid;r uuid:=gen_random_uuid();blocked boolean;
BEGIN
 SELECT p.id INTO STRICT actor FROM profiles p JOIN roles ro ON ro.id=p.role_id WHERE ro.slug='super_admin' AND p.is_active LIMIT 1;
 SELECT id INTO STRICT other_actor FROM profiles WHERE id<>actor LIMIT 1;
 SELECT company_id,id INTO STRICT c,y FROM tw_accounting_years LIMIT 1;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 SET LOCAL ROLE authenticated;
 INSERT INTO tw_finance_saved_reports(id,company_id,year_id,name,plan) VALUES(r,c,y,'Rollback fixture','{"action":"custom_ledger"}');
 IF NOT EXISTS(SELECT 1 FROM tw_finance_saved_reports WHERE id=r) THEN RAISE EXCEPTION 'Owner cannot read saved report';END IF;
 blocked:=false;BEGIN INSERT INTO tw_finance_saved_reports(owner_id,company_id,year_id,name,plan) VALUES(other_actor,c,y,'Forged owner','{"action":"custom_ledger"}');EXCEPTION WHEN insufficient_privilege THEN blocked:=true;END;
 IF NOT blocked THEN RAISE EXCEPTION 'Forged ownership accepted';END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',other_actor,'role','authenticated','aal','aal2')::text,true);
 IF EXISTS(SELECT 1 FROM tw_finance_saved_reports WHERE id=r) THEN RAISE EXCEPTION 'Another user can read private report definition';END IF;
 DELETE FROM tw_finance_saved_reports WHERE id=r;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
 IF NOT EXISTS(SELECT 1 FROM tw_finance_saved_reports WHERE id=r) THEN RAISE EXCEPTION 'Another user deleted saved report';END IF;
 RAISE NOTICE 'Saved report owner isolation and ownership checks passed';
END $$;
ROLLBACK;
