-- DEV ONLY. All fixture changes and payment records roll back.
BEGIN;
SET LOCAL statement_timeout='30s';
DO $$
DECLARE a campaign_influencers%ROWTYPE; v vendor_ios%ROWTYPE; actor uuid; before_io jsonb; denied boolean; draft jsonb; n bigint;
BEGIN
 SELECT p.id INTO STRICT actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE p.is_active AND r.slug='super_admin' LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SELECT ci.* INTO STRICT a FROM campaign_influencers ci JOIN campaign_lines l ON l.id=ci.campaign_line_id
 WHERE coalesce(ci.cost_before_vat,ci.agreed_fee,0)>10 AND l.vendor_io_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=ci.id)
 AND EXISTS(SELECT 1 FROM vendor_ios vio WHERE vio.id=l.vendor_io_id AND vio.assignment_id=ci.id AND vio.document_generated_at IS NOT NULL AND NOT vio.is_superseded AND vio.status::text NOT IN ('cancelled','void','voided','rejected')) LIMIT 1;
 SELECT * INTO STRICT v FROM vendor_ios WHERE id=(SELECT vendor_io_id FROM campaign_lines WHERE id=a.campaign_line_id);
 PERFORM reopen_vendor_ios_for_edit(a.campaign_header_id,ARRAY[v.id],'Vendor cost correction');
 SELECT to_jsonb(x) INTO before_io FROM vendor_ios x WHERE id=v.id;
 SELECT count(*) INTO n FROM vendor_ios;
 IF creator_payment_io_eligible(v.id) THEN RAISE EXCEPTION 'Unconfirmed corrected cost was payable'; END IF;
 IF NOT creator_payment_details_updatable(v.id) THEN RAISE EXCEPTION 'Update not available'; END IF;
 denied:=false;
 BEGIN PERFORM update_creator_payment_details(v.id,coalesce(a.cost_before_vat,a.agreed_fee)+1,coalesce(a.cost_vat_percent,0),a.currency); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Stale values accepted'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 denied:=false;
 BEGIN PERFORM update_creator_payment_details(v.id,coalesce(a.cost_before_vat,a.agreed_fee),coalesce(a.cost_vat_percent,0),a.currency); EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Unauthorized update accepted'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SET LOCAL ROLE authenticated;
 PERFORM update_creator_payment_details(v.id,coalesce(a.cost_before_vat,a.agreed_fee),coalesce(a.cost_vat_percent,0),a.currency);
 IF NOT creator_payment_io_eligible(v.id) THEN RAISE EXCEPTION 'Confirmation did not enable payment'; END IF;
 RESET ROLE;
 IF before_io IS DISTINCT FROM (SELECT to_jsonb(x) FROM vendor_ios x WHERE id=v.id) OR n<>(SELECT count(*) FROM vendor_ios) THEN RAISE EXCEPTION 'Original IO changed or new IO created'; END IF;
 UPDATE creator_payment_detail_confirmations SET fee=fee+1 WHERE assignment_id=a.id;
 IF creator_payment_io_eligible(v.id) THEN RAISE EXCEPTION 'Stale confirmation remained valid'; END IF;
 UPDATE creator_payment_detail_confirmations SET fee=fee-1 WHERE assignment_id=a.id;
 draft:=jsonb_build_object('mode','manual','currency',a.currency,'fee',coalesce(a.cost_before_vat,a.agreed_fee),'vat',coalesce(a.cost_vat_percent,0),'percent',100,'rate',1,'amount',1);
 SET LOCAL ROLE authenticated;
 PERFORM save_creator_payment_plans(jsonb_build_array(jsonb_build_object('assignmentId',a.id,'draft',draft)));
 denied:=false;
 BEGIN
   PERFORM create_creator_payment_export(gen_random_uuid(),a.campaign_header_id,(now() AT TIME ZONE 'Africa/Cairo')::date,'development rollback only',
     jsonb_build_array(draft||jsonb_build_object('assignmentId',a.id,'ioId',v.id,'nickname','__invalid_test_nickname__')));
 EXCEPTION WHEN OTHERS THEN
   IF SQLERRM NOT IN ('Confirm AAIB beneficiary registration first','Bank details changed; refresh before exporting') THEN RAISE; END IF;
   denied:=true;
 END;
 IF NOT denied THEN RAISE EXCEPTION 'Export bank checks bypassed'; END IF;
 PERFORM record_creator_payments(gen_random_uuid(),jsonb_build_array(draft||jsonb_build_object('assignmentId',a.id,'creator','Development rollback test','paymentDate',current_date)));
 RESET ROLE;
 IF NOT EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=a.id AND original_amount=1) THEN RAISE EXCEPTION 'Payment not recorded'; END IF;
 IF before_io IS DISTINCT FROM (SELECT to_jsonb(x) FROM vendor_ios x WHERE id=v.id) THEN RAISE EXCEPTION 'Payment changed original IO'; END IF;
 RAISE NOTICE 'PASS: permissions, stale values, confirmation, IO preservation, plan and payment';
END $$;
ROLLBACK;

