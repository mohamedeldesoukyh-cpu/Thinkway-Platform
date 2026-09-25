BEGIN;
DO $$
DECLARE actor uuid; a campaign_influencers; total_paid numeric; entry_count integer; failed boolean; n text:='ROLLBACK-'||gen_random_uuid();
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE p.is_active AND r.slug='super_admin' LIMIT 1;
 SELECT ci.* INTO a FROM campaign_influencers ci JOIN campaign_lines l ON l.id=ci.campaign_line_id WHERE l.cost_before_vat>0 AND ci.cost_vat_percent=0 AND ci.vendor_payment_status<>'paid' AND EXISTS(SELECT 1 FROM vendor_ios v WHERE v.assignment_id=ci.id AND v.document_generated_at IS NOT NULL AND NOT v.is_superseded) AND NOT EXISTS(SELECT 1 FROM creator_payment_entries e WHERE e.assignment_id=ci.id AND e.status='exported') AND NOT EXISTS(SELECT 1 FROM creator_supplier_invoices i WHERE i.assignment_id=ci.id) LIMIT 1;
 IF a.id IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'Missing paid assignment test fixture'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 IF NOT EXISTS(SELECT 1 FROM creator_payment_entries WHERE assignment_id=a.id) THEN
 PERFORM record_creator_payments(gen_random_uuid(),jsonb_build_array(jsonb_build_object('assignmentId',a.id,'creator','Rollback fixture','fee',a.cost_before_vat,'vat',0,'currency',a.currency,'rate',1,'amount',1,'paymentDate',CURRENT_DATE-60)));
 END IF;
 SELECT count(*),coalesce(sum(original_amount) FILTER(WHERE status='paid' AND cleared_at IS NULL),0) INTO entry_count,total_paid FROM creator_payment_entries WHERE assignment_id=a.id;
 UPDATE campaign_lines SET finance_override_until=now()+interval '5 minutes' WHERE id=a.campaign_line_id;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);SET LOCAL ROLE authenticated;
 PERFORM save_creator_payment_invoice(a.id,n,CURRENT_DATE-50,'EG',true,0,0);
 IF NOT EXISTS(SELECT 1 FROM campaign_influencers WHERE id=a.id AND cost_vat_percent=14 AND cost_after_vat=cost_before_vat+round(cost_before_vat*.14,2)) THEN RAISE EXCEPTION 'Assignment VAT not synchronized'; END IF;
 IF NOT EXISTS(SELECT 1 FROM creator_supplier_invoices WHERE assignment_id=a.id AND invoice_number=n AND invoice_date=CURRENT_DATE-50 AND vat_amount=round(a.cost_before_vat*.14,2) AND confirmed) THEN RAISE EXCEPTION 'Historical invoice not stored'; END IF;
 IF (SELECT count(*) FROM creator_payment_entries WHERE assignment_id=a.id)<>entry_count OR (SELECT coalesce(sum(original_amount) FILTER(WHERE status='paid' AND cleared_at IS NULL),0) FROM creator_payment_entries WHERE assignment_id=a.id)<>total_paid THEN RAISE EXCEPTION 'Payment history changed'; END IF;
 failed:=false;BEGIN PERFORM save_creator_payment_invoice(a.id,n,CURRENT_DATE-50,'EG',false,0,0);EXCEPTION WHEN OTHERS THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Stale update accepted';END IF;
 PERFORM save_creator_payment_invoice(a.id,n,CURRENT_DATE-50,'EG',false,1,14);
 IF NOT EXISTS(SELECT 1 FROM creator_supplier_invoices WHERE assignment_id=a.id AND revision=2 AND vat_amount=0) THEN RAISE EXCEPTION 'No VAT update failed';END IF;
 failed:=false;BEGIN PERFORM save_creator_payment_invoice(a.id,n,NULL,'EG',true,2,0);EXCEPTION WHEN OTHERS THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Missing invoice date accepted';END IF;
 PERFORM update_creator_invoice_details((SELECT id FROM creator_supplier_invoices WHERE assignment_id=a.id AND from_payment_register),2,jsonb_build_object('supplier_name','Verified legal name','supplier_address','Test address','tax_registration_number','TEST','description','Services','notes','Metadata only'));
 IF NOT EXISTS(SELECT 1 FROM creator_supplier_invoices WHERE assignment_id=a.id AND revision=3 AND vat_amount=0 AND supplier_name='Verified legal name') THEN RAISE EXCEPTION 'Metadata update failed';END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);failed:=false;BEGIN PERFORM save_creator_payment_invoice(a.id,n,CURRENT_DATE,'EG',true,2,0);EXCEPTION WHEN OTHERS THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Unauthorized update accepted';END IF;
 RAISE NOTICE 'PASS: paid assignment invoice, 14 percent VAT totals, historical date, unchanged payment ledger, No VAT, stale/date/auth guards';
END $$;
ROLLBACK;
