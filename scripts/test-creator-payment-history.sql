BEGIN;
DO $$
DECLARE actor uuid; a record; req uuid:=gen_random_uuid(); req2 uuid:=gen_random_uuid(); payload jsonb; first_amount numeric; total numeric; denied boolean; original_date date:=current_date-1; batch uuid:=gen_random_uuid(); entry uuid:=gen_random_uuid(); io uuid;
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE p.is_active AND r.slug='super_admin' LIMIT 1;
 SELECT ci.* INTO a FROM campaign_influencers ci WHERE coalesce(ci.cost_before_vat,ci.agreed_fee,0)>10
 AND coalesce(ci.vendor_payment_status::text,'unpaid')<>'paid'
 AND NOT EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=ci.id)
 AND EXISTS(SELECT 1 FROM vendor_ios v WHERE v.assignment_id=ci.id AND v.document_generated_at IS NOT NULL AND NOT coalesce(v.is_superseded,false) AND v.status::text NOT IN ('cancelled','void','voided','rejected')) LIMIT 1;
 IF a.id IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'Fixtures unavailable'; END IF;
 total:=round(coalesce(a.cost_before_vat,a.agreed_fee),2); first_amount:=round(total/4,2);
 payload:=jsonb_build_array(jsonb_build_object('assignmentId',a.id,'creator','Synthetic rollback test','fee',total,'vat',0,'currency',a.currency,'rate',1,'amount',first_amount,'paymentDate',original_date));
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SET LOCAL ROLE authenticated;
 PERFORM record_creator_payments(req,payload);
 PERFORM record_creator_payments(req,payload);
 IF (SELECT count(*) FROM creator_payment_entries WHERE assignment_id=a.id)<>1 THEN RAISE EXCEPTION 'Retry duplicated payment'; END IF;
 IF NOT EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=a.id AND payment_sequence=1 AND payment_date=original_date AND status='paid' AND source='manual' AND batch_id IS NULL) THEN RAISE EXCEPTION 'Missing payment metadata'; END IF;
 PERFORM record_creator_payments(req2,payload);
 IF (SELECT sum(original_amount) FROM creator_payment_entries WHERE assignment_id=a.id)<>first_amount*2 OR (SELECT max(payment_sequence) FROM creator_payment_entries WHERE assignment_id=a.id)<>2 THEN RAISE EXCEPTION 'Second payment replaced first'; END IF;
 denied:=false;
 BEGIN PERFORM record_creator_payments(gen_random_uuid(),jsonb_build_array((payload->0)||jsonb_build_object('amount',total))); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Overpayment allowed'; END IF;
 denied:=false;
 BEGIN PERFORM record_creator_payments(gen_random_uuid(),jsonb_build_array((payload->0)||'{"amount":0}')); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Zero payment recorded'; END IF;
 denied:=false;
 BEGIN PERFORM record_creator_payments(req,jsonb_build_array((payload->0)||jsonb_build_object('amount',first_amount+1))); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Retry replaced payment'; END IF;
 denied:=false;
 BEGIN PERFORM record_creator_payments(gen_random_uuid(),jsonb_build_array((payload->0)||jsonb_build_object('paymentDate',current_date+1))); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Future actual payment allowed'; END IF;
 RESET ROLE;
 SELECT id INTO io FROM vendor_ios WHERE assignment_id=a.id AND document_generated_at IS NOT NULL ORDER BY created_at DESC LIMIT 1;
 INSERT INTO creator_payment_exports(id,campaign_id,transfer_date,csv_content,created_by) VALUES(batch,a.campaign_header_id,original_date,'Synthetic rollback only',actor);
 INSERT INTO creator_payment_entries(id,batch_id,campaign_id,assignment_id,io_id,creator_name,original_currency,original_amount,original_total,original_fee,vat_percent,payment_currency,exchange_rate,payment_amount)
 VALUES(entry,batch,a.campaign_header_id,a.id,io,'Synthetic rollback only',a.currency,1,total,total,0,a.currency,1,1);
 SET LOCAL ROLE authenticated;
 IF (SELECT payment_date FROM creator_payment_entries WHERE id=entry) IS DISTINCT FROM original_date THEN RAISE EXCEPTION 'Bank export date not captured'; END IF;
 denied:=false;
 BEGIN PERFORM record_creator_payments(gen_random_uuid(),jsonb_build_array((payload->0)||jsonb_build_object('amount',total-first_amount*2))); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Pending export balance reused'; END IF;
 PERFORM confirm_creator_payment(entry,'paid','Synthetic rollback bank reference');
 IF (SELECT payment_sequence FROM creator_payment_entries WHERE id=entry)<>3 THEN RAISE EXCEPTION 'Bank confirmation not in shared sequence'; END IF;
 PERFORM record_creator_payments(gen_random_uuid(),jsonb_build_array((payload->0)||jsonb_build_object('amount',total-first_amount*2-1)));
 IF (SELECT vendor_payment_status::text FROM campaign_influencers WHERE id=a.id)<>'paid' THEN RAISE EXCEPTION 'Full payment status not updated'; END IF;
 IF (SELECT count(*) FROM creator_payment_entries WHERE assignment_id=a.id)<>4 THEN RAISE EXCEPTION 'History disappeared after fully paid'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 denied:=false;
 BEGIN PERFORM record_creator_payments(gen_random_uuid(),payload); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Unauthenticated payment allowed'; END IF;
 RAISE NOTICE 'PASS: append-only payments, dates, sequences, idempotency, overpayment/zero/future-date rejection, full-paid history and authorization';
END $$;
ROLLBACK;
