BEGIN;
DO $$
DECLARE a record; l record; actor uuid; entry_id uuid; prior_paid numeric; before_ids uuid[]; after_ids uuid[]; prior_revenue numeric; fee numeric; denied boolean; payload jsonb;
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE p.is_active AND r.slug='super_admin' LIMIT 1;
 SELECT ci.* INTO a FROM campaign_influencers ci JOIN campaign_lines cl ON cl.id=ci.campaign_line_id
 WHERE coalesce(ci.cost_before_vat,ci.agreed_fee,0)>10
 AND NOT EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=ci.id)
 AND EXISTS(SELECT 1 FROM vendor_ios v WHERE v.assignment_id=ci.id AND v.document_generated_at IS NOT NULL AND NOT coalesce(v.is_superseded,false) AND v.status::text NOT IN ('cancelled','void','voided','rejected')) LIMIT 1;
 IF a.id IS NULL THEN RAISE EXCEPTION 'No fixture'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SELECT * INTO l FROM campaign_lines WHERE id=a.campaign_line_id;
 fee:=l.cost_before_vat;
 SELECT array_agg(id ORDER BY id) INTO before_ids FROM assignment_deliverables WHERE campaign_line_id=l.id;
 UPDATE campaign_lines SET finance_override_until=now()+interval '1 hour',cost_vat_exempt=false,cost_vat_percent=14 WHERE id=l.id;
 IF (SELECT cost_vat_percent FROM campaign_influencers WHERE id=a.id)<>14 THEN RAISE EXCEPTION 'Assignment VAT missing'; END IF;
 IF EXISTS(SELECT 1 FROM assignment_deliverables WHERE campaign_line_id=l.id AND cost_vat_percent<>14) THEN RAISE EXCEPTION 'Deliverable VAT missing'; END IF;
 IF EXISTS(SELECT 1 FROM assignment_post_schedule WHERE campaign_line_id=l.id AND cost_vat_percent<>14) THEN RAISE EXCEPTION 'Post VAT missing'; END IF;
 SELECT array_agg(id ORDER BY id) INTO after_ids FROM assignment_deliverables WHERE campaign_line_id=l.id;
 IF before_ids IS DISTINCT FROM after_ids THEN RAISE EXCEPTION 'Deliverable IDs changed'; END IF;
 payload:=jsonb_build_array(jsonb_build_object('requestId',gen_random_uuid(),'assignmentId',a.id,'creator','VAT regression','fee',fee,'vat',14,'currency',a.currency,'rate',1,'amount',round(fee/2,2),'paymentDate',current_date));
 SET LOCAL ROLE authenticated;
 PERFORM record_creator_payment_series(payload);
 RESET ROLE;
 UPDATE campaign_lines SET cost_vat_percent=5 WHERE id=l.id;
 IF (SELECT vat FROM creator_payment_terms WHERE assignment_id=a.id)<>5 THEN RAISE EXCEPTION 'Terms VAT stale'; END IF;
 IF (SELECT paid FROM creator_payment_balances WHERE assignment_id=a.id)<>round(fee/2,2) THEN RAISE EXCEPTION 'Payment changed'; END IF;
 IF (SELECT total FROM creator_payment_balances WHERE assignment_id=a.id)<>fee+round(fee*.05,2) THEN RAISE EXCEPTION 'Balance not synced'; END IF;
 denied:=false;
 BEGIN UPDATE creator_payment_terms SET vat=7 WHERE assignment_id=a.id; EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Stale draft allowed'; END IF;
 SELECT id INTO entry_id FROM creator_payment_entries WHERE assignment_id=a.id ORDER BY payment_sequence LIMIT 1;
 SET LOCAL ROLE authenticated;
 PERFORM revise_creator_payment(entry_id,0,round(fee/2,2),current_date,true,'Rollback VAT test');
 RESET ROLE;
 UPDATE campaign_lines SET cost_vat_percent=0 WHERE id=l.id;
 IF (SELECT paid FROM creator_payment_balances WHERE assignment_id=a.id)<>0 THEN RAISE EXCEPTION 'Cleared payment counted'; END IF;
 IF NOT EXISTS(SELECT 1 FROM creator_payment_entries WHERE id=entry_id AND cleared_at IS NOT NULL) THEN RAISE EXCEPTION 'History deleted'; END IF;
 UPDATE campaign_lines SET cost_vat_percent=14,vat_locked=true WHERE id=l.id;
 UPDATE campaign_lines SET name=name WHERE id=l.id;
 IF (SELECT cost_vat_amount FROM campaign_lines WHERE id=l.id)<>round(fee*.14,2) THEN RAISE EXCEPTION 'VAT lock erased cost VAT'; END IF;
 UPDATE campaign_lines SET cost_locked=true,finance_override_until=NULL WHERE id=l.id;
 denied:=false;
 BEGIN UPDATE campaign_lines SET cost_vat_percent=7 WHERE id=l.id; EXCEPTION WHEN OTHERS THEN denied:=true; END;
 IF NOT denied THEN RAISE EXCEPTION 'Lock bypassed'; END IF;
 RAISE NOTICE 'PASS: assignment/deliverable/post VAT, stable deliverable IDs, saved payment preservation, balance sync, stale draft and lock guards';
END $$;
ROLLBACK;
