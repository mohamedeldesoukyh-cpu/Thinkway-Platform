BEGIN;
CREATE FUNCTION public.find_creator_bank_duplicates(p_creator uuid,p_account uuid,p_values jsonb)
RETURNS TABLE(account_id uuid,creator_id uuid,creator_name text,field text)
LANGUAGE plpgsql STABLE SET search_path=public AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_internal_user() OR NOT public.has_permission('influencers.write') THEN RAISE EXCEPTION 'Creator write access required'; END IF;
 IF NOT EXISTS(SELECT 1 FROM influencers WHERE id=p_creator) THEN RAISE EXCEPTION 'Creator unavailable'; END IF;
 RETURN QUERY
 SELECT b.id,b.influencer_id,coalesce(nullif(i.legal_name,''),i.display_name,'Creator'),v.k
 FROM influencer_bank_accounts b JOIN influencers i ON i.id=b.influencer_id
 CROSS JOIN LATERAL (VALUES
   ('nickname',b.aaib_details->>'aaib_nickname'),('iban',b.iban),('account_number',b.account_number),
   ('beneficiary_name',coalesce(b.beneficiary_name,b.account_holder)),('beneficiary_address',b.aaib_details->>'aaib_address'),
   ('email',b.aaib_details->>'aaib_email'),('mobile',b.aaib_details->>'aaib_mobile')
 ) v(k,val)
 WHERE b.id IS DISTINCT FROM p_account
 AND length(trim(coalesce(p_values->>v.k,''))) >= CASE WHEN v.k IN ('iban','account_number','mobile') THEN 5 ELSE 3 END
 AND CASE WHEN v.k IN ('iban','account_number','mobile')
   THEN regexp_replace(lower(coalesce(v.val,'')),'[\s+()-]','','g')=regexp_replace(lower(p_values->>v.k),'[\s+()-]','','g')
   ELSE regexp_replace(lower(trim(coalesce(v.val,''))),'\s+',' ','g')=regexp_replace(lower(trim(p_values->>v.k)),'\s+',' ','g') END
 -- Local account numbers have meaning within their bank, unlike an IBAN.
 AND (v.k<>'account_number' OR (nullif(p_values->>'country','') IS NOT NULL AND b.country_code=p_values->>'country'
   AND ((nullif(p_values->>'swift','') IS NOT NULL AND left(upper(b.swift),8)=left(upper(p_values->>'swift'),8))
     OR (nullif(p_values->>'bank_name','') IS NOT NULL AND lower(trim(b.bank_name))=lower(trim(p_values->>'bank_name'))))))
 ORDER BY v.k,i.display_name,b.id LIMIT 50;
END $$;
REVOKE ALL ON FUNCTION public.find_creator_bank_duplicates(uuid,uuid,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_creator_bank_duplicates(uuid,uuid,jsonb) TO authenticated;
-- Clearing or changing bank identity also clears the older CRM verification flag.
CREATE FUNCTION public.reset_changed_creator_bank_verification() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF ROW(OLD.iban,OLD.account_number,OLD.swift,OLD.beneficiary_name,OLD.currency) IS DISTINCT FROM ROW(NEW.iban,NEW.account_number,NEW.swift,NEW.beneficiary_name,NEW.currency)
   OR (coalesce(NEW.iban,'')='' AND coalesce(NEW.account_number,'')='') THEN NEW.is_verified:=false; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER reset_changed_creator_bank_verification BEFORE UPDATE ON public.influencer_bank_accounts
FOR EACH ROW EXECUTE FUNCTION public.reset_changed_creator_bank_verification();
NOTIFY pgrst,'reload schema';
COMMIT;
