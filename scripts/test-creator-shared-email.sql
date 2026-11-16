-- Development only. All edits to the selected existing record are rolled back.
BEGIN;
DO $$
DECLARE creator uuid; account uuid;
BEGIN
  SELECT b.influencer_id,b.id INTO creator,account FROM public.influencer_bank_accounts b
    JOIN public.influencers i ON i.id=b.influencer_id ORDER BY b.id LIMIT 1;
  IF creator IS NULL THEN RAISE EXCEPTION 'Need an existing development bank account'; END IF;
  UPDATE public.influencer_bank_accounts SET aaib_details=aaib_details||'{"aaib_email":"bank-sync@example.invalid"}'::jsonb WHERE id=account;
  IF NOT EXISTS(SELECT 1 FROM public.influencers WHERE id=creator AND email='bank-sync@example.invalid'
    AND payment_details->>'aaib_email'='bank-sync@example.invalid') THEN RAISE EXCEPTION 'Bank to canonical/default sync failed'; END IF;
  IF EXISTS(SELECT 1 FROM public.influencer_platform_accounts WHERE influencer_id=creator AND contact_email IS DISTINCT FROM 'bank-sync@example.invalid') THEN RAISE EXCEPTION 'Platform sync failed'; END IF;
  UPDATE public.influencers SET email='profile-sync@example.invalid' WHERE id=creator;
  IF EXISTS(SELECT 1 FROM public.influencer_bank_accounts WHERE influencer_id=creator AND aaib_details->>'aaib_email' IS DISTINCT FROM 'profile-sync@example.invalid') THEN RAISE EXCEPTION 'Profile to bank sync failed'; END IF;
  UPDATE public.influencer_bank_accounts SET aaib_details=aaib_details||'{"aaib_email":""}'::jsonb WHERE id=account;
  IF NOT EXISTS(SELECT 1 FROM public.influencers WHERE id=creator AND email='profile-sync@example.invalid') THEN RAISE EXCEPTION 'Bank clear erased creator email'; END IF;
  UPDATE public.influencers SET email=NULL WHERE id=creator;
  IF EXISTS(SELECT 1 FROM public.influencer_bank_accounts WHERE influencer_id=creator AND coalesce(aaib_details->>'aaib_email','')<>'') THEN RAISE EXCEPTION 'Explicit contact removal did not propagate'; END IF;
END $$;
ROLLBACK;
