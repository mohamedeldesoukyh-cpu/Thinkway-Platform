BEGIN;
DO $patch$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('tw_accounting_auxiliary_save(uuid,text,uuid,integer,text,boolean,uuid,uuid)'::regprocedure) INTO definition;
 IF position(' UPDATE tw_accounting_auxiliaries SET name=' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected auxiliary save definition';END IF;
 definition:=replace(definition,' UPDATE tw_accounting_auxiliaries SET name=', $guard$
 IF NOT p_active AND EXISTS(
 SELECT 1 FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id
 WHERE l.company_id=p_company AND l.auxiliary_id=p_id AND j.status='posted'
 GROUP BY l.account_code,coalesce(l.line_currency,j.transaction_currency)
 HAVING sum(l.debit-l.credit)<>0 OR sum(coalesce(l.foreign_debit,l.debit)-coalesce(l.foreign_credit,l.credit))<>0
 ) THEN RAISE EXCEPTION 'Cannot remove an auxiliary with a balance. Clear it in every linked GL account and currency first.';END IF;
 UPDATE tw_accounting_auxiliaries SET name=$guard$);
 EXECUTE definition;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
