BEGIN;
DO $$
DECLARE actor uuid; a record; v uuid; payment uuid; proof uuid:=gen_random_uuid(); req uuid:=gen_random_uuid(); denied boolean; total numeric; vat numeric; old_paid numeric;
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE p.is_active AND r.slug='super_admin' LIMIT 1;
 SELECT ci.* INTO a FROM campaign_influencers ci WHERE coalesce(ci.cost_before_vat,ci.agreed_fee,0)>10
 AND coalesce(ci.vendor_payment_status::text,'unpaid')<>'paid'
 AND NOT EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=ci.id)
 AND EXISTS(SELECT 1 FROM vendor_ios v WHERE v.assignment_id=ci.id AND NOT coalesce(v.is_superseded,false) AND v.status::text NOT IN ('cancelled','void','voided','rejected')) LIMIT 1;
 IF a.id IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'Fixtures unavailable'; END IF;
 SELECT id INTO v FROM vendor_ios WHERE assignment_id=a.id AND NOT coalesce(is_superseded,false) ORDER BY created_at DESC,id DESC LIMIT 1;
 UPDATE vendor_ios SET document_generated_at=NULL,sent_at=now() WHERE id=v;
 IF public.vendor_io_has_issue_evidence(NULL,NULL,NULL,NULL) THEN RAISE EXCEPTION 'Unissued IO qualifies'; END IF;
 IF NOT public.vendor_io_has_issue_evidence(NULL,now(),NULL,NULL) THEN RAISE EXCEPTION 'Sent IO does not qualify'; END IF;
 IF NOT public.vendor_io_has_issue_evidence(NULL,NULL,now(),NULL) THEN RAISE EXCEPTION 'Manual delivery does not qualify'; END IF;
 total:=round(coalesce(a.cost_before_vat,a.agreed_fee),2); vat:=coalesce(a.cost_vat_percent,0);
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SET LOCAL ROLE authenticated;
 PERFORM record_creator_payments(req,jsonb_build_array(jsonb_build_object('assignmentId',a.id,'creator','Rollback proof test','fee',total,'vat',vat,'currency',a.currency,'rate',1,'amount',1,'paymentDate',current_date-1)));
 SELECT id INTO payment FROM creator_payment_entries WHERE assignment_id=a.id AND status='paid';
 IF payment IS NULL THEN RAISE EXCEPTION 'Delivered IO cannot record payment without cached document timestamp'; END IF;
 INSERT INTO creator_payment_proofs(id,payment_id,file_name,storage_path,mime_type,byte_size)
 VALUES(proof,payment,'test.pdf',payment::text||'/'||proof::text||'.pdf','application/pdf',100);
 IF NOT public.can_access_creator_payment_proof(payment::text||'/'||proof::text||'.pdf',true) THEN RAISE EXCEPTION 'Authorized proof upload denied'; END IF;
 IF public.can_access_creator_payment_proof('unregistered.pdf',false) THEN RAISE EXCEPTION 'Unregistered object readable'; END IF;
 UPDATE creator_payment_proofs SET uploaded_at=now() WHERE id=proof;
 IF public.can_access_creator_payment_proof(payment::text||'/'||proof::text||'.pdf',true) THEN RAISE EXCEPTION 'Uploaded proof overwritable'; END IF;
 UPDATE creator_payment_proofs SET removed_at=now() WHERE id=proof;
 IF public.can_access_creator_payment_proof(payment::text||'/'||proof::text||'.pdf',false) THEN RAISE EXCEPTION 'Removed proof readable'; END IF;
 IF (SELECT payment_amount FROM creator_payment_entries WHERE id=payment)<>1 THEN RAISE EXCEPTION 'Proof changed payment amount'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 IF EXISTS(SELECT 1 FROM creator_payment_proofs WHERE id=proof) THEN RAISE EXCEPTION 'Proof visible without user'; END IF;
 RESET ROLE;
END $$;
ROLLBACK;
\echo 'PASS: delivered IO eligibility, proof isolation, immutable uploaded object, removal, unchanged payment and auth guard'
