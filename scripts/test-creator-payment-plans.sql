BEGIN;
DO $$
DECLARE actor uuid; a uuid; d jsonb; ledger_count integer; denied boolean; batch uuid; campaign uuid; io uuid;
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE p.is_active AND r.slug='super_admin' LIMIT 1;
 SELECT assignment_id INTO a FROM vendor_ios WHERE document_generated_at IS NOT NULL AND NOT coalesce(is_superseded,false) AND status::text NOT IN ('cancelled','void','voided','rejected') LIMIT 1;
 IF actor IS NULL OR a IS NULL THEN RAISE EXCEPTION 'Fixtures unavailable'; END IF;
 SELECT count(*) INTO ledger_count FROM creator_payment_entries;
 d:='{"fee":5000,"vat":0,"currency":"USD","rate":1,"mode":"percent","percent":50,"amount":0}'::jsonb;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SET LOCAL ROLE authenticated;
 PERFORM save_creator_payment_plans(jsonb_build_array(jsonb_build_object('assignmentId',a,'draft',d)));
 IF (SELECT draft->>'percent' FROM creator_payment_plans WHERE assignment_id=a)<>'50' THEN RAISE EXCEPTION 'Plan not persisted'; END IF;
 IF (SELECT count(*) FROM creator_payment_entries)<>ledger_count THEN RAISE EXCEPTION 'Save changed ledger'; END IF;
 denied:=false;
 BEGIN
   PERFORM save_creator_payment_plans(jsonb_build_array(jsonb_build_object('assignmentId',a,'draft',d||'{"percent":150}')));
 EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Invalid percentage accepted'; END IF;
 IF (SELECT draft->>'percent' FROM creator_payment_plans WHERE assignment_id=a)<>'50' THEN RAISE EXCEPTION 'Failed save replaced plan'; END IF;
 denied:=false;
 BEGIN DELETE FROM creator_payment_plans WHERE assignment_id=a; EXCEPTION WHEN insufficient_privilege THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Direct delete allowed'; END IF;
 RESET ROLE;
 SELECT campaign_header_id INTO campaign FROM campaign_influencers WHERE id=a;
 SELECT id INTO io FROM vendor_ios WHERE assignment_id=a LIMIT 1;
 batch:=gen_random_uuid();
 INSERT INTO creator_payment_exports(id,campaign_id,transfer_date,csv_content,created_by) VALUES(batch,campaign,current_date,'Synthetic rollback test',actor);
 INSERT INTO creator_payment_entries(batch_id,campaign_id,assignment_id,io_id,creator_name,original_currency,original_amount,original_total,original_fee,vat_percent,payment_currency,exchange_rate,payment_amount)
 VALUES(batch,campaign,a,io,'Synthetic rollback test','USD',1,5000,5000,0,'USD',1,1);
 IF EXISTS(SELECT 1 FROM creator_payment_plans WHERE assignment_id=a) THEN RAISE EXCEPTION 'Export did not consume plan'; END IF;
 SET LOCAL ROLE authenticated;
 PERFORM set_config('request.jwt.claim.sub','',true);
 denied:=false;
 BEGIN PERFORM save_creator_payment_plans(jsonb_build_array(jsonb_build_object('assignmentId',a,'draft',d))); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Unauthenticated save allowed'; END IF;
 IF EXISTS(SELECT 1 FROM creator_payment_plans) THEN RAISE EXCEPTION 'Unauthenticated read allowed'; END IF;
 RAISE NOTICE 'PASS: explicit save, persisted plan, unchanged ledger on save, invalid input rollback, restricted writes and reads, export consumes plan';
END $$;
ROLLBACK;
