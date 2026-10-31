-- Development integration: uses existing unpaid invoiced fixture; all changes roll back.
BEGIN;
DO $$
DECLARE l campaign_lines%ROWTYPE; a campaign_influencers%ROWTYPE; new_io uuid; payment uuid; other_payment uuid; invoice_before jsonb; denied boolean;
BEGIN
 SELECT c.* INTO STRICT l FROM campaign_lines c JOIN vendor_ios v ON v.id=c.vendor_io_id
 WHERE c.invoice_id IS NOT NULL AND c.status<>'cancelled' AND NOT v.is_superseded
 AND NOT assignment_vendor_payment_locked(c.id)
 AND EXISTS(SELECT 1 FROM campaign_influencers WHERE campaign_line_id=c.id)
 AND NOT EXISTS(SELECT 1 FROM vendor_credit_notes WHERE vendor_io_id=v.id)
 AND NOT EXISTS(SELECT 1 FROM vendor_debit_notes WHERE vendor_io_id=v.id)
 LIMIT 1 FOR UPDATE OF c;
 PERFORM set_config('request.jwt.claim.sub',l.created_by::text,true);
 SELECT to_jsonb(i) INTO invoice_before FROM invoices i WHERE id=l.invoice_id;
 IF (SELECT cost_locked FROM assignment_document_locks(l.id)) THEN RAISE EXCEPTION 'Unpaid cost incorrectly locked'; END IF;
 PERFORM update_unpaid_vendor_cost(l.id,l.cost_before_vat+1,coalesce(l.usage_rights_cost,0),0);
 IF (SELECT invoice_id FROM campaign_lines WHERE id=l.id) IS DISTINCT FROM l.invoice_id THEN RAISE EXCEPTION 'Invoice link changed'; END IF;
 IF (SELECT to_jsonb(i) FROM invoices i WHERE id=l.invoice_id) IS DISTINCT FROM invoice_before THEN RAISE EXCEPTION 'Client invoice changed'; END IF;
 new_io:=regenerate_reopened_vendor_io(l.vendor_io_id);
 SELECT * INTO STRICT a FROM campaign_influencers WHERE campaign_line_id=l.id LIMIT 1;
 INSERT INTO creator_payment_entries(campaign_id,assignment_id,io_id,creator_name,original_currency,original_amount,original_total,original_fee,vat_percent,payment_currency,exchange_rate,payment_amount,status,source,payment_date)
 VALUES(l.campaign_header_id,a.id,new_io,'Payment lock regression',a.currency,1,1000000,1000000,0,a.currency,1,1,'paid','manual',(now() AT TIME ZONE 'Africa/Cairo')::date) RETURNING id INTO payment;
 IF NOT (SELECT cost_locked FROM assignment_document_locks(l.id)) THEN RAISE EXCEPTION 'Partial payment did not lock cost'; END IF;
 denied:=false;
 BEGIN PERFORM update_unpaid_vendor_cost(l.id,l.cost_before_vat+2,0,0); EXCEPTION WHEN OTHERS THEN denied:=SQLERRM LIKE '%payment%'; END;
 IF NOT denied THEN RAISE EXCEPTION 'Paid cost edit not blocked'; END IF;
 denied:=false;
 BEGIN PERFORM reopen_vendor_ios_for_edit(l.campaign_header_id,ARRAY[new_io],'Regression paid reopen'); EXCEPTION WHEN OTHERS THEN denied:=SQLERRM LIKE '%payment%'; END;
 IF NOT denied THEN RAISE EXCEPTION 'Paid IO reopen not blocked'; END IF;
 denied:=false;
 BEGIN UPDATE vendor_ios SET amount=amount+1 WHERE id=new_io; EXCEPTION WHEN OTHERS THEN denied:=SQLERRM LIKE '%payment%'; END;
 IF NOT denied THEN RAISE EXCEPTION 'Direct paid IO edit not blocked'; END IF;
 INSERT INTO creator_payment_entries(campaign_id,assignment_id,io_id,creator_name,original_currency,original_amount,original_total,original_fee,vat_percent,payment_currency,exchange_rate,payment_amount,status,source,payment_date)
 VALUES(l.campaign_header_id,a.id,new_io,'Second lock regression',a.currency,1,1000000,1000000,0,a.currency,1,1,'paid','manual',(now() AT TIME ZONE 'Africa/Cairo')::date) RETURNING id INTO other_payment;
 PERFORM revise_creator_payment(payment,0,0,(now() AT TIME ZONE 'Africa/Cairo')::date,true,'Regression zero payment');
 IF NOT (SELECT cost_locked FROM assignment_document_locks(l.id)) THEN RAISE EXCEPTION 'Other payment failed to retain lock'; END IF;
 PERFORM revise_creator_payment(other_payment,0,0,(now() AT TIME ZONE 'Africa/Cairo')::date,true,'Regression zero final payment');
 IF (SELECT cost_locked FROM assignment_document_locks(l.id)) THEN RAISE EXCEPTION 'Zero payment did not unlock cost'; END IF;
 PERFORM update_unpaid_vendor_cost(l.id,l.cost_before_vat+3,0,0);
 IF (SELECT to_jsonb(i) FROM invoices i WHERE id=l.invoice_id) IS DISTINCT FROM invoice_before THEN RAISE EXCEPTION 'Invoice changed after correction'; END IF;
 PERFORM apply_assignment_commercial_cost(l.id,jsonb_build_object('cost_before_vat',l.cost_before_vat+4));
 RAISE NOTICE 'PASS: invoice preserved; unpaid edit/reopen/regenerate; partial payment blocks; zero unlocks';
END $$;

ROLLBACK;