-- Development only. Isolated cloned fixtures and every write rolled back.
BEGIN;
SET LOCAL statement_timeout='30s';
SET LOCAL lock_timeout='5s';
DO $$
DECLARE l campaign_lines%ROWTYPE; a campaign_influencers%ROWTYPE; v vendor_ios%ROWTYPE;
 actor uuid; entry uuid; export_entry uuid; original jsonb; restored jsonb; next_io uuid; blocked boolean;
BEGIN
 SELECT p.id INTO STRICT actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE p.is_active AND r.slug='super_admin' LIMIT 1;
 SELECT * INTO STRICT l FROM campaign_lines WHERE vendor_io_id IS NOT NULL LIMIT 1;
 SELECT * INTO STRICT v FROM vendor_ios WHERE id=l.vendor_io_id;
 SELECT * INTO STRICT a FROM campaign_influencers WHERE id=v.assignment_id;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 l:=jsonb_populate_record(l,jsonb_build_object('id',gen_random_uuid(),'currency_code','EGP','cost_received_currency','EGP','revenue_fx_override',NULL,'cost_fx_override',NULL,'document_number','QA-PAYMENT-HOLD','vendor_io_id',NULL,'invoice_id',NULL,'operational_status','draft','billing_status','draft','status','draft','cost_locked',false,'revenue_locked',false,'vat_locked',false,'vendor_assignment_locked',false,'revenue',1000,'revenue_before_vat',1000,'usage_rights_amount',0,'usage_rights_cost',0,'agency_fee_percent',0,'cost',1000,'cost_before_vat',1000,'cost_received',1000,'cost_vat_percent',0,'metadata',coalesce(l.metadata,'{}'::jsonb)-'pending_vendor_io_id'));
 INSERT INTO campaign_lines SELECT l.*;
 a:=jsonb_populate_record(a,jsonb_build_object('id',gen_random_uuid(),'campaign_line_id',l.id,'merge_record_key',gen_random_uuid(),'vendor_payment_status','unpaid','currency','EGP','agreed_fee',1000,'cost_before_vat',1000,'cost_vat_percent',0));
 INSERT INTO campaign_influencers SELECT a.*;
 v:=jsonb_populate_record(v,jsonb_build_object('id',gen_random_uuid(),'assignment_id',a.id,'document_number','QA-PAYMENT-HOLD','currency_code','EGP','amount',1000,'root_vendor_io_id',NULL,'replaces_vendor_io_id',NULL,'is_superseded',false,'revision_number',0,'status','generated'));
 INSERT INTO vendor_ios SELECT v.*;
 UPDATE campaign_lines SET vendor_io_id=v.id,operational_status='io_generated',billing_status='moved_to_billing' WHERE id=l.id;
 INSERT INTO vendor_io_lines(vendor_io_id,campaign_line_id) VALUES(v.id,l.id);
 INSERT INTO creator_payment_entries(campaign_id,assignment_id,io_id,creator_name,original_currency,original_amount,original_total,original_fee,vat_percent,payment_currency,exchange_rate,payment_amount,status,source,payment_date,bank_reference)
 VALUES(l.campaign_header_id,a.id,v.id,'QA rollback fixture','EGP',200,1000,1000,0,'EGP',1,200,'paid','manual',current_date-1,'QA retained reference') RETURNING id INTO entry;
 SELECT to_jsonb(e)-'revision'-'status' INTO original FROM creator_payment_entries e WHERE id=entry;
 IF NOT assignment_vendor_payment_locked(l.id) THEN RAISE EXCEPTION 'Payment failed to lock cost'; END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);
 blocked:=false;
 BEGIN PERFORM set_creator_payment_cost_pending(ARRAY[a.id],true); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Unauthorized hold allowed'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 INSERT INTO creator_payment_entries(campaign_id,assignment_id,io_id,creator_name,original_currency,original_amount,original_total,original_fee,vat_percent,payment_currency,exchange_rate,payment_amount,status,source,payment_date)
 VALUES(l.campaign_header_id,a.id,v.id,'QA rollback export','EGP',10,1000,1000,0,'EGP',1,10,'exported','manual',current_date) RETURNING id INTO export_entry;
 blocked:=false;
 BEGIN PERFORM set_creator_payment_cost_pending(ARRAY[a.id],true); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Pending export allowed hold'; END IF;
 DELETE FROM creator_payment_entries WHERE id=export_entry;
 PERFORM set_creator_payment_cost_pending(ARRAY[a.id],true);
 PERFORM set_creator_payment_cost_pending(ARRAY[a.id],true);
 IF assignment_vendor_payment_locked(l.id) THEN RAISE EXCEPTION 'Pending failed to unlock'; END IF;
 IF (SELECT revision FROM creator_payment_entries WHERE id=entry)<>1 THEN RAISE EXCEPTION 'Retry changed payment twice'; END IF;
 blocked:=false;
 BEGIN UPDATE creator_payment_entries SET payment_amount=300 WHERE id=entry; EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Held payment edit allowed'; END IF;
 blocked:=false;
 BEGIN
 INSERT INTO creator_payment_entries(campaign_id,assignment_id,io_id,creator_name,original_currency,original_amount,original_total,original_fee,vat_percent,payment_currency,exchange_rate,payment_amount,status,source,payment_date)
 VALUES(l.campaign_header_id,a.id,v.id,'QA blocked insert','EGP',10,1000,1000,0,'EGP',1,10,'exported','manual',current_date);
 EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'New payment/export allowed during hold'; END IF;
 blocked:=false;
 BEGIN UPDATE campaign_influencers SET currency='USD' WHERE id=a.id; EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Currency changed during revision'; END IF;
 PERFORM update_reopened_vendor_cost_side(l.campaign_header_id,l.id,'EGP',150,0,0,NULL);
 blocked:=false;
 BEGIN PERFORM set_creator_payment_cost_pending(ARRAY[a.id],false); EXCEPTION WHEN OTHERS THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Restored before regenerating revised IO'; END IF;
 next_io:=regenerate_reopened_vendor_io(v.id);
 PERFORM set_creator_payment_cost_pending(ARRAY[a.id],false);
 PERFORM set_creator_payment_cost_pending(ARRAY[a.id],false);
 SELECT to_jsonb(e)-'revision'-'status' INTO restored FROM creator_payment_entries e WHERE id=entry;
 IF restored IS DISTINCT FROM original THEN RAISE EXCEPTION 'Original payment details changed'; END IF;
 IF (SELECT status FROM creator_payment_entries WHERE id=entry)<>'paid' THEN RAISE EXCEPTION 'Payment not restored'; END IF;
 IF (SELECT cost_before_vat FROM campaign_influencers WHERE id=a.id)-200<>-50 THEN RAISE EXCEPTION 'Overpayment balance incorrect'; END IF;
 IF NOT assignment_vendor_payment_locked(l.id) THEN RAISE EXCEPTION 'Restored payment failed to relock cost'; END IF;
 IF (SELECT document_number FROM vendor_ios WHERE id=next_io)<>'QA-PAYMENT-HOLD/1' THEN RAISE EXCEPTION 'Base IO serial changed'; END IF;
 PERFORM set_creator_payment_cost_pending(ARRAY[a.id],true);
 PERFORM update_reopened_vendor_cost_side(l.campaign_header_id,l.id,'EGP',400,0,0,NULL);
 next_io:=regenerate_reopened_vendor_io(next_io);
 PERFORM set_creator_payment_cost_pending(ARRAY[a.id],false);
 IF (SELECT cost_before_vat FROM campaign_influencers WHERE id=a.id)-200<>200 THEN RAISE EXCEPTION 'Increased cost remaining incorrect'; END IF;
 IF (SELECT count(*) FROM creator_payment_revisions WHERE entry_id=entry)<>4 THEN RAISE EXCEPTION 'Audit trail incomplete'; END IF;
 RAISE NOTICE 'PASS: permission, idempotency, locks, preserved payment, lower/higher costs, IO revisions and audit';
END $$;
ROLLBACK;
