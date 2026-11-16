BEGIN;

-- The creator email is authoritative. Mirror it into payment advice and
-- platform contact fields so all existing readers see the same saved value.
-- Invoker privileges retain the caller's existing row-level permissions.
CREATE OR REPLACE FUNCTION public.prepare_creator_shared_email() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  NEW.email := nullif(btrim(NEW.email),'');
  NEW.payment_details := coalesce(NEW.payment_details,'{}'::jsonb)
    || jsonb_build_object('aaib_email',coalesce(NEW.email,''));
  RETURN NEW;
END $$;
CREATE TRIGGER prepare_creator_shared_email BEFORE UPDATE OF email ON public.influencers
FOR EACH ROW WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.prepare_creator_shared_email();

CREATE OR REPLACE FUNCTION public.sync_creator_shared_email() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  UPDATE public.influencer_platform_accounts
    SET contact_email=NEW.email,
        field_sources=coalesce(field_sources,'{}'::jsonb)||'{"contact_email":"manual"}'::jsonb
    WHERE influencer_id=NEW.id AND contact_email IS DISTINCT FROM NEW.email;
  UPDATE public.influencer_bank_accounts
    SET aaib_details=coalesce(aaib_details,'{}'::jsonb)
      || jsonb_build_object('aaib_email',coalesce(NEW.email,''))
    WHERE influencer_id=NEW.id
      AND coalesce(aaib_details->>'aaib_email','') IS DISTINCT FROM coalesce(NEW.email,'');
  RETURN NEW;
END $$;
CREATE TRIGGER sync_creator_shared_email AFTER UPDATE OF email ON public.influencers
FOR EACH ROW WHEN (OLD.email IS DISTINCT FROM NEW.email)
EXECUTE FUNCTION public.sync_creator_shared_email();

CREATE OR REPLACE FUNCTION public.sync_bank_creator_email() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$
DECLARE contact text := nullif(btrim(NEW.aaib_details->>'aaib_email'),'');
BEGIN
  -- Clearing/deleting bank details must not erase the creator's contact email.
  IF contact IS NOT NULL AND (TG_OP='INSERT' OR
      contact IS DISTINCT FROM nullif(btrim(OLD.aaib_details->>'aaib_email'),'')) THEN
    UPDATE public.influencers SET email=contact
      WHERE id=NEW.influencer_id AND email IS DISTINCT FROM contact;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_bank_creator_email AFTER INSERT OR UPDATE OF aaib_details
ON public.influencer_bank_accounts FOR EACH ROW
EXECUTE FUNCTION public.sync_bank_creator_email();

-- No bulk backfill: historical conflicting emails are not silently overwritten.
NOTIFY pgrst, 'reload schema';
COMMIT;
