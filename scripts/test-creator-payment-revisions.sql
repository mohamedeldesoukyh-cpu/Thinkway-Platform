BEGIN;
DO $$
DECLARE actor uuid; a record; payload jsonb; total numeric; part numeric; one uuid; two uuid; three uuid; denied boolean;
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE p.is_active AND r.slug='super_admin' LIMIT 1;
 SELECT ci.* INTO a FROM campaign_influencers ci WHERE coalesce(ci.cost_before_vat,ci.agreed_fee,0)>10
 AND coalesce(ci.vendor_payment_status::text,'unpaid')<>'paid' AND NOT EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=ci.id)
 AND EXISTS(SELECT 1 FROM vendor_ios v WHERE v.assignment_id=ci.id AND v.document_generated_at IS NOT NULL AND NOT coalesce(v.is_superseded,false) AND v.status::text NOT IN ('cancelled','void','voided','rejected')) LIMIT 1;
 IF actor IS NULL OR a.id IS NULL THEN RAISE EXCEPTION 'Fixtures unavailable'; END IF;
 total:=round(coalesce(a.cost_before_vat,a.agreed_fee),2);part:=round(total/5,2);
 SELECT jsonb_agg(jsonb_build_object('requestId',gen_random_uuid(),'assignmentId',a.id,'creator','Synthetic rollback test','fee',total,'vat',0,'currency',a.currency,'rate',1,'amount',part,'paymentDate',current_date-i)) INTO payload FROM generate_series(1,3) i;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SET LOCAL ROLE authenticated;
 PERFORM record_creator_payment_series(payload);
 PERFORM record_creator_payment_series(payload);
 IF (SELECT count(*) FROM creator_payment_entries WHERE assignment_id=a.id)<>3 THEN RAISE EXCEPTION 'Series duplicated or lost records'; END IF;
 SELECT id INTO one FROM creator_payment_entries WHERE assignment_id=a.id AND payment_sequence=1;
 SELECT id INTO two FROM creator_payment_entries WHERE assignment_id=a.id AND payment_sequence=2;
 SELECT id INTO three FROM creator_payment_entries WHERE assignment_id=a.id AND payment_sequence=3;
 PERFORM revise_creator_payment(two,0,part/2,current_date-4,false,'Correct second amount');
 IF (SELECT original_amount FROM creator_payment_entries WHERE id=one)<>part OR (SELECT original_amount FROM creator_payment_entries WHERE id=three)<>part THEN RAISE EXCEPTION 'Revision affected siblings'; END IF;
 PERFORM revise_creator_payment(two,1,part/2,current_date-4,true,'Wrong creator payment');
 IF (SELECT paid FROM creator_payment_balances WHERE assignment_id=a.id)<>part*2 THEN RAISE EXCEPTION 'Cleared payment still included'; END IF;
 IF NOT EXISTS(SELECT 1 FROM creator_payment_entries WHERE id=two AND cleared_at IS NOT NULL AND payment_sequence=2) THEN RAISE EXCEPTION 'Cleared history lost'; END IF;
 IF (SELECT count(*) FROM creator_payment_revisions WHERE entry_id=two)<>2 THEN RAISE EXCEPTION 'Audit missing'; END IF;
 denied:=false;
 BEGIN PERFORM revise_creator_payment(one,1,part,current_date,false,'Stale correction'); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Stale revision allowed'; END IF;
 denied:=false;
 BEGIN PERFORM revise_creator_payment(one,0,total,current_date,false,'Overpayment'); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Overpayment allowed'; END IF;
 denied:=false;
 BEGIN PERFORM record_creator_payment_series(jsonb_build_array((payload->0)||jsonb_build_object('requestId',gen_random_uuid()),(payload->0)||jsonb_build_object('requestId',gen_random_uuid(),'amount',total))); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied OR (SELECT count(*) FROM creator_payment_entries WHERE assignment_id=a.id)<>3 THEN RAISE EXCEPTION 'Failed series partially saved'; END IF;
 PERFORM revise_creator_payment(one,0,part,current_date,true,'Clear first');
 PERFORM revise_creator_payment(three,0,part,current_date,true,'Clear third');
 IF (SELECT paid FROM creator_payment_balances WHERE assignment_id=a.id)<>0 OR (SELECT vendor_payment_status::text FROM campaign_influencers WHERE id=a.id)<>'unpaid' THEN RAISE EXCEPTION 'Clearing all did not reset balance'; END IF;
 PERFORM record_creator_payment_series(jsonb_build_array((payload->0)||jsonb_build_object('requestId',gen_random_uuid())));
 IF (SELECT max(payment_sequence) FROM creator_payment_entries WHERE assignment_id=a.id)<>4 THEN RAISE EXCEPTION 'Cleared sequence reused'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 denied:=false;
 BEGIN PERFORM revise_creator_payment(one,0,part,current_date,true,'Unauthorized'); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Unauthorized correction allowed'; END IF;
 RAISE NOTICE 'PASS: multi-payment retry, atomicity, independent edit/clear, balance reset, audit, sequence preservation and access checks';
END $$;
ROLLBACK;
