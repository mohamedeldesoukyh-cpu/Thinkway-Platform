BEGIN;
DO $$
DECLARE actor uuid; inv record; p uuid; failed boolean;
BEGIN
 SELECT profiles.id INTO actor FROM profiles JOIN roles ON profiles.role_id=roles.id WHERE roles.slug='super_admin' AND profiles.is_active LIMIT 1;
 INSERT INTO invoices(document_number,client_id,status,subtotal,total,currency,created_by) SELECT 'ROLLBACK-'||gen_random_uuid(),id,'sent',1000,1000,'EGP',actor FROM clients LIMIT 1 RETURNING * INTO inv;
 IF actor IS NULL OR inv.id IS NULL THEN RAISE EXCEPTION 'No rollback fixture available'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true); SET LOCAL ROLE authenticated;
 INSERT INTO payments(invoice_id,client_id,amount,currency,status,payment_method,paid_at,recorded_by) VALUES(inv.id,inv.client_id,10,inv.currency,'completed','bank_transfer',now(),actor) RETURNING id INTO p;
 INSERT INTO payment_allocations(payment_id,invoice_id,allocated_amount,currency_code) VALUES(p,inv.id,10,inv.currency);
 PERFORM revise_collection_payment(p,0,20,CURRENT_DATE,'bank_transfer','rollback test','notes','test correction');
 IF (SELECT amount_paid FROM invoices WHERE id=inv.id)<>inv.amount_paid+20 THEN RAISE EXCEPTION 'Invoice balance incorrect'; END IF;
 IF (SELECT allocated_amount FROM payment_allocations WHERE payment_id=p)<>20 THEN RAISE EXCEPTION 'Allocation incorrect'; END IF;
 IF NOT EXISTS(SELECT 1 FROM collection_audit_logs WHERE entity_id=p AND action='payment_revised') THEN RAISE EXCEPTION 'Audit missing'; END IF;
 failed:=false;BEGIN PERFORM revise_collection_payment(p,0,30,CURRENT_DATE,'bank_transfer','','','stale');EXCEPTION WHEN OTHERS THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Stale write allowed';END IF;
 failed:=false;BEGIN PERFORM revise_collection_payment(p,1,inv.total+100,CURRENT_DATE,'bank_transfer','','','too much');EXCEPTION WHEN OTHERS THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Overpayment allowed';END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);failed:=false;BEGIN PERFORM revise_collection_payment(p,1,10,CURRENT_DATE,'bank_transfer','','','anonymous');EXCEPTION WHEN OTHERS THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Unauthorized revision allowed';END IF;
 RAISE NOTICE 'PASS: receipt edit updates invoice and allocation atomically, audit retained, stale/overpayment/unauthorized writes rejected';
END $$;
ROLLBACK;
