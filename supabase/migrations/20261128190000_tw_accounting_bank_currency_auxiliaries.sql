BEGIN;
ALTER TABLE public.tw_accounting_auxiliaries
 ADD COLUMN parent_auxiliary_id uuid REFERENCES public.tw_accounting_auxiliaries(id),
 ADD COLUMN bank_currency text,
 ADD CONSTRAINT tw_bank_currency_child CHECK ((parent_auxiliary_id IS NULL AND bank_currency IS NULL) OR (parent_auxiliary_id IS NOT NULL AND bank_currency IN ('EGP','USD','AED','SAR')));
CREATE UNIQUE INDEX tw_bank_currency_unique ON public.tw_accounting_auxiliaries(company_id,parent_auxiliary_id,bank_currency) WHERE parent_auxiliary_id IS NOT NULL;
CREATE FUNCTION public.tw_accounting_bank_currency_auxiliary(p_company uuid,p_parent uuid,p_currency text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE a tw_accounting_auxiliaries%ROWTYPE; result uuid;
BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM tw_accounting_auxiliaries WHERE id=p_parent AND company_id=p_company FOR UPDATE;
 IF NOT FOUND OR NOT a.active OR a.parent_auxiliary_id IS NOT NULL OR a.account_code NOT LIKE '11%' OR a.client_id IS NOT NULL OR a.vendor_id IS NOT NULL OR p_currency IS NULL OR p_currency NOT IN('EGP','USD','AED','SAR') THEN RAISE EXCEPTION 'Choose an active bank auxiliary and EGP, USD, AED or SAR';END IF;
 SELECT id INTO result FROM tw_accounting_auxiliaries WHERE parent_auxiliary_id=a.id AND bank_currency=p_currency;
 IF result IS NOT NULL THEN RETURN result;END IF;
 result:=tw_accounting_auxiliary_save(p_company,a.account_code,NULL,NULL,left(a.name,140)||' / '||p_currency,true,NULL,NULL);
 UPDATE tw_accounting_auxiliaries SET parent_auxiliary_id=a.id,bank_currency=p_currency WHERE id=result;
 RETURN result;
END $$;
CREATE FUNCTION public.tw_accounting_bank_currency_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE currency text;actual text;
BEGIN
 SELECT bank_currency INTO currency FROM tw_accounting_auxiliaries WHERE id=NEW.auxiliary_id;
 IF currency IS NOT NULL THEN
  SELECT coalesce(NEW.line_currency,transaction_currency) INTO actual FROM tw_accounting_journals WHERE id=NEW.journal_id;
  IF actual IS DISTINCT FROM currency THEN RAISE EXCEPTION 'Selected bank currency is %, but this line uses %',currency,actual;END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tw_bank_currency_line BEFORE INSERT OR UPDATE ON public.tw_accounting_journal_lines FOR EACH ROW EXECUTE FUNCTION public.tw_accounting_bank_currency_guard();
REVOKE ALL ON FUNCTION public.tw_accounting_bank_currency_auxiliary(uuid,uuid,text),public.tw_accounting_bank_currency_guard() FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_accounting_bank_currency_auxiliary(uuid,uuid,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
