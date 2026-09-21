BEGIN;
-- Older installations may predate the CRM payment-readiness columns.
ALTER TABLE public.influencer_bank_accounts
  ADD COLUMN IF NOT EXISTS beneficiary_name text,
  ADD COLUMN IF NOT EXISTS branch_name text;
ALTER TABLE public.influencer_bank_accounts ADD COLUMN aaib_details jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE UNIQUE INDEX influencer_bank_accounts_aaib_nickname_unique
ON public.influencer_bank_accounts(lower(trim(aaib_details->>'aaib_nickname')))
WHERE nullif(trim(aaib_details->>'aaib_nickname'),'') IS NOT NULL;

-- Keep the existing CRM account columns authoritative for shared bank fields.
CREATE FUNCTION public.prepare_creator_bank_account() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.aaib_details := NEW.aaib_details || jsonb_build_object(
    'beneficiary_name',coalesce(NEW.beneficiary_name,NEW.account_holder,''),
    'iban',coalesce(NEW.iban,''),'account_number',coalesce(NEW.account_number,''),
    'swift',coalesce(NEW.swift,''),'bank_name',coalesce(NEW.bank_name,''),
    'bank_branch',coalesce(NEW.branch_name,''),'aaib_country',coalesce(NEW.country_code,''),
    'aaib_currency',coalesce(NEW.currency,''),'aaib_nickname',trim(coalesce(NEW.aaib_details->>'aaib_nickname','')));
  IF TG_OP='UPDATE' AND nullif(OLD.aaib_details->>'aaib_nickname','') IS NOT NULL
    AND (OLD.aaib_details-'aaib_registered') IS DISTINCT FROM (NEW.aaib_details-'aaib_registered') THEN
    NEW.aaib_details := NEW.aaib_details || '{"aaib_registered":false}'::jsonb;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER prepare_creator_bank_account BEFORE INSERT OR UPDATE ON public.influencer_bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.prepare_creator_bank_account();

-- Synchronize the chosen default with existing IO and payment-export readers.
CREATE FUNCTION public.sync_creator_bank_default() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF pg_trigger_depth()=1 AND NEW.is_default THEN
    UPDATE influencers SET payment_details=coalesce(payment_details,'{}'::jsonb)||NEW.aaib_details
      WHERE id=NEW.influencer_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_creator_bank_default AFTER INSERT OR UPDATE ON public.influencer_bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.sync_creator_bank_default();

-- Legacy CRM edits still update the same saved default account.
CREATE FUNCTION public.sync_creator_legacy_bank() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE account_id uuid; d jsonb;
BEGIN
  IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
  d := coalesce(NEW.payment_details,'{}'::jsonb);
  IF nullif(d->>'aaib_nickname','') IS NULL THEN RETURN NEW; END IF;
  SELECT id INTO account_id FROM influencer_bank_accounts WHERE influencer_id=NEW.id AND is_default FOR UPDATE;
  IF account_id IS NULL THEN account_id:=gen_random_uuid(); END IF;
  INSERT INTO influencer_bank_accounts(id,influencer_id,is_default,aaib_details,beneficiary_name,account_holder,iban,account_number,swift,bank_name,branch_name,country_code,currency)
  VALUES(account_id,NEW.id,true,d,d->>'beneficiary_name',d->>'beneficiary_name',d->>'iban',d->>'account_number',d->>'swift',d->>'bank_name',d->>'bank_branch',d->>'aaib_country',d->>'aaib_currency')
  ON CONFLICT(id) DO UPDATE SET aaib_details=excluded.aaib_details,beneficiary_name=excluded.beneficiary_name,account_holder=excluded.account_holder,iban=excluded.iban,account_number=excluded.account_number,swift=excluded.swift,bank_name=excluded.bank_name,branch_name=excluded.branch_name,country_code=excluded.country_code,currency=excluded.currency;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_creator_legacy_bank AFTER INSERT OR UPDATE OF payment_details ON public.influencers
FOR EACH ROW EXECUTE FUNCTION public.sync_creator_legacy_bank();

-- When a saved account becomes default, its own registration travels with it.
CREATE OR REPLACE FUNCTION public.invalidate_aaib_registration() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
DECLARE k text;
BEGIN
  IF pg_trigger_depth()>1 THEN RETURN NEW; END IF;
  IF nullif(OLD.payment_details->>'aaib_nickname','') IS NOT NULL THEN
    FOREACH k IN ARRAY ARRAY['beneficiary_name','account_number','iban','swift','bank_name','bank_branch','aaib_payment_type','aaib_currency','aaib_nickname','aaib_address','aaib_email','aaib_mobile','aaib_country','aaib_identifier','aaib_clearing_code','aaib_bank_address'] LOOP
      IF OLD.payment_details->>k IS DISTINCT FROM NEW.payment_details->>k THEN
        NEW.payment_details := jsonb_set(NEW.payment_details,'{aaib_registered}','false'); EXIT;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

-- Backfill current AAIB defaults without changing their registration or exports.
DO $$
DECLARE c record; existing_id uuid;
BEGIN
 FOR c IN SELECT id,payment_details FROM influencers WHERE nullif(trim(payment_details->>'aaib_nickname'),'') IS NOT NULL LOOP
  -- Preserve a different CRM default as a secondary account rather than overwrite it.
  SELECT id INTO existing_id FROM influencer_bank_accounts WHERE influencer_id=c.id AND is_default
    AND ((nullif(c.payment_details->>'iban','') IS NOT NULL AND regexp_replace(upper(coalesce(iban,'')),'\s','','g')=regexp_replace(upper(c.payment_details->>'iban'),'\s','','g'))
      OR (nullif(c.payment_details->>'iban','') IS NULL AND account_number=c.payment_details->>'account_number'));
  IF existing_id IS NULL THEN UPDATE influencer_bank_accounts SET is_default=false WHERE influencer_id=c.id AND is_default; END IF;
  UPDATE influencers SET payment_details=payment_details WHERE id=c.id;
 END LOOP;
END $$;

-- Invoker privileges and existing RLS protect creator access. Lock the parent so
-- simultaneous saves/default changes cannot leave two defaults or lose accounts.
CREATE FUNCTION public.save_creator_bank_account(p_creator uuid,p_account uuid,p_details jsonb,p_default boolean DEFAULT false)
RETURNS uuid LANGUAGE plpgsql SET search_path=public AS $$
DECLARE account_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_internal_user() OR NOT public.has_permission('influencers.write') THEN RAISE EXCEPTION 'Creator write access required'; END IF;
  PERFORM id FROM influencers WHERE id=p_creator FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Creator unavailable'; END IF;
  account_id := coalesce(p_account,gen_random_uuid());
  IF p_account IS NOT NULL AND NOT EXISTS(SELECT 1 FROM influencer_bank_accounts WHERE id=p_account AND influencer_id=p_creator) THEN RAISE EXCEPTION 'Bank account unavailable'; END IF;
  IF p_details IS NULL AND p_account IS NULL THEN RAISE EXCEPTION 'Select an account'; END IF;
  p_default := p_default OR NOT EXISTS(SELECT 1 FROM influencer_bank_accounts WHERE influencer_id=p_creator AND is_default);
  IF p_default THEN UPDATE influencer_bank_accounts SET is_default=false WHERE influencer_id=p_creator AND is_default AND id<>account_id; END IF;
  IF p_details IS NULL THEN
    UPDATE influencer_bank_accounts SET is_default=true WHERE id=account_id AND influencer_id=p_creator;
  ELSE
    INSERT INTO influencer_bank_accounts(id,influencer_id,is_default,aaib_details,beneficiary_name,account_holder,iban,account_number,swift,bank_name,branch_name,country_code,currency)
    VALUES(account_id,p_creator,p_default,p_details,p_details->>'beneficiary_name',p_details->>'beneficiary_name',p_details->>'iban',p_details->>'account_number',p_details->>'swift',p_details->>'bank_name',p_details->>'bank_branch',p_details->>'aaib_country',p_details->>'aaib_currency')
    ON CONFLICT(id) DO UPDATE SET is_default=influencer_bank_accounts.is_default OR excluded.is_default,aaib_details=excluded.aaib_details,beneficiary_name=excluded.beneficiary_name,account_holder=excluded.account_holder,iban=excluded.iban,account_number=excluded.account_number,swift=excluded.swift,bank_name=excluded.bank_name,branch_name=excluded.branch_name,country_code=excluded.country_code,currency=excluded.currency;
  END IF;
  RETURN account_id;
END $$;
REVOKE ALL ON FUNCTION public.save_creator_bank_account(uuid,uuid,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_creator_bank_account(uuid,uuid,jsonb,boolean) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
