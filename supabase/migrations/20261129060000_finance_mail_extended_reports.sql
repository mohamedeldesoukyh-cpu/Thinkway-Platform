BEGIN;
CREATE OR REPLACE FUNCTION tw_finance_mail_read(p_job uuid,p_lease uuid,p_operation text,p_args jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_finance_mail_jobs;result jsonb;prior text:=current_setting('request.jwt.claims',true);BEGIN
 SELECT * INTO j FROM tw_finance_mail_jobs WHERE id=p_job AND lease_id=p_lease AND lease_until>now() AND status='processing';
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM tw_finance_mail_config c WHERE c.enabled AND c.company_id=j.company_id AND c.year_id=j.year_id AND c.authorized_by=j.authorized_by) THEN RAISE EXCEPTION 'Inactive report delegation' USING ERRCODE='42501';END IF;
 -- Recheck the authorizer's current permissions, without manufacturing MFA.
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',j.authorized_by,'role','authenticated')::text,true);
 IF NOT coalesce((tw_module_access()->>'admin')::boolean,false) THEN RAISE EXCEPTION 'Report delegation revoked' USING ERRCODE='42501';END IF;
 IF p_operation='setup' THEN
  SELECT jsonb_build_object('company',to_jsonb(c),'year',(SELECT to_jsonb(y) FROM tw_accounting_years y WHERE y.id=j.year_id AND y.company_id=j.company_id),
   'accounts',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM tw_accounting_accounts a WHERE a.company_id=j.company_id AND a.client_id IS NULL AND a.vendor_id IS NULL)) INTO result FROM tw_accounting_companies c WHERE c.id=j.company_id;
 ELSIF p_operation='party_lookup' THEN
  result:=tw_accounting_party_lookup(j.company_id,'client',p_args->>'search',NULL);
 ELSIF p_operation='statement' THEN
  IF p_args->>'action' NOT IN('pnl','client_statement','custom_ledger') OR p_args->>'display' NOT IN('local','USD','foreign') THEN RAISE EXCEPTION 'Unsupported report';END IF;
  IF p_args->>'action'='client_statement' AND nullif(p_args->>'party','') IS NULL THEN RAISE EXCEPTION 'Client selection required';END IF;
  IF p_args->>'action'='custom_ledger' AND coalesce(p_args->>'account','') !~ '^([0-9]{1,6}(,[0-9]{1,6}){0,19})?$' THEN RAISE EXCEPTION 'Invalid account filters';END IF;
  result:=tw_finance_statement_snapshot(j.company_id,(p_args->>'from')::date,(p_args->>'to')::date,CASE WHEN p_args->>'action'='custom_ledger' THEN nullif(p_args->>'account','') ELSE NULL END,
   CASE WHEN p_args->>'action' IN('pnl','custom_ledger') THEN 'all' ELSE 'client' END,nullif(p_args->>'party','')::uuid,NULL,0,NULL,
   jsonb_build_object('reportMode',CASE WHEN p_args->>'action'='pnl' THEN 'profit' ELSE 'statement' END,'display',p_args->>'display','dateBasis','journal','includeUnlocked',true,'excludeClosing',p_args->>'action'='pnl','skipZero',false));
 ELSIF p_operation='outstanding' THEN
  IF nullif(p_args->>'party','') IS NULL OR coalesce(p_args->>'currency','') !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Invalid outstanding scope';END IF;
  result:=tw_accounting_open_items(j.company_id,'client',(p_args->>'party')::uuid,p_args->>'currency',NULL);
 ELSE RAISE EXCEPTION 'Unsupported delegated operation';END IF;
 PERFORM set_config('request.jwt.claims',coalesce(prior,''),true);
 RETURN result;
EXCEPTION WHEN OTHERS THEN
 PERFORM set_config('request.jwt.claims',coalesce(prior,''),true);RAISE;
END $$;

COMMIT;
