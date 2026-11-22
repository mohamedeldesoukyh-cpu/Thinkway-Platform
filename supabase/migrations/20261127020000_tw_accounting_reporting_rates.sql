BEGIN;
CREATE OR REPLACE FUNCTION tw_accounting_currency_rates(p_company uuid,p_date date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE c tw_accounting_companies%ROWTYPE;currency text;rate numeric;result jsonb:='{}';BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501'; END IF;
 SELECT * INTO c FROM tw_accounting_companies WHERE id=p_company;IF NOT FOUND OR p_date IS NULL THEN RAISE EXCEPTION 'Company and date required'; END IF;
 FOR currency IN SELECT DISTINCT unnest(c.currencies||ARRAY['EGP','USD']) LOOP
 BEGIN rate:=resolve_effective_exchange_rate(currency,c.base_currency,p_date);EXCEPTION WHEN OTHERS THEN rate:=NULL;END;
 result:=result||jsonb_build_object(currency,rate::text);
 END LOOP;RETURN result;
END $$;

NOTIFY pgrst,'reload schema';
COMMIT;
