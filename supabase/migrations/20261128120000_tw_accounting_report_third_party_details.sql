BEGIN;
DO $patch$ DECLARE definition text;BEGIN
 SELECT pg_get_functiondef('tw_accounting_statement_filtered(uuid,date,date,text,text,uuid,text,integer,uuid,jsonb)'::regprocedure) INTO definition;
 IF position('auxiliary_totals AS(' IN definition)=0 OR position(' balances AS(' IN definition)=0 THEN RAISE EXCEPTION 'Unexpected statement definition';END IF;
 definition:=replace(definition,'coalesce(l.auxiliary_id,l.client_id,l.vendor_id) detail_id','coalesce(l.client_id,l.vendor_id,l.auxiliary_id) detail_id');
 definition:=replace(definition,'coalesce((SELECT number::text', $name$CASE WHEN l.client_id IS NOT NULL THEN (SELECT coalesce(nullif(legal_name,''),name) FROM clients WHERE id=l.client_id) WHEN l.vendor_id IS NOT NULL THEN (SELECT coalesce(nullif(legal_name,''),display_name,document_number) FROM influencers WHERE id=l.vendor_id) ELSE coalesce((SELECT number::text$name$);
 definition:=replace(definition,' detail_name,l.client_code',' END detail_name,l.client_code');
 definition:=replace(definition,'auxiliary_totals AS(','movement_details AS(');
 definition:=replace(definition,' balances AS(', $cte$
 auxiliary_totals AS(
 SELECT * FROM movement_details
 UNION ALL
 SELECT t.account,t.currency,d.id,d.name,'0','0','0','0'
 FROM totals t JOIN tw_accounting_accounts a ON a.company_id=p_company AND a.code=t.account
 CROSS JOIN LATERAL (
 SELECT c.id,coalesce(nullif(c.legal_name,''),c.name) name FROM clients c WHERE a.subledger='Customer' AND (p_party IS NULL OR c.id=p_party)
 UNION ALL
 SELECT i.id,coalesce(nullif(i.legal_name,''),i.display_name,i.document_number) FROM influencers i WHERE a.subledger='Supplier / creator' AND tw_accounting_eligible_vendor(i.id) AND (p_party IS NULL OR i.id=p_party)
 UNION ALL
 SELECT x.id,x.number::text||' · '||x.name FROM tw_accounting_auxiliaries x WHERE x.company_id=p_company AND x.account_code=coalesce(a.auxiliary_source_code,a.code) AND a.has_auxiliary AND coalesce(a.subledger,'') NOT IN('Customer','Supplier / creator') AND (p_auxiliary IS NULL OR x.id=p_auxiliary)
 ) d
 WHERE CASE WHEN a.subledger IN('Customer','Supplier / creator') THEN coalesce((p_options->>'includeThirdParties')::boolean,false) AND p_auxiliary IS NULL ELSE coalesce((p_options->>'includeAuxiliary')::boolean,false) END
 AND NOT coalesce((p_options->>'skipZero')::boolean,false) AND NOT coalesce((p_options->>'skipInactivePeriod')::boolean,false)
 AND (p_kind='all' OR p_kind='client' AND a.subledger='Customer' OR p_kind='vendor' AND a.subledger='Supplier / creator')
 AND NOT EXISTS(SELECT 1 FROM movement_details m WHERE m.account=t.account AND m.currency=t.currency AND m.id=d.id)
 ),
 balances AS($cte$);
 EXECUTE definition;
END $patch$;
NOTIFY pgrst,'reload schema';
COMMIT;
