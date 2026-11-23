BEGIN;
ALTER TABLE public.tw_accounting_companies ADD COLUMN aging_day_limits integer[] NOT NULL DEFAULT ARRAY[30,60,90];
CREATE FUNCTION public.tw_accounting_aging_defaults(p_company uuid,p_limits integer[],p_version integer) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v integer;
BEGIN
 IF NOT tw_accounting_can_manage() OR NOT coalesce((tw_module_access()->>'admin')::boolean,false) THEN
  RAISE EXCEPTION 'Administrator and verified MFA required' USING ERRCODE='42501';
 END IF;
 IF p_limits IS NULL OR cardinality(p_limits) NOT BETWEEN 1 AND 8 OR array_ndims(p_limits)<>1 OR EXISTS(
  SELECT 1 FROM (SELECT n,lag(n) OVER(ORDER BY ord) previous FROM unnest(p_limits) WITH ORDINALITY a(n,ord)) q
  WHERE n IS NULL OR n NOT BETWEEN 1 AND 3650 OR n<=previous
 ) THEN RAISE EXCEPTION 'Enter up to eight increasing day limits between 1 and 3650';END IF;
 UPDATE tw_accounting_companies SET aging_day_limits=p_limits,version=version+1 WHERE id=p_company AND version=p_version RETURNING version INTO v;
 IF NOT FOUND THEN RAISE EXCEPTION 'Company settings changed. Reload.' USING ERRCODE='40001';END IF;
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION public.tw_accounting_aging_defaults(uuid,integer[],integer) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.tw_accounting_aging_defaults(uuid,integer[],integer) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
