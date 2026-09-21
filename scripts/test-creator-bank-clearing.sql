BEGIN;
DO $$
DECLARE creator uuid; actor uuid; first_id uuid; second_id uuid; d jsonb; values_json jsonb; matches integer;
BEGIN
 SELECT id INTO creator FROM influencers LIMIT 1;
 SELECT p.id INTO actor FROM profiles p JOIN roles r ON r.id=p.role_id WHERE p.is_active AND r.slug='super_admin' LIMIT 1;
 IF creator IS NULL OR actor IS NULL THEN RAISE EXCEPTION 'Fixtures unavailable'; END IF;
 PERFORM set_config('request.jwt.claim.sub',actor::text,true);
 SET LOCAL ROLE authenticated;
 d:=jsonb_build_object('aaib_nickname','test-'||gen_random_uuid()::text,'beneficiary_name','Synthetic creator test','account_number','009911223344','iban','AE00 1234567890123456789','swift','TESTAEAA','bank_name','Test Bank','bank_branch','','aaib_country','AE','aaib_currency','USD','aaib_address','Synthetic address test','aaib_email','synthetic-test@example.invalid','aaib_mobile','00971123456789','aaib_registered',true);
 first_id:=save_creator_bank_account(creator,null,d,true);
 values_json:=jsonb_build_object('nickname',upper(d->>'aaib_nickname'),'beneficiary_name','  SYNTHETIC CREATOR TEST  ','account_number','009911223344','iban','ae001234567890123456789','country','AE','swift','TESTAEAA','bank_name','Test Bank','beneficiary_address','synthetic address test','email','SYNTHETIC-TEST@EXAMPLE.INVALID','mobile','00 971 123456789');
 SELECT count(DISTINCT field) INTO matches FROM find_creator_bank_duplicates(creator,null,values_json) WHERE account_id=first_id;
 IF matches<>7 THEN RAISE EXCEPTION 'Expected all 7 field matches, got %',matches; END IF;
 IF EXISTS(SELECT 1 FROM find_creator_bank_duplicates(creator,first_id,values_json) WHERE account_id=first_id) THEN RAISE EXCEPTION 'Account matched itself'; END IF;
 IF EXISTS(SELECT 1 FROM find_creator_bank_duplicates(creator,null,values_json||'{"swift":"OTHEAEAA","bank_name":"Other bank"}') WHERE account_id=first_id AND field='account_number') THEN RAISE EXCEPTION 'Local account numbers matched different banks'; END IF;
 UPDATE influencer_bank_accounts SET is_verified=true WHERE id=first_id;
 PERFORM save_creator_bank_account(creator,first_id,'{"beneficiary_name":"","account_number":"","iban":"","swift":"","bank_name":"","bank_branch":"","aaib_country":"","aaib_currency":"","aaib_nickname":"","aaib_address":"","aaib_email":"","aaib_mobile":"","aaib_identifier":"","aaib_clearing_code":"","aaib_bank_address":"","aaib_payment_type":"","aaib_registered":false}',false);
 IF (SELECT is_verified FROM influencer_bank_accounts WHERE id=first_id) THEN RAISE EXCEPTION 'Cleared bank still verified'; END IF;
 IF (SELECT payment_details->>'aaib_nickname' FROM influencers WHERE id=creator)<>'' OR (SELECT payment_details->>'aaib_registered' FROM influencers WHERE id=creator)<>'false' THEN RAISE EXCEPTION 'Cleared default retained beneficiary'; END IF;
 IF EXISTS(SELECT 1 FROM find_creator_bank_duplicates(creator,null,values_json) WHERE account_id=first_id) THEN RAISE EXCEPTION 'Cleared bank still matches'; END IF;
 second_id:=save_creator_bank_account(creator,null,d,false);
 IF second_id IS NULL THEN RAISE EXCEPTION 'Clearing did not release nickname'; END IF;
 RAISE NOTICE 'PASS: seven early duplicate fields, normalization, self exclusion, bank-scoped account numbers, clear-empty save, verification reset, default sync, nickname reuse';
END $$;
ROLLBACK;
