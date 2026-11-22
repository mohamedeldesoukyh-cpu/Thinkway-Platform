BEGIN;
-- VAT is an invoiced tax, never part of estimated cost accruals.
-- Existing balances/account configuration are not rewritten. Configure an unused
-- tax GL for the appropriate directory before posting new documents.
UPDATE tw_accounting_mapping_definitions SET kind='Control',subledger='Customer' WHERE key='output_vat';
UPDATE tw_accounting_mapping_definitions SET kind='Control',subledger='Supplier / creator' WHERE key='input_vat';
DO $migration$
DECLARE definition text; item record;
BEGIN
 FOR item IN SELECT * FROM (VALUES
 ('tw_accounting_invoice_mapping_preview(uuid,uuid,text,text,text)',
  $a$a.kind<>'Posting' OR a.account_type<>'Liability'$a$,
  $b$a.kind<>'Control' OR a.subledger IS DISTINCT FROM 'Customer' OR a.account_type<>'Liability'$b$),
 ('tw_accounting_invoice_mapping_preview(uuid,uuid,text,text,text)',
  $a$'description','Invoice output VAT','foreignDebit'$a$,
  $b$'description','Invoice output VAT','clientId',i.client_id,'foreignDebit'$b$),
 ('tw_accounting_post_mapped_invoice(uuid,uuid,integer,date,text,text,text,numeric,jsonb,jsonb)',
  $a$foreign_credit,auxiliary_id) VALUES(jid,n,p_company,a.code,a.name,l->>'description',0,(l->>'credit')::numeric,0,(l->>'foreignCredit')::numeric,nullif(l->>'auxiliaryId','')::uuid);$a$,
  $b$foreign_credit,auxiliary_id,client_id,client_code) VALUES(jid,n,p_company,a.code,a.name,l->>'description',0,(l->>'credit')::numeric,0,(l->>'foreignCredit')::numeric,nullif(l->>'auxiliaryId','')::uuid,nullif(l->>'clientId','')::uuid,CASE WHEN l->>'clientId' IS NOT NULL THEN s.client_code END);$b$),
 ('tw_accounting_cost_save(jsonb)',
  $a$company,p_value->>'vat','Posting','Asset','Debit'$a$,
  $b$company,p_value->>'vat','Control','Asset','Debit','Supplier / creator'$b$),
 ('tw_accounting_cost_post(uuid,uuid,integer,numeric)',
  $a$p_company,c.vat_account,'Posting','Asset','Debit'$a$,
  $b$p_company,c.vat_account,'Control','Asset','Debit','Supplier / creator'$b$),
 ('tw_accounting_cost_post(uuid,uuid,integer,numeric)',
  $a$c.vat_account,'Reviewed input tax',bt,0,c.tax,0)$a$,
  $b$c.vat_account,'Reviewed input tax',bt,0,c.tax,0,NULL,c.vendor_id,c.vendor_code)$b$),
 ('tw_accounting_cost_reconcile(uuid,uuid,integer,date,text,date,numeric,numeric,text,text)',
  $a$p_company,p_vat,'Posting','Asset','Debit'$a$,
  $b$p_company,p_vat,'Control','Asset','Debit','Supplier / creator'$b$),
 ('tw_accounting_cost_reconcile(uuid,uuid,integer,date,text,date,numeric,numeric,text,text)',
  $a$p_vat,'Reviewed input tax',greatest(dt,0),greatest(-dt,0),greatest(p_tax-c.tax,0),greatest(c.tax-p_tax,0))$a$,
  $b$p_vat,'Reviewed input tax',greatest(dt,0),greatest(-dt,0),greatest(p_tax-c.tax,0),greatest(c.tax-p_tax,0),NULL,c.vendor_id,c.vendor_code)$b$)
 ) AS replacements(signature,needle,replacement) LOOP
  SELECT pg_get_functiondef(('public.'||item.signature)::regprocedure) INTO definition;
  IF position(item.needle IN definition)=0 THEN RAISE EXCEPTION 'Unexpected definition for %, tax migration stopped',item.signature; END IF;
  EXECUTE replace(definition,item.needle,item.replacement);
 END LOOP;
END $migration$;
COMMIT;
