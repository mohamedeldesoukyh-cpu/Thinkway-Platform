BEGIN;
-- All pages execute under one STABLE statement snapshot. Existing report checks
-- still apply; this wrapper is not a new privilege or arbitrary query endpoint.
CREATE FUNCTION public.tw_finance_statement_snapshot(p_company uuid,p_from date,p_to date,p_account text DEFAULT NULL,p_kind text DEFAULT 'all',p_party uuid DEFAULT NULL,p_currency text DEFAULT NULL,p_offset integer DEFAULT 0,p_auxiliary uuid DEFAULT NULL,p_options jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE result jsonb;page jsonb;rows jsonb;total integer;offset_value integer;
BEGIN
 IF p_offset<>0 THEN RAISE EXCEPTION 'Snapshot starts at zero';END IF;
 result:=tw_accounting_statement_filtered(p_company,p_from,p_to,p_account,p_kind,p_party,p_currency,0,p_auxiliary,p_options);
 total:=(result->>'count')::integer;
 IF p_options->>'reportMode'='profit' THEN RETURN result;END IF;
 IF total IS NULL OR total>1000 THEN RAISE EXCEPTION 'Narrow the report to at most 1,000 ledger entries';END IF;
 rows:=result->'rows';offset_value:=100;
 WHILE offset_value<total LOOP
  page:=tw_accounting_statement_filtered(p_company,p_from,p_to,p_account,p_kind,p_party,p_currency,offset_value,p_auxiliary,p_options);
  rows:=rows||(page->'rows');offset_value:=offset_value+100;
 END LOOP;
 IF jsonb_array_length(rows)<>total THEN RAISE EXCEPTION 'Incomplete report';END IF;
 RETURN jsonb_set(result,'{rows}',rows);
END $$;
REVOKE ALL ON FUNCTION public.tw_finance_statement_snapshot(uuid,date,date,text,text,uuid,text,integer,uuid,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_finance_statement_snapshot(uuid,date,date,text,text,uuid,text,integer,uuid,jsonb) TO authenticated;
COMMIT;
