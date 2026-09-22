BEGIN;
-- Lock the creator, as saves/default changes do, and synchronize legacy readers
-- in the same transaction. Payment records and export snapshots are untouched.
CREATE FUNCTION public.delete_creator_bank_account(p_creator uuid, p_account uuid)
RETURNS void LANGUAGE plpgsql SET search_path=public AS $$
DECLARE was_default boolean; replacement uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_internal_user() OR NOT public.has_permission('influencers.write') THEN RAISE EXCEPTION 'Creator write access required'; END IF;
  PERFORM id FROM influencers WHERE id=p_creator FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Creator unavailable'; END IF;
  SELECT is_default INTO was_default FROM influencer_bank_accounts WHERE id=p_account AND influencer_id=p_creator FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bank account unavailable'; END IF;
  IF was_default THEN
    -- Clear through the existing sync trigger before deletion, including when
    -- this is the last account. Preserve unrelated payment preferences.
    PERFORM save_creator_bank_account(p_creator,p_account,'{"beneficiary_name":"","account_number":"","iban":"","swift":"","bank_name":"","bank_branch":"","aaib_country":"","aaib_currency":"","aaib_nickname":"","aaib_address":"","aaib_email":"","aaib_mobile":"","aaib_identifier":"","aaib_clearing_code":"","aaib_bank_address":"","aaib_payment_type":"","aaib_registered":false}',false);
  END IF;
  DELETE FROM influencer_bank_accounts WHERE id=p_account AND influencer_id=p_creator;
  IF was_default THEN
    SELECT id INTO replacement FROM influencer_bank_accounts WHERE influencer_id=p_creator
      AND (nullif(trim(iban),'') IS NOT NULL OR nullif(trim(account_number),'') IS NOT NULL)
      ORDER BY created_at,id LIMIT 1;
    IF replacement IS NOT NULL THEN
      PERFORM save_creator_bank_account(p_creator,replacement,null,true);
    END IF;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.delete_creator_bank_account(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_creator_bank_account(uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
