BEGIN;
-- Account settings and new owned auxiliaries commit together; all existing
-- account/transaction guards and auxiliary numbering rules still apply.
CREATE FUNCTION public.tw_accounting_account_save(p_value jsonb,p_version integer,p_auxiliaries jsonb DEFAULT '[]') RETURNS text
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a tw_accounting_accounts%ROWTYPE;code_saved text;x jsonb;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 a:=jsonb_populate_record(NULL::tw_accounting_accounts,p_value);
 IF jsonb_typeof(p_auxiliaries) IS DISTINCT FROM 'array' OR jsonb_array_length(p_auxiliaries)>100 THEN RAISE EXCEPTION 'Enter at most 100 new auxiliaries';END IF;
 IF jsonb_array_length(p_auxiliaries)>0 AND (NOT coalesce(a.has_auxiliary,false) OR a.auxiliary_source_code IS NOT NULL OR NOT(a.kind='Posting' OR a.kind='Control' AND a.subledger='Employee')) THEN RAISE EXCEPTION 'New rows require an owned auxiliary list';END IF;
 IF p_version IS NULL THEN
  IF a.kind='System' THEN RAISE EXCEPTION 'System accounts are reserved for the accounting engine';END IF;
  INSERT INTO tw_accounting_accounts(company_id,code,name,name_ar,parent_code,account_type,normal_balance,kind,subledger,client_id,vendor_id,has_auxiliary,auxiliary_source_code,active)
  VALUES(a.company_id,a.code,a.name,a.name_ar,a.parent_code,a.account_type,a.normal_balance,a.kind,a.subledger,a.client_id,a.vendor_id,a.has_auxiliary,a.auxiliary_source_code,a.active) RETURNING code INTO code_saved;
 ELSE
  UPDATE tw_accounting_accounts SET name=a.name,name_ar=a.name_ar,parent_code=a.parent_code,account_type=a.account_type,normal_balance=a.normal_balance,kind=a.kind,subledger=a.subledger,client_id=a.client_id,vendor_id=a.vendor_id,has_auxiliary=a.has_auxiliary,auxiliary_source_code=a.auxiliary_source_code,active=a.active
  WHERE company_id=a.company_id AND code=a.code AND version=p_version RETURNING code INTO code_saved;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account changed. Reload before saving.' USING ERRCODE='40001';END IF;
 END IF;
 FOR x IN SELECT value FROM jsonb_array_elements(p_auxiliaries) LOOP
  PERFORM tw_accounting_auxiliary_save_numbered(a.company_id,a.code,NULL,NULL,x->>'name',true,NULL,NULL,(x->>'number')::bigint);
 END LOOP;
 RETURN code_saved;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_account_save(jsonb,integer,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_account_save(jsonb,integer,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
