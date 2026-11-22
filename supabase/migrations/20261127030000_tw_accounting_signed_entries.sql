BEGIN;
ALTER TABLE public.tw_accounting_journal_lines
 ADD COLUMN entered_amount numeric(18,2), ADD COLUMN entered_side text,
 ADD CONSTRAINT tw_accounting_signed_entry_consistent CHECK (
 (entered_amount IS NULL AND entered_side IS NULL) OR
 (entered_amount IS NOT NULL AND entered_amount<0 AND entered_side IS NOT NULL AND entered_side IN ('D','C') AND
 entered_amount*CASE WHEN entered_side='D' THEN 1 ELSE -1 END=coalesce(foreign_debit,debit)-coalesce(foreign_credit,credit)));
CREATE FUNCTION public.tw_accounting_save_signed_workflow(p_value jsonb) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;item jsonb;n integer:=0;BEGIN
 IF NOT tw_accounting_can_manage() THEN RAISE EXCEPTION 'Accounting management and verified MFA required' USING ERRCODE='42501';END IF;
 result:=tw_accounting_save_workflow(p_value);
 FOR item IN SELECT value FROM jsonb_array_elements(p_value->'lines') LOOP
  n:=n+1;
  UPDATE tw_accounting_journal_lines SET entered_amount=(item->>'enteredAmount')::numeric,entered_side=item->>'enteredSide' WHERE journal_id=result AND line_number=n;
 END LOOP;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.tw_accounting_save_signed_workflow(jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_accounting_save_signed_workflow(jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
