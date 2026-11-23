BEGIN;
CREATE OR REPLACE FUNCTION public.tw_accounting_bank_currency_auxiliary(p_company uuid,p_parent uuid,p_currency text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a tw_accounting_auxiliaries%ROWTYPE; result uuid;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM tw_accounting_auxiliaries WHERE id=p_parent AND company_id=p_company FOR UPDATE;
 IF NOT FOUND OR NOT a.active OR a.parent_auxiliary_id IS NOT NULL OR a.client_id IS NOT NULL OR a.vendor_id IS NOT NULL OR p_currency IS NULL OR p_currency NOT IN('EGP','USD','AED','SAR') THEN RAISE EXCEPTION 'Choose an active account auxiliary and EGP, USD, AED or SAR';END IF;
 SELECT id INTO result FROM tw_accounting_auxiliaries WHERE parent_auxiliary_id=a.id AND bank_currency=p_currency;
 IF result IS NOT NULL THEN RETURN result;END IF;
 result:=tw_accounting_auxiliary_save(p_company,a.account_code,NULL,NULL,left(a.name,140)||' / '||p_currency,true,NULL,NULL);
 UPDATE tw_accounting_auxiliaries SET parent_auxiliary_id=a.id,bank_currency=p_currency WHERE id=result;
 RETURN result;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
