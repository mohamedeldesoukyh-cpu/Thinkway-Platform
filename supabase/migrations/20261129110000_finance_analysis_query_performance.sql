BEGIN;
-- The bounded report checks tw_module_access() before reading any rows and
-- fixes every ledger/source query to p_company. Running the approved report
-- as its owner avoids repeating expensive Media RLS checks for each source
-- link in full-year analyses. No write operations or arbitrary SQL exist.
ALTER FUNCTION public.tw_finance_analysis_snapshot(uuid,date,date,text,text)
  SECURITY DEFINER SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.tw_finance_analysis_snapshot(uuid,date,date,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_finance_analysis_snapshot(uuid,date,date,text,text) TO authenticated;
COMMIT;
