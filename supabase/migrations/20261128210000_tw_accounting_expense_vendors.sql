BEGIN;
CREATE TABLE public.tw_accounting_expense_vendors(
 company_id uuid NOT NULL REFERENCES tw_accounting_companies(id),
 vendor_id uuid NOT NULL REFERENCES influencers(id),
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(company_id,vendor_id)
);
ALTER TABLE tw_accounting_expense_vendors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tw_accounting_expense_vendors FROM PUBLIC,anon,authenticated;
GRANT SELECT ON tw_accounting_expense_vendors TO authenticated;
CREATE POLICY expense_vendor_read ON tw_accounting_expense_vendors FOR SELECT TO authenticated USING(coalesce((tw_module_access()->>'accounting')::boolean,false));
CREATE TRIGGER expense_vendor_audit AFTER INSERT OR UPDATE OR DELETE ON tw_accounting_expense_vendors FOR EACH ROW EXECUTE FUNCTION tw_accounting_audit_change();
CREATE FUNCTION public.tw_accounting_expense_vendor_save(p_company uuid,p_vendor uuid,p_name text,p_email text,p_country text,p_currency text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM tw_accounting_companies WHERE id=p_company FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Company unavailable'; END IF;
 IF p_vendor IS NOT NULL THEN
  IF NOT tw_accounting_eligible_vendor(p_vendor) THEN RAISE EXCEPTION 'Choose an existing commercial vendor'; END IF;
  result:=p_vendor;
 ELSE
  IF length(trim(p_name)) NOT BETWEEN 2 AND 150 OR p_name IS NULL OR p_country IS NULL OR p_country !~ '^[A-Z]{2}$' OR p_currency IS NULL OR p_currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Enter vendor name, country and currency'; END IF;
  IF EXISTS(SELECT 1 FROM influencers WHERE lower(coalesce(legal_name,display_name))=lower(trim(p_name))) THEN RAISE EXCEPTION 'This vendor already exists. Link the existing vendor instead'; END IF;
  INSERT INTO influencers(display_name,legal_name,email,country_code,has_commercial_profile,metadata)
  VALUES(trim(p_name),trim(p_name),nullif(trim(p_email),''),p_country,true,jsonb_build_object('accountingCurrency',p_currency,'expenseVendor',true)) RETURNING id INTO result;
 END IF;
 INSERT INTO tw_accounting_expense_vendors(company_id,vendor_id) VALUES(p_company,result) ON CONFLICT DO NOTHING;
 RETURN result;
END $$;
CREATE FUNCTION public.tw_accounting_expense_vendor_list(p_company uuid,p_search text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 RETURN (SELECT coalesce(jsonb_agg(x ORDER BY x.code),'[]') FROM (
 SELECT i.id,i.document_number code,coalesce(i.legal_name,i.display_name) name,i.email,i.country_code country,i.metadata->>'accountingCurrency' currency
 FROM tw_accounting_expense_vendors e JOIN influencers i ON i.id=e.vendor_id WHERE e.company_id=p_company AND concat_ws(' ',i.document_number,i.legal_name,i.display_name) ILIKE '%'||coalesce(p_search,'')||'%'
 ORDER BY i.document_number LIMIT 500)x);
END $$;
REVOKE ALL ON FUNCTION tw_accounting_expense_vendor_save(uuid,uuid,text,text,text,text),tw_accounting_expense_vendor_list(uuid,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION tw_accounting_expense_vendor_save(uuid,uuid,text,text,text,text),tw_accounting_expense_vendor_list(uuid,text) TO authenticated;
-- Adding vendor tracking to an expense with history is safe only after every
-- historical line has been explicitly assigned to a real vendor.
DO $$ DECLARE d text;needle text;BEGIN
 SELECT pg_get_functiondef('tw_accounting_directory_account_guard()'::regprocedure) INTO d;
 needle:='THEN RAISE EXCEPTION ''Accounts with transactions require reviewed reclassification before changing directory''';
 IF position(needle IN d)=0 THEN RAISE EXCEPTION 'Unexpected directory guard'; END IF;
 d:=replace(d,needle,'AND NOT (OLD.directory_source_code IS NULL AND NEW.account_type=''Expense'' AND tw_accounting_account_directory(NEW.company_id,NEW.directory_source_code)=''Supplier / creator'' AND NOT EXISTS(SELECT 1 FROM tw_accounting_journal_lines WHERE company_id=OLD.company_id AND account_code=OLD.code AND (vendor_id IS NULL OR client_id IS NOT NULL OR auxiliary_id IS NOT NULL))) '||needle);
 EXECUTE d;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
