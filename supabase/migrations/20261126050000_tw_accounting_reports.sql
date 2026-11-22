BEGIN;
-- Read-only aggregation over existing journals; no duplicated balances or document numbers.
CREATE FUNCTION tw_accounting_financial_report(p_company uuid,p_from date,p_to date) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to THEN RAISE EXCEPTION 'Check report dates';END IF;
 WITH lines AS (
 SELECT l.*,j.entry_date,j.workflow FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id
 WHERE j.company_id=p_company AND j.status='posted' AND j.entry_date<=p_to
 ), balances AS (
 SELECT a.code,a.name,a.account_type,
 coalesce(sum(l.debit-l.credit) FILTER(WHERE l.entry_date<p_from),0) opening,
 coalesce(sum(l.debit) FILTER(WHERE l.entry_date>=p_from),0) debit,
 coalesce(sum(l.credit) FILTER(WHERE l.entry_date>=p_from),0) credit,
 coalesce(sum(l.debit-l.credit),0) closing
 FROM tw_accounting_accounts a LEFT JOIN lines l ON l.account_code=a.code WHERE a.company_id=p_company AND a.kind<>'Group' GROUP BY a.code,a.name,a.account_type
 ), cash AS (
 SELECT l.journal_id,sum(l.debit-l.credit) amount,bool_or(l.workflow='opening') opening
 FROM lines l WHERE l.entry_date>=p_from AND l.account_code LIKE '11%' GROUP BY l.journal_id
 ), flows AS (
 SELECT c.*,CASE WHEN c.opening THEN 'Opening balances'
 WHEN count(DISTINCT CASE WHEN a.account_type='Equity' OR a.code='243001' THEN 'Financing' WHEN a.code LIKE '15%' THEN 'Investing' ELSE 'Operating' END)=1
 THEN min(CASE WHEN a.account_type='Equity' OR a.code='243001' THEN 'Financing' WHEN a.code LIKE '15%' THEN 'Investing' ELSE 'Operating' END)
 ELSE 'Unclassified / mixed' END category
 FROM cash c LEFT JOIN lines l ON l.journal_id=c.journal_id AND l.account_code NOT LIKE '11%' LEFT JOIN tw_accounting_accounts a ON a.company_id=p_company AND a.code=l.account_code
 GROUP BY c.journal_id,c.amount,c.opening
 ) SELECT jsonb_build_object('accounts',(SELECT coalesce(jsonb_agg(jsonb_build_object('code',code,'name',name,'type',account_type,'opening',opening::text,'debit',debit::text,'credit',credit::text,'closing',closing::text) ORDER BY code),'[]') FROM balances),
 'cash',(SELECT coalesce(jsonb_agg(x),'[]') FROM (SELECT category,sum(amount)::text amount FROM flows GROUP BY category ORDER BY category)x)) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_financial_report(uuid,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tw_accounting_financial_report(uuid,date,date) TO authenticated;
CREATE FUNCTION tw_accounting_aging(p_company uuid,p_kind text,p_currency text,p_party uuid DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb;
BEGIN
IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
IF p_kind NOT IN('client','vendor') THEN RAISE EXCEPTION 'Choose client or vendor';END IF;
WITH parties AS (SELECT DISTINCT client_id id FROM tw_accounting_invoice_submissions WHERE company_id=p_company AND p_kind='client' UNION SELECT DISTINCT vendor_id FROM tw_accounting_cost_invoices WHERE company_id=p_company AND p_kind='vendor'), items AS (
SELECT x.value||jsonb_build_object('party',coalesce(cl.document_number,v.document_number),'partyName',coalesce(cl.name,v.legal_name,v.display_name)) item FROM parties p LEFT JOIN clients cl ON cl.id=p.id AND p_kind='client' LEFT JOIN influencers v ON v.id=p.id AND p_kind='vendor' CROSS JOIN LATERAL jsonb_array_elements(tw_accounting_open_items(p_company,p_kind,p.id,p_currency)) x WHERE p_party IS NULL OR p.id=p_party)
SELECT coalesce(jsonb_agg(item ORDER BY item->>'due',item->>'number'),'[]') INTO result FROM items;
RETURN result;
END $$;
REVOKE ALL ON FUNCTION tw_accounting_aging(uuid,text,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION tw_accounting_aging(uuid,text,text,uuid) TO authenticated;
COMMIT;
