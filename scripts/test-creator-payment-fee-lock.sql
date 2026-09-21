BEGIN;
CREATE TEMP TABLE payment_fee_guard_test (LIKE public.creator_payment_terms INCLUDING DEFAULTS);
ALTER TABLE payment_fee_guard_test ALTER COLUMN updated_by SET DEFAULT gen_random_uuid();
CREATE TRIGGER test_fee BEFORE INSERT ON payment_fee_guard_test FOR EACH ROW EXECUTE FUNCTION public.enforce_creator_payment_agreed_fee();
DO $$
DECLARE a record; rejected boolean := false;
BEGIN
 SELECT id,campaign_id,coalesce(cost_before_vat,agreed_fee,0) AS fee INTO a FROM campaign_influencers WHERE cost_before_vat IS NOT NULL OR agreed_fee IS NOT NULL LIMIT 1;
 IF a.id IS NULL THEN RAISE EXCEPTION 'No assignment fixture available'; END IF;
 BEGIN
  INSERT INTO payment_fee_guard_test(assignment_id,campaign_id,fee,vat) VALUES(a.id,a.campaign_id,a.fee+1,0);
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE 'Agreed creator fee is read-only%' THEN RAISE; END IF;
  rejected := true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'Fee edit was allowed'; END IF;
 INSERT INTO payment_fee_guard_test(assignment_id,campaign_id,fee,vat) VALUES(a.id,a.campaign_id,round(a.fee,2),0);
 RAISE NOTICE 'PASS: changed fee rejected; agreed fee accepted';
END $$;
ROLLBACK;

