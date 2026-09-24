BEGIN;
DO $$
DECLARE actor uuid; a uuid; request uuid:=gen_random_uuid(); rec uuid; failed boolean;
BEGIN
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE p.is_active AND r.slug='super_admin' LIMIT 1;
 SELECT id INTO a FROM campaign_influencers LIMIT 1;
 IF actor IS NULL OR a IS NULL THEN RAISE EXCEPTION 'Missing test fixture'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);SET LOCAL ROLE authenticated;
 INSERT INTO creator_supplier_invoices(request_id,assignment_id,status,invoice_number,invoice_date,country_code,currency,supplier_name,subtotal,vat_amount,recorded_by) VALUES(request,a,'received','ROLLBACK-'||request,CURRENT_DATE-40,'EG','EGP','Rollback creator',100,14,actor) RETURNING id INTO rec;
 PERFORM confirm_creator_supplier_invoice(rec);
 IF NOT (SELECT confirmed FROM creator_supplier_invoices WHERE id=rec) THEN RAISE EXCEPTION 'Confirmation failed'; END IF;
 INSERT INTO vat_authority_payments(request_id,period,country_code,currency,amount,paid_at,method,reference,authority) VALUES(gen_random_uuid(),date_trunc('month',CURRENT_DATE-40),'EG','EGP',14,CURRENT_DATE-10,'bank_transfer','ROLLBACK','Tax authority');
 failed:=false;BEGIN INSERT INTO creator_supplier_invoices(request_id,assignment_id,status,country_code,currency,supplier_name) VALUES(gen_random_uuid(),a,'received','EG','EGP','Missing date and number');EXCEPTION WHEN check_violation THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Incomplete received invoice allowed';END IF;
 failed:=false;BEGIN INSERT INTO vat_authority_payments(request_id,period,country_code,currency,amount,paid_at,method,reference,authority) VALUES(gen_random_uuid(),date_trunc('month',CURRENT_DATE),'EG','EGP',-1,CURRENT_DATE,'bank_transfer','ROLLBACK','Tax authority');EXCEPTION WHEN check_violation THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Negative payment allowed';END IF;
 PERFORM set_config('request.jwt.claim.sub','',true);failed:=false;BEGIN INSERT INTO vat_authority_payments(request_id,period,country_code,currency,amount,paid_at,method,reference,authority) VALUES(gen_random_uuid(),date_trunc('month',CURRENT_DATE),'EG','EGP',1,CURRENT_DATE,'bank_transfer','ROLLBACK','Tax authority');EXCEPTION WHEN OTHERS THEN failed:=true;END;IF NOT failed THEN RAISE EXCEPTION 'Unauthorized insert allowed';END IF;
 RAISE NOTICE 'PASS: historical creator invoice, review confirmation, VAT payment date, invalid details/negative payment/unauthorized writes';
END $$;
ROLLBACK;
