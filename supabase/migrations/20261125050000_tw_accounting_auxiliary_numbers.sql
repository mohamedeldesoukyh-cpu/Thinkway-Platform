BEGIN;
CREATE FUNCTION tw_accounting_auxiliary_save_numbered(p_company uuid,p_account text,p_id uuid,p_version integer,p_name text,p_active boolean,p_client uuid,p_vendor uuid,p_number bigint) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a tw_accounting_accounts%ROWTYPE; existing tw_accounting_auxiliaries%ROWTYPE; label text; n bigint; result uuid;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 IF p_number IS NOT NULL AND (p_number<1 OR p_number>2147483647) THEN RAISE EXCEPTION 'Auxiliary number must be a whole number between 1 and 2147483647'; END IF;
 IF p_id IS NOT NULL THEN
  SELECT * INTO existing FROM tw_accounting_auxiliaries WHERE id=p_id AND company_id=p_company AND account_code=p_account;
  IF p_number IS NOT NULL AND p_number IS DISTINCT FROM existing.number THEN RAISE EXCEPTION 'Choose the auxiliary number before adding it; saved numbers cannot be changed'; END IF;
  RETURN tw_accounting_auxiliary_save(p_company,p_account,p_id,p_version,p_name,p_active,p_client,p_vendor);
 END IF;
 SELECT * INTO a FROM tw_accounting_accounts WHERE company_id=p_company AND code=p_account;
 IF NOT FOUND OR NOT a.active OR NOT a.has_auxiliary THEN RAISE EXCEPTION 'Select an active account with auxiliaries'; END IF;
 IF a.kind='Control' AND a.subledger='Customer' THEN
  SELECT name INTO label FROM clients WHERE id=p_client;
  IF label IS NULL OR p_vendor IS NOT NULL THEN RAISE EXCEPTION 'Client required for this auxiliary'; END IF;
  SELECT * INTO existing FROM tw_accounting_auxiliaries WHERE company_id=p_company AND account_code=p_account AND client_id=p_client;
 ELSIF a.kind='Control' AND a.subledger='Supplier / creator' THEN
  SELECT coalesce(legal_name,display_name,document_number) INTO label FROM influencers WHERE id=p_vendor;
  IF label IS NULL OR p_client IS NOT NULL THEN RAISE EXCEPTION 'Vendor required for this auxiliary'; END IF;
  SELECT * INTO existing FROM tw_accounting_auxiliaries WHERE company_id=p_company AND account_code=p_account AND vendor_id=p_vendor;
 ELSE
  IF p_client IS NOT NULL OR p_vendor IS NOT NULL OR length(trim(coalesce(p_name,''))) NOT BETWEEN 1 AND 150 THEN RAISE EXCEPTION 'Enter the auxiliary name'; END IF;
  label:=trim(p_name);
 END IF;
 IF existing.id IS NOT NULL THEN RAISE EXCEPTION 'This client or vendor already has auxiliary % under this account',existing.number; END IF;
 IF p_number IS NOT NULL AND EXISTS(SELECT 1 FROM tw_accounting_auxiliaries WHERE company_id=p_company AND account_code=p_account AND number=p_number) THEN RAISE EXCEPTION 'Auxiliary number % is already used under this account',p_number; END IF;
 INSERT INTO tw_accounting_auxiliary_sequences AS s VALUES(p_company,p_account,coalesce(p_number,1)) ON CONFLICT(company_id,account_code) DO UPDATE SET last_number=CASE WHEN p_number IS NULL THEN s.last_number+1 ELSE greatest(s.last_number,p_number) END RETURNING last_number INTO n;
 INSERT INTO tw_accounting_auxiliaries(company_id,account_code,number,name,client_id,vendor_id) VALUES(p_company,p_account,coalesce(p_number,n),label,p_client,p_vendor) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_auxiliary_save_numbered(uuid,text,uuid,integer,text,boolean,uuid,uuid,bigint) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_auxiliary_save_numbered(uuid,text,uuid,integer,text,boolean,uuid,uuid,bigint) TO authenticated;
COMMIT;
