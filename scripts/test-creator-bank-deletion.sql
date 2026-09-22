BEGIN;
DO $$
DECLARE creator uuid; actor uuid; first_id uuid; second_id uuid; third_id uuid; d jsonb;
BEGIN
 SELECT id INTO creator FROM influencers LIMIT 1;
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE p.is_active AND r.slug='super_admin' LIMIT 1;
 IF creator IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'Fixtures unavailable'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SET LOCAL ROLE authenticated;
 -- Isolate the fixture within this rolled-back transaction.
 DELETE FROM influencer_bank_accounts WHERE influencer_id=creator;
 d:=jsonb_build_object('aaib_nickname','test-'||gen_random_uuid()::text,'beneficiary_name','Synthetic deletion test','iban','AE001234567890123456789','swift','TESTAEAA','bank_name','Test Bank','aaib_country','AE','aaib_currency','USD','aaib_registered',false);
 first_id:=save_creator_bank_account(creator,null,d,true);
 second_id:=save_creator_bank_account(creator,null,d||jsonb_build_object('aaib_nickname','second-'||gen_random_uuid()::text,'iban','AE009876543210987654321'),false);
 third_id:=save_creator_bank_account(creator,null,d||jsonb_build_object('aaib_nickname','third-'||gen_random_uuid()::text,'iban','AE001111111111111111111'),false);
 PERFORM delete_creator_bank_account(creator,third_id);
 IF NOT EXISTS(SELECT 1 FROM influencer_bank_accounts WHERE id=first_id AND is_default) THEN RAISE EXCEPTION 'Secondary deletion changed default'; END IF;
 BEGIN
   PERFORM delete_creator_bank_account(gen_random_uuid(),first_id);
   RAISE EXCEPTION 'Wrong creator deletion succeeded';
 EXCEPTION WHEN raise_exception THEN
   IF SQLERRM='Wrong creator deletion succeeded' THEN RAISE; END IF;
 END;
 PERFORM delete_creator_bank_account(creator,first_id);
 IF EXISTS(SELECT 1 FROM influencer_bank_accounts WHERE id=first_id) THEN RAISE EXCEPTION 'Deleted account retained'; END IF;
 IF NOT EXISTS(SELECT 1 FROM influencer_bank_accounts WHERE id=second_id AND is_default AND iban='AE009876543210987654321') THEN RAISE EXCEPTION 'Replacement altered or not default'; END IF;
 IF (SELECT payment_details->>'iban' FROM influencers WHERE id=creator)<>'AE009876543210987654321' THEN RAISE EXCEPTION 'Legacy default stale'; END IF;
 IF EXISTS(SELECT 1 FROM find_creator_bank_duplicates(creator,null,jsonb_build_object('iban',d->>'iban')) WHERE account_id=first_id) THEN RAISE EXCEPTION 'Deleted bank still matches'; END IF;
 PERFORM delete_creator_bank_account(creator,second_id);
 IF EXISTS(SELECT 1 FROM influencer_bank_accounts WHERE influencer_id=creator) THEN RAISE EXCEPTION 'Last account recreated'; END IF;
 IF coalesce((SELECT payment_details->>'iban' FROM influencers WHERE id=creator),'')<>'' THEN RAISE EXCEPTION 'Last account details retained'; END IF;
 RAISE NOTICE 'PASS: account-scoped deletion, secondary preservation, default replacement, duplicate cleanup, last-account cleanup';
END $$;
ROLLBACK;
