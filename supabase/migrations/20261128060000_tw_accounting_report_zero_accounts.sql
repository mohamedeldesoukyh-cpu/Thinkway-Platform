BEGIN;
-- Seed eligible chart accounts even when no posted lines match. Never invent movements.
CREATE OR REPLACE FUNCTION public.tw_accounting_statement_filtered(p_company uuid, p_from date, p_to date, p_account text DEFAULT NULL::text, p_kind text DEFAULT 'all'::text, p_party uuid DEFAULT NULL::uuid, p_currency text DEFAULT NULL::text, p_offset integer DEFAULT 0, p_auxiliary uuid DEFAULT NULL::uuid, p_options jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE result jsonb;display text:=coalesce(p_options->>'display','local');account_status text:=coalesce(p_options->>'accountStatus','all');types text[];BEGIN
 IF NOT coalesce((tw_module_access()->>'accounting')::boolean,false) THEN RAISE EXCEPTION 'Accounting access required' USING ERRCODE='42501';END IF;
 IF p_from IS NULL OR p_to IS NULL OR p_from>p_to OR p_offset<0 OR p_offset>10000000 OR coalesce(p_options->>'dateBasis','journal') NOT IN('journal','activation') OR p_kind NOT IN('all','client','vendor') OR display NOT IN('local','USD','foreign') OR account_status NOT IN('all','active','inactive') THEN RAISE EXCEPTION 'Select valid statement filters';END IF;
 IF p_account IS NOT NULL AND p_account !~ '^([0-9]{1,6})(,[0-9]{1,6}){0,19}$' THEN RAISE EXCEPTION 'Enter up to 20 valid account codes';END IF;
 SELECT array_agg(value) INTO types FROM jsonb_array_elements_text(coalesce(p_options->'types','[]'));
 IF EXISTS(SELECT 1 FROM unnest(types) t WHERE t NOT IN('journal','receipt','payment','invoice','cost','expense','transfer','opening','closing','client_credit_note','vendor_credit_note','client_debit_note','vendor_debit_note')) THEN RAISE EXCEPTION 'Invalid transaction type';END IF;
 WITH RECURSIVE scope AS(SELECT code FROM tw_accounting_accounts WHERE company_id=p_company AND EXISTS(SELECT 1 FROM unnest(string_to_array(p_account,',')) prefix WHERE code LIKE prefix||'%') UNION SELECT a.code FROM tw_accounting_accounts a JOIN scope s ON a.parent_code=s.code WHERE a.company_id=p_company),source AS MATERIALIZED(
 SELECT l.journal_id,l.line_number,l.account_code,l.account_name,concat_ws(' · ',l.description,tw_accounting_note_references(j.id)) description,l.auxiliary_id,coalesce(l.auxiliary_id,l.client_id,l.vendor_id) detail_id,coalesce((SELECT number::text||' · '||name FROM tw_accounting_auxiliaries WHERE id=l.auxiliary_id),(SELECT coalesce(nullif(legal_name,''),name) FROM clients WHERE id=l.client_id),(SELECT coalesce(nullif(legal_name,''),display_name) FROM influencers WHERE id=l.vendor_id)) detail_name,l.client_code,l.vendor_code,l.foreign_debit,l.foreign_credit,CASE WHEN coalesce(p_options->>'dateBasis','journal')='activation' THEN coalesce(j.activation_date,j.entry_date) ELSE j.entry_date END entry_date,j.voucher_number,j.reference,
 coalesce(l.line_currency,j.transaction_currency,c.base_currency) currency,CASE display WHEN 'foreign' THEN coalesce(l.line_currency,j.transaction_currency,c.base_currency) WHEN 'USD' THEN 'USD' ELSE c.base_currency END report_currency,
 CASE display WHEN 'foreign' THEN coalesce(l.foreign_debit,l.debit) WHEN 'USD' THEN CASE WHEN coalesce(l.line_currency,j.transaction_currency,c.base_currency)='USD' THEN coalesce(l.foreign_debit,l.debit) ELSE round(l.debit/resolve_effective_exchange_rate('USD',c.base_currency,coalesce(j.exchange_rate_date,j.entry_date)),2) END ELSE l.debit END debit,
 CASE display WHEN 'foreign' THEN coalesce(l.foreign_credit,l.credit) WHEN 'USD' THEN CASE WHEN coalesce(l.line_currency,j.transaction_currency,c.base_currency)='USD' THEN coalesce(l.foreign_credit,l.credit) ELSE round(l.credit/resolve_effective_exchange_rate('USD',c.base_currency,coalesce(j.exchange_rate_date,j.entry_date)),2) END ELSE l.credit END credit
 FROM tw_accounting_journal_lines l JOIN tw_accounting_journals j ON j.id=l.journal_id JOIN tw_accounting_companies c ON c.id=j.company_id JOIN tw_accounting_accounts a ON a.company_id=l.company_id AND a.code=l.account_code
 WHERE j.company_id=p_company AND j.status='posted' AND (coalesce(p_options->>'excludeClosing','false')<>'true' OR j.workflow<>'closing') AND (CASE WHEN coalesce(p_options->>'dateBasis','journal')='activation' THEN coalesce(j.activation_date,j.entry_date) ELSE j.entry_date END)<=p_to AND (p_account IS NULL OR l.account_code IN(SELECT code FROM scope)) AND (p_auxiliary IS NULL OR l.auxiliary_id=p_auxiliary)
 AND (p_kind='all' OR p_kind='client' AND l.client_id IS NOT NULL AND (p_party IS NULL OR l.client_id=p_party) OR p_kind='vendor' AND l.vendor_id IS NOT NULL AND (p_party IS NULL OR l.vendor_id=p_party))
 AND (p_currency IS NULL OR coalesce(l.line_currency,j.transaction_currency,c.base_currency)=p_currency)
 AND (account_status='all' OR a.active=(account_status='active')) AND (coalesce((p_options->>'includeUnlocked')::boolean,true) OR j.control_locked)
 AND (NOT coalesce((p_options->>'excludeReversals')::boolean,false) OR j.reversal_of IS NULL)
 AND (types IS NULL OR CASE WHEN j.automatic_source IN('media_client_credit_note','media_vendor_credit_note','media_client_debit_note','media_vendor_debit_note') THEN substr(j.automatic_source,7) WHEN j.workflow='closing' THEN 'closing' WHEN j.automatic_source LIKE 'receipt%' OR j.source_payment_id IS NOT NULL THEN 'receipt' WHEN j.automatic_source LIKE 'payment%' THEN 'payment' WHEN j.source_invoice_id IS NOT NULL THEN 'invoice' WHEN j.automatic_source LIKE 'cost%' THEN 'cost' WHEN j.workflow='transfer' THEN 'transfer' WHEN j.workflow='opening' THEN 'opening' WHEN j.entry_kind='expense' THEN 'expense' ELSE 'journal' END=ANY(types))),
 movement_totals AS(SELECT account_code account,report_currency currency,max(account_name) name,coalesce(sum(debit-credit) FILTER(WHERE entry_date<p_from),0)::text opening,coalesce(sum(debit) FILTER(WHERE entry_date>=p_from),0)::text debit,coalesce(sum(credit) FILTER(WHERE entry_date>=p_from),0)::text credit,sum(debit-credit)::text closing,count(*) FILTER(WHERE entry_date>=p_from) count FROM source GROUP BY account_code,report_currency
 HAVING (NOT coalesce((p_options->>'skipZero')::boolean,false) OR (CASE WHEN p_options->>'reportMode'='profit' THEN coalesce(sum(debit-credit) FILTER(WHERE entry_date>=p_from),0) ELSE sum(debit-credit) END)<>0) AND (NOT coalesce((p_options->>'skipInactivePeriod')::boolean,false) OR count(*) FILTER(WHERE entry_date>=p_from)>0)),
 totals AS(
 SELECT * FROM movement_totals
 UNION ALL
 SELECT a.code account,cc.currency,a.name,'0'::text opening,'0'::text debit,'0'::text credit,'0'::text closing,0::bigint count
 FROM tw_accounting_accounts a JOIN tw_accounting_companies c ON c.id=a.company_id
 CROSS JOIN LATERAL (SELECT CASE display WHEN 'foreign' THEN x WHEN 'USD' THEN 'USD' ELSE c.base_currency END currency FROM unnest(CASE WHEN display='foreign' THEN CASE WHEN p_currency IS NULL THEN c.currencies ELSE ARRAY[p_currency] END ELSE ARRAY[c.base_currency] END) x) cc
 WHERE a.company_id=p_company AND a.kind IN('Posting','Control') AND a.client_id IS NULL AND a.vendor_id IS NULL
 AND NOT coalesce((p_options->>'skipZero')::boolean,false) AND NOT coalesce((p_options->>'skipInactivePeriod')::boolean,false)
 AND (p_account IS NULL OR a.code IN(SELECT code FROM scope))
 AND (account_status='all' OR a.active=(account_status='active'))
 AND (p_kind='all' OR p_kind='client' AND a.subledger='Customer' OR p_kind='vendor' AND a.subledger='Supplier / creator')
 AND (p_auxiliary IS NULL OR EXISTS(SELECT 1 FROM tw_accounting_auxiliaries ax WHERE ax.id=p_auxiliary AND ax.company_id=p_company AND ax.account_code=coalesce(a.auxiliary_source_code,a.code)))
 AND NOT EXISTS(SELECT 1 FROM source s WHERE s.account_code=a.code AND s.report_currency=cc.currency)
 ),
 auxiliary_totals AS(SELECT s.account_code account,s.report_currency currency,s.detail_id id,s.detail_name name,coalesce(sum(s.debit-s.credit) FILTER(WHERE s.entry_date<p_from),0)::text opening,coalesce(sum(s.debit) FILTER(WHERE s.entry_date>=p_from),0)::text debit,coalesce(sum(s.credit) FILTER(WHERE s.entry_date>=p_from),0)::text credit,sum(s.debit-s.credit)::text closing FROM source s JOIN totals t ON t.account=s.account_code AND t.currency=s.report_currency GROUP BY s.account_code,s.report_currency,s.detail_id,s.detail_name HAVING (NOT coalesce((p_options->>'skipZero')::boolean,false) OR (CASE WHEN p_options->>'reportMode'='profit' THEN coalesce(sum(s.debit-s.credit) FILTER(WHERE s.entry_date>=p_from),0) ELSE sum(s.debit-s.credit) END)<>0) AND (NOT coalesce((p_options->>'skipInactivePeriod')::boolean,false) OR count(*) FILTER(WHERE s.entry_date>=p_from)>0)),
 balances AS(SELECT s.*,sum(s.debit-s.credit) OVER(PARTITION BY s.account_code,s.report_currency ORDER BY entry_date,voucher_number,journal_id,line_number ROWS UNBOUNDED PRECEDING) balance FROM source s JOIN totals t ON t.account=s.account_code AND t.currency=s.report_currency),
 rows AS(SELECT journal_id id,line_number line,account_code account,account_name name,entry_date date,voucher_number number,reference,description,b.detail_name auxiliary,coalesce(client_code,vendor_code) party,currency,report_currency,debit::text,credit::text,foreign_debit::text,foreign_credit::text,balance::text FROM balances b WHERE entry_date>=p_from ORDER BY report_currency,account_code,entry_date,voucher_number,journal_id,line_number LIMIT 100 OFFSET p_offset)
 SELECT jsonb_build_object('auxiliaries',coalesce((SELECT jsonb_agg(a) FROM auxiliary_totals a),'[]'),'rows',coalesce((SELECT jsonb_agg(r) FROM rows r),'[]'),'accounts',coalesce((SELECT jsonb_agg(t ORDER BY currency,account) FROM totals t),'[]'),'count',coalesce((SELECT sum(count) FROM totals),0),'currency',CASE display WHEN 'foreign' THEN coalesce(p_currency,'FC') WHEN 'USD' THEN 'USD' ELSE (SELECT base_currency FROM tw_accounting_companies WHERE id=p_company) END) INTO result;
 RETURN result;
END $function$;
NOTIFY pgrst,'reload schema';
COMMIT;
