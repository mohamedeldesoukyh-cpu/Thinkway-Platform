BEGIN;
ALTER TABLE public.tw_finance_saved_reports DROP CONSTRAINT tw_finance_saved_reports_plan_check;
ALTER TABLE public.tw_finance_saved_reports ADD CONSTRAINT tw_finance_saved_reports_plan_check CHECK(plan->>'action' IN('custom_ledger','accounting_analysis') AND octet_length(plan::text)<10000);
-- Read-only report expansion. No business data, document numbers or posting rules change.
CREATE OR REPLACE FUNCTION public.tw_finance_analysis_snapshot(p_company uuid,p_from date,p_to date,p_accounts text DEFAULT NULL,p_display text DEFAULT 'local') RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE result jsonb; page jsonb; rows jsonb; total integer; offset_value integer; enriched jsonb;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 result:=tw_accounting_statement_filtered(p_company,p_from,p_to,p_accounts,'all',NULL,NULL,0,NULL,jsonb_build_object('display',p_display,'excludeClosing',true,'includeUnlocked',true));
 total:=(result->>'count')::integer;
 IF total IS NULL OR total>10000 THEN RAISE EXCEPTION 'Narrow analysis to at most 10,000 entries';END IF;
 rows:=result->'rows';offset_value:=100;
 WHILE offset_value<total LOOP
  page:=tw_accounting_statement_filtered(p_company,p_from,p_to,p_accounts,'all',NULL,NULL,offset_value,NULL,jsonb_build_object('display',p_display,'excludeClosing',true,'includeUnlocked',true));
  rows:=rows||(page->'rows');offset_value:=offset_value+100;
 END LOOP;
 IF jsonb_array_length(rows)<>total THEN RAISE EXCEPTION 'Incomplete analysis';END IF;
 IF EXISTS(
  WITH detail AS(SELECT r->>'report_currency' currency,sum((r->>'debit')::numeric) debit,sum((r->>'credit')::numeric) credit FROM jsonb_array_elements(rows) r GROUP BY 1),
  control AS(SELECT a->>'currency' currency,sum((a->>'debit')::numeric) debit,sum((a->>'credit')::numeric) credit FROM jsonb_array_elements(result->'accounts') a GROUP BY 1)
  SELECT 1 FROM detail d FULL JOIN control c USING(currency) WHERE coalesce(d.debit,0)<>coalesce(c.debit,0) OR coalesce(d.credit,0)<>coalesce(c.credit,0)
 ) THEN RAISE EXCEPTION 'Analysis does not reconcile to ledger controls';END IF;
 -- Identity is determined by source UUIDs. A supplier is never treated as a client.
 -- Accrual references below are exact frozen reference/component tokens written by
 -- monthly_pair, not fuzzy matches against party names or free-form narratives.
 WITH entries AS (
  SELECT r.value payload,l.*,j.source_invoice_id,coalesce(j.reversal_of,j.id) origin
  FROM jsonb_array_elements(rows) r
  JOIN tw_accounting_journal_lines l ON l.journal_id=(r.value->>'id')::uuid AND l.line_number=(r.value->>'line')::integer AND l.company_id=p_company
  JOIN tw_accounting_journals j ON j.id=l.journal_id AND j.company_id=p_company
 ), linked AS (
  SELECT e.*,s.client,s.campaign
  FROM entries e
  LEFT JOIN LATERAL (
   SELECT CASE WHEN count(DISTINCT x.client)=1 THEN min(x.client::text)::uuid END client,
          CASE WHEN count(DISTINCT x.campaign)=1 THEN min(x.campaign::text)::uuid END campaign
   FROM (
    SELECT i.client_id client,i.campaign_header_id campaign FROM invoices i WHERE i.id=e.source_invoice_id
    UNION ALL
    SELECT h.client_id,h.id FROM tw_accounting_cost_invoices c JOIN campaign_lines a ON a.id=c.assignment_line_id JOIN campaign_headers h ON h.id=a.campaign_header_id
     WHERE c.company_id=p_company AND c.journal_id=e.origin
    UNION ALL
    SELECT h.client_id,h.id FROM tw_accounting_cost_accruals c JOIN campaign_lines a ON a.id=c.assignment_line_id JOIN campaign_headers h ON h.id=a.campaign_header_id
     WHERE c.company_id=p_company AND c.journal_id=e.origin AND c.expense_account=e.account_code
      AND (e.description='Net cost accrual · '||(c.source->>'reference') OR right(e.description,length((c.source->>'reference')||' · '||c.component)+3)=' · '||(c.source->>'reference')||' · '||c.component)
    UNION ALL
    SELECT h.client_id,h.id FROM tw_accounting_monthly_accruals m CROSS JOIN LATERAL jsonb_array_elements(m.plan->'items') item
     JOIN campaign_lines a ON a.id::text=item->>'assignment' JOIN campaign_headers h ON h.id=a.campaign_header_id
     WHERE m.company_id=p_company AND m.journal_id=e.origin AND e.account_code IN(item->>'account',item->>'counter')
      AND right(e.description,length((item->>'reference')||' · '||(item->>'component'))+3)=' · '||(item->>'reference')||' · '||(item->>'component')
    UNION ALL
    SELECT h.client_id,h.id FROM tw_accounting_media_postings mp JOIN campaign_lines a ON a.id::text=mp.snapshot->>'assignment' JOIN campaign_headers h ON h.id=a.campaign_header_id
     WHERE mp.company_id=p_company AND mp.journal_id=e.origin
   ) x
  ) s ON true
 )
 SELECT coalesce(jsonb_agg(e.payload||jsonb_build_object('client_id',coalesce(e.client_id,e.client),'client_code',cl.document_number,'client_name',coalesce(nullif(cl.legal_name,''),cl.name),
  'vendor_id',e.vendor_id,'vendor_name',coalesce(nullif(v.legal_name,''),v.display_name),'campaign_id',e.campaign,'campaign_name',h.name,
  'attribution',CASE WHEN e.client_id IS NOT NULL THEN 'ledger client' WHEN e.client IS NOT NULL THEN 'linked source' ELSE 'unassigned' END) ORDER BY e.payload->>'date',e.journal_id,e.line_number),'[]') INTO enriched
 FROM linked e LEFT JOIN clients cl ON cl.id=coalesce(e.client_id,e.client) LEFT JOIN influencers v ON v.id=e.vendor_id LEFT JOIN campaign_headers h ON h.id=e.campaign;
 IF jsonb_array_length(enriched)<>total THEN RAISE EXCEPTION 'Incomplete attribution';END IF;
 RETURN jsonb_build_object('rows',enriched,'count',total);
END $$;
REVOKE ALL ON FUNCTION public.tw_finance_analysis_snapshot(uuid,date,date,text,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_finance_analysis_snapshot(uuid,date,date,text,text) TO authenticated;

-- Financial position reports need account controls, not thousands of detail rows.
DO $patch$ DECLARE d text; BEGIN
 SELECT pg_get_functiondef('public.tw_finance_statement_snapshot(uuid,date,date,text,text,uuid,text,integer,uuid,jsonb)'::regprocedure) INTO d;
 IF position('''summaryOnly''' IN d)=0 AND position('IF p_options->>''reportMode''=''profit'' THEN RETURN result;' IN d)=0 THEN RAISE EXCEPTION 'Unexpected snapshot definition';END IF;
 d:=replace(d,'IF p_options->>''reportMode''=''profit'' THEN RETURN result;','IF p_options->>''reportMode''=''profit'' OR p_options->>''summaryOnly''=''true'' THEN RETURN result;');
 EXECUTE d;
END $patch$;

CREATE OR REPLACE FUNCTION public.tw_finance_accounting_controls(p_company uuid,p_year uuid,p_from date,p_to date,p_section text) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=public AS $$
DECLARE rows jsonb;columns jsonb;BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM tw_accounting_years WHERE id=p_year AND company_id=p_company) OR p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Invalid control scope';END IF;
 IF p_section='budget' THEN
  IF p_from<>date_trunc('month',p_from)::date OR p_to<>(date_trunc('month',p_to)+interval '1 month - 1 day')::date THEN RAISE EXCEPTION 'Budgets require complete fiscal months';END IF;
  columns:='["Account","Name","Type","Month","Budget","Actual"]';
  SELECT coalesce(jsonb_agg(jsonb_build_array(r->>'code',r->>'name',r->>'type',r->>'date',coalesce(r->>'budget','Not set'),r->>'actual') ORDER BY r->>'date',r->>'code'),'[]') INTO rows
  FROM jsonb_array_elements(tw_accounting_budget_report(p_company,p_year)) r WHERE (r->>'date')::date BETWEEN p_from AND p_to AND (r->>'budget' IS NOT NULL OR (r->>'actual')::numeric<>0);
 ELSIF p_section='close' THEN
  columns:='["Period","From","To","Status","Posted","Draft / pending","Lock reason"]';
  SELECT coalesce(jsonb_agg(jsonb_build_array(p.period_number::text,p.start_date::text,p.end_date::text,CASE WHEN p.is_closed THEN 'Closed' ELSE 'Open' END,
   (SELECT count(*)::text FROM tw_accounting_journals j WHERE j.company_id=p_company AND j.entry_date BETWEEN p.start_date AND p.end_date AND j.status='posted'),
   (SELECT count(*)::text FROM tw_accounting_journals j WHERE j.company_id=p_company AND j.entry_date BETWEEN p.start_date AND p.end_date AND j.status IN('draft','pending')),coalesce(p.lock_reason,'')) ORDER BY p.start_date),'[]') INTO rows
  FROM tw_accounting_periods p WHERE p.year_id=p_year AND p.start_date<=p_to AND p.end_date>=p_from;
 ELSIF p_section='bank_reconciliation' THEN
  columns:='["Bank","Statement","Date","Reference","Description","Currency","Unmatched amount"]';
  SELECT coalesce(jsonb_agg(jsonb_build_array(b.name,s.reference,r.entry_date::text,r.reference,r.description,b.currency,r.amount::text) ORDER BY b.name,r.entry_date,r.row_number),'[]') INTO rows
  FROM tw_accounting_bank_rows r JOIN tw_accounting_bank_statements s ON s.id=r.statement_id AND s.company_id=p_company JOIN tw_accounting_banks b ON b.id=s.bank_id AND b.company_id=p_company
  WHERE r.company_id=p_company AND r.match_id IS NULL AND s.status<>'void' AND r.entry_date BETWEEN p_from AND p_to;
 ELSE RAISE EXCEPTION 'Unsupported control section';END IF;
 IF jsonb_array_length(rows)>10000 THEN RAISE EXCEPTION 'Narrow the control report';END IF;
 RETURN jsonb_build_object('columns',columns,'rows',rows);
END $$;
REVOKE ALL ON FUNCTION public.tw_finance_accounting_controls(uuid,uuid,date,date,text) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.tw_finance_accounting_controls(uuid,uuid,date,date,text) TO authenticated;

CREATE OR REPLACE FUNCTION tw_finance_mail_read(p_job uuid,p_lease uuid,p_operation text,p_args jsonb DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j tw_finance_mail_jobs;result jsonb;prior text:=current_setting('request.jwt.claims',true);kind text:=coalesce(p_args->>'kind','client');BEGIN
 SELECT * INTO j FROM tw_finance_mail_jobs WHERE id=p_job AND lease_id=p_lease AND lease_until>now() AND status='processing';
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM tw_finance_mail_config c WHERE c.enabled AND c.company_id=j.company_id AND c.year_id=j.year_id AND c.authorized_by=j.authorized_by) THEN RAISE EXCEPTION 'Inactive report delegation' USING ERRCODE='42501';END IF;
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',j.authorized_by,'role','authenticated')::text,true);
 IF NOT coalesce((tw_module_access()->>'admin')::boolean,false) THEN RAISE EXCEPTION 'Report delegation revoked' USING ERRCODE='42501';END IF;
 IF kind NOT IN('client','vendor') THEN RAISE EXCEPTION 'Invalid directory';END IF;
 IF p_operation='setup' THEN
  SELECT jsonb_build_object('company',to_jsonb(c),'year',(SELECT to_jsonb(y) FROM tw_accounting_years y WHERE y.id=j.year_id AND y.company_id=j.company_id),
   'accounts',(SELECT coalesce(jsonb_agg(to_jsonb(a)),'[]') FROM tw_accounting_accounts a WHERE a.company_id=j.company_id AND a.client_id IS NULL AND a.vendor_id IS NULL)) INTO result FROM tw_accounting_companies c WHERE c.id=j.company_id;
 ELSIF p_operation='party_lookup' THEN
  result:=tw_accounting_party_lookup(j.company_id,kind,p_args->>'search',NULL);
 ELSIF p_operation='analysis' THEN
  result:=tw_finance_analysis_snapshot(j.company_id,(p_args->>'from')::date,(p_args->>'to')::date,nullif(p_args->>'account',''),p_args->>'display');
 ELSIF p_operation='controls' THEN
  result:=tw_finance_accounting_controls(j.company_id,j.year_id,(p_args->>'from')::date,(p_args->>'to')::date,p_args->>'section');
 ELSIF p_operation='statement' THEN
  IF coalesce(p_args->>'action','') NOT IN('pnl','client_statement','supplier_statement','custom_ledger','financial_position') OR coalesce(p_args->>'display','') NOT IN('local','USD','foreign') THEN RAISE EXCEPTION 'Unsupported report';END IF;
  IF p_args->>'action' IN('client_statement','supplier_statement') AND nullif(p_args->>'party','') IS NULL THEN RAISE EXCEPTION 'Party selection required';END IF;
  IF coalesce(p_args->>'account','') !~ '^([0-9]{1,6}(,[0-9]{1,6}){0,19})?$' THEN RAISE EXCEPTION 'Invalid account filters';END IF;
  result:=tw_finance_statement_snapshot(j.company_id,(p_args->>'from')::date,(p_args->>'to')::date,CASE WHEN p_args->>'action'='custom_ledger' THEN nullif(p_args->>'account','') ELSE NULL END,
   CASE WHEN p_args->>'action'='supplier_statement' THEN 'vendor' WHEN p_args->>'action'='client_statement' THEN 'client' ELSE 'all' END,nullif(p_args->>'party','')::uuid,NULL,0,NULL,
   jsonb_build_object('reportMode',CASE WHEN p_args->>'action'='pnl' THEN 'profit' ELSE 'statement' END,'summaryOnly',p_args->>'action'='financial_position','display',p_args->>'display','dateBasis','journal','includeUnlocked',true,'excludeClosing',p_args->>'action'='pnl','skipZero',false));
 ELSIF p_operation='outstanding' THEN
  IF nullif(p_args->>'party','') IS NULL OR coalesce(p_args->>'currency','') !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'Invalid outstanding scope';END IF;
  result:=tw_accounting_open_items(j.company_id,kind,(p_args->>'party')::uuid,p_args->>'currency',NULL);
 ELSE RAISE EXCEPTION 'Unsupported delegated operation';END IF;
 PERFORM set_config('request.jwt.claims',coalesce(prior,''),true);RETURN result;
EXCEPTION WHEN OTHERS THEN PERFORM set_config('request.jwt.claims',coalesce(prior,''),true);RAISE;
END $$;
COMMIT;
