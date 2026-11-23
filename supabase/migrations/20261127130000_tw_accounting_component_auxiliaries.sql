BEGIN;
-- Preserve every installed posting/locking control. Amend only the component's
-- detail identity: several components may use one GL with different auxiliaries.
DO $migration$
DECLARE body text; needle text; replacement text;
BEGIN
 SELECT pg_get_functiondef('public.tw_accounting_invoice_mapping_preview(uuid,uuid,text,text,text)'::regprocedure) INTO body;
 needle := $old$'account',mapped_code,'description',label,'foreignDebit'$old$;
 replacement := $new$'account',mapped_code,'description',label,'component',key,
   'auxiliaryId',CASE WHEN mapped_code=mapping->>'account' THEN mapping->>'auxiliary_id' END,
   'auxiliaryName',(SELECT number::text||' · '||name FROM tw_accounting_auxiliaries WHERE id=CASE WHEN mapped_code=mapping->>'account' THEN nullif(mapping->>'auxiliary_id','')::uuid END),
   'foreignDebit'$new$;
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected invoice preview definition; migration stopped'; END IF;
 EXECUTE replace(body,needle,replacement);

 SELECT pg_get_functiondef('public.tw_accounting_post_mapped_invoice(uuid,uuid,integer,date,text,text,text,numeric,jsonb,jsonb)'::regprocedure) INTO body;
 needle := $old$INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit) VALUES(jid,n,p_company,a.code,a.name,l->>'description',0,(l->>'credit')::numeric,0,(l->>'foreignCredit')::numeric);$old$;
 replacement := $new$INSERT INTO tw_accounting_journal_lines(journal_id,line_number,company_id,account_code,account_name,description,debit,credit,foreign_debit,foreign_credit,auxiliary_id) VALUES(jid,n,p_company,a.code,a.name,l->>'description',0,(l->>'credit')::numeric,0,(l->>'foreignCredit')::numeric,nullif(l->>'auxiliaryId','')::uuid);$new$;
 IF position(needle IN body)=0 THEN RAISE EXCEPTION 'Unexpected invoice posting definition; migration stopped'; END IF;
 EXECUTE replace(body,needle,replacement);
END $migration$;
-- No accounts, mappings, historical lines, balances or grants are changed.
COMMIT;
